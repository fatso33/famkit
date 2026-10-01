import {
  collection,
  doc,
  getDoc,
  deleteField,
  FieldPath,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Language, LocalizedRecipeContent, Recipe, RecipeVersion } from '../types/recipe';
import {
  getLocalVersion,
  getStoredRecipes,
  saveLocalVersions,
  saveRecipes as saveToLocalStorage,
} from './storage';
import { hasLeftOutPhotos } from '../utils/deviceCopy';
import { familyMemberName } from '../utils/ownership';
import { parseRecipeVersion } from '../utils/recipeVersions';
import { sourceHash } from '../utils/recipeTranslation';
import { Make, MakeTranslation } from '../types/make';
import { getStoredMakes, saveMakes } from './storage';
import { heartKey, parseMake } from '../utils/makes';
import { makeSourceHash } from '../utils/makeTranslation';

/**
 * Whether the cloud keeps the vault (and every photo). Not when Firebase is off, nor when it is
 * configured but failed to start: then this device's copy is the only one.
 */
export const hasCloud = isFirebaseConfigured && !!db;

const RECIPES_COLLECTION = 'recipes';
// The family list: family_members/{lowercase email}, kept in the Firebase console only.
const FAMILY_MEMBERS_COLLECTION = 'family_members';
// Earlier versions of a recipe: recipes/{recipeId}/versions/{versionId}, written once, never changed.
const VERSIONS_COLLECTION = 'versions';
// What family members made from the recipes: makes/{makeId}.
const MAKES_COLLECTION = 'makes';

/**
 * Real-time listener for the recipes collection.
 * Triggers callback whenever recipes are added, modified, or deleted by any family member.
 * Returns an unsubscribe function.
 */
export function subscribeToRecipes(
  onUpdate: (recipes: Recipe[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    // Fallback to local storage if Firebase is not configured
    const local = getStoredRecipes();
    onUpdate(local);
    return () => {};
  }

  // Deliberately unordered: a Firestore orderBy silently drops documents missing that field,
  // which once hid a recipe saved without createdAt. Sorted newest first below instead.
  return onSnapshot(
    collection(db, RECIPES_COLLECTION),
    (snapshot) => {
      // An empty answer from an empty offline cache says nothing about the vault: keep showing
      // this device's copy rather than wiping it.
      if (snapshot.empty && snapshot.metadata.fromCache) {
        onUpdate(getStoredRecipes());
        return;
      }

      const cloudRecipes: Recipe[] = [];
      snapshot.forEach((docSnap) => {
        cloudRecipes.push(docSnap.data() as Recipe);
      });
      cloudRecipes.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

      // Also mirror to localStorage for instantaneous offline boots
      saveToLocalStorage(cloudRecipes, { photosInCloud: true });
      onUpdate(cloudRecipes);
    },
    (error) => {
      console.warn('Firestore subscription error (falling back to local cache):', error);
      if (onError) onError(error);
      const cached = getStoredRecipes();
      onUpdate(cached);
    },
  );
}

/**
 * Saves a recipe, together with the earlier versions this save backs up, in one atomic write.
 * The recipe document is replaced whole, so a field cleared in the editor is cleared in the cloud.
 */
export async function saveRecipeToCloud(
  recipe: Recipe,
  newVersions: RecipeVersion[] = [],
): Promise<void> {
  // This device's copy may have left photos out to fit: saving it would erase them everywhere.
  if (hasLeftOutPhotos(recipe) || newVersions.some((v) => hasLeftOutPhotos(v.recipe))) {
    throw new Error(`Refusing to save recipe ${recipe.id} from a copy without its photos`);
  }

  // Always update local cache immediately
  const local = getStoredRecipes();
  const existingIdx = local.findIndex((r) => r.id === recipe.id);
  const updatedLocal =
    existingIdx !== -1 ? local.map((r) => (r.id === recipe.id ? recipe : r)) : [recipe, ...local];
  saveToLocalStorage(updatedLocal, { photosInCloud: hasCloud });

  if (!isFirebaseConfigured || !db) {
    saveLocalVersions(recipe.id, newVersions);
    return;
  }

  const recipeRef = doc(db, RECIPES_COLLECTION, recipe.id);
  const batch = writeBatch(db);
  batch.set(recipeRef, recipe);
  for (const version of newVersions) {
    batch.set(doc(recipeRef, VERSIONS_COLLECTION, version.id), version);
  }
  await batch.commit();
}

/** Loads one earlier version (one read). Rejects if it's missing or malformed. */
export async function fetchRecipeVersion(
  recipeId: string,
  versionId: string,
): Promise<RecipeVersion> {
  let raw: unknown;
  if (!isFirebaseConfigured || !db) {
    raw = getLocalVersion(recipeId, versionId);
  } else {
    const snapshot = await getDoc(
      doc(db, RECIPES_COLLECTION, recipeId, VERSIONS_COLLECTION, versionId),
    );
    raw = snapshot.exists() ? snapshot.data() : null;
  }
  const version = parseRecipeVersion(raw);
  if (!version) throw new Error(`Recipe version ${recipeId}/${versionId} is missing or malformed`);
  return version;
}

export interface FamilyMembership {
  isMember: boolean;
  /** The name the family list gives them, overriding their Google name; null when unset. */
  name: string | null;
}

/**
 * Looks this email up on the family list (one read). Being on it is the entry existing; its only
 * field read is an optional `name`. Rejects when the answer can't be had (e.g. offline with
 * nothing cached), so a lost connection isn't mistaken for "not family".
 */
export async function fetchFamilyMembership(email: string): Promise<FamilyMembership> {
  if (!isFirebaseConfigured || !db) return { isMember: true, name: null };
  try {
    const snapshot = await getDoc(doc(db, FAMILY_MEMBERS_COLLECTION, email.trim().toLowerCase()));
    if (!snapshot.exists()) return { isMember: false, name: null };
    const data: unknown = snapshot.data();
    const rawName =
      typeof data === 'object' && data !== null ? (data as { name?: unknown }).name : null;
    return { isMember: true, name: familyMemberName(rawName) };
  } catch (err) {
    // The rules refuse the lookup outright for an unverified email: not family.
    if ((err as { code?: unknown } | null)?.code === 'permission-denied') {
      return { isMember: false, name: null };
    }
    throw err;
  }
}

/**
 * Stores a finished translation. Writes only the translation fields, so it doesn't count as a
 * new version, and only while the cloud text is still what was translated (`sourceHash`): a
 * translation of an outdated copy never lands on a newer recipe. Also removes any leftover entry
 * for the source language (older merge saves kept one after a recipe was re-written in the
 * other language). Resolves to whether it wrote.
 */
export async function saveTranslationToCloud(
  recipeId: string,
  sourceLanguage: Language,
  translation: LocalizedRecipeContent,
): Promise<boolean> {
  const firestore = db;
  if (!isFirebaseConfigured || !firestore) return false;

  const target: Language = sourceLanguage === 'en' ? 'pl' : 'en';
  const recipeRef = doc(firestore, RECIPES_COLLECTION, recipeId);
  return runTransaction(firestore, async (tx) => {
    const current = await tx.get(recipeRef);
    if (!current.exists() || sourceHash(current.data() as Recipe) !== translation.sourceHash) {
      return false;
    }
    tx.update(recipeRef, {
      sourceLanguage,
      [`translations.${target}`]: translation,
      [`translations.${sourceLanguage}`]: deleteField(),
    });
    return true;
  });
}

// --- Makes ---------------------------------------------------------------------------------

/**
 * Real-time listener for the makes, newest first. Each is checked as it arrives (parseMake); one
 * that isn't usable is left out. Falls back to this device's copy without the cloud.
 */
export function subscribeToMakes(onUpdate: (makes: Make[]) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    onUpdate(getStoredMakes());
    return () => {};
  }
  return onSnapshot(
    collection(db, MAKES_COLLECTION),
    (snapshot) => {
      // An empty answer from an empty offline cache says nothing: keep this device's copy.
      if (snapshot.empty && snapshot.metadata.fromCache) {
        onUpdate(getStoredMakes());
        return;
      }
      const makes: Make[] = [];
      snapshot.forEach((docSnap) => {
        const make = parseMake(docSnap.data());
        if (make && make.id === docSnap.id) makes.push(make);
      });
      makes.sort((a, b) => b.createdAt - a.createdAt);
      saveMakes(makes, { photosInCloud: true });
      onUpdate(makes);
    },
    (error) => {
      console.warn('Makes subscription error (falling back to the copy on this device):', error);
      onUpdate(getStoredMakes());
    },
  );
}

// The fields a maker writes. Saving clears the ones a make no longer has, and leaves everyone's
// hearts alone, so a heart given while the maker was editing isn't lost.
const MAKE_FIELDS = [
  'id',
  'recipeId',
  'title',
  'note',
  'photo',
  'madeOn',
  'ownerEmail',
  'ownerName',
  'ownerNameAsTyped',
  'sourceLanguage',
  'translations',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;

/** Saves a make its maker added, edited, deleted or restored. Never its hearts. */
export async function saveMakeToCloud(make: Make): Promise<void> {
  if (make.photoOmitted) {
    throw new Error(`Refusing to save make ${make.id} from a copy without its photo`);
  }
  if (!isFirebaseConfigured || !db) return;
  const data: Record<string, unknown> = {};
  for (const field of MAKE_FIELDS) {
    const value = make[field];
    data[field] = value === undefined ? deleteField() : value;
  }
  // Each field replaced whole (a merge would blend old translation entries into new ones).
  await setDoc(doc(db, MAKES_COLLECTION, make.id), data, { mergeFields: [...MAKE_FIELDS] });
}

/**
 * Stores a make's finished translation, only while the cloud's words are still what was
 * translated: a translation of older words never lands on newer ones. Resolves to whether it
 * wrote.
 */
export async function saveMakeTranslationToCloud(
  makeId: string,
  sourceLanguage: Language,
  translation: MakeTranslation,
): Promise<boolean> {
  const firestore = db;
  if (!isFirebaseConfigured || !firestore) return false;
  const target: Language = sourceLanguage === 'en' ? 'pl' : 'en';
  const ref = doc(firestore, MAKES_COLLECTION, makeId);
  return runTransaction(firestore, async (tx) => {
    const current = await tx.get(ref);
    const make = current.exists() ? parseMake(current.data()) : null;
    if (!make || makeSourceHash(make) !== translation.sourceHash) return false;
    tx.update(ref, {
      sourceLanguage,
      [`translations.${target}`]: translation,
      [`translations.${sourceLanguage}`]: deleteField(),
    });
    return true;
  });
}

/** Gives (`on`) or takes back this person's heart on a make. Touches only their own heart. */
export async function setMakeHeartInCloud(makeId: string, email: string, on: boolean) {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(
    doc(db, MAKES_COLLECTION, makeId),
    new FieldPath('hearts', heartKey(email)),
    on ? true : deleteField(),
  );
}
