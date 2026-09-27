import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteField,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Language, LocalizedRecipeContent, Recipe } from '../types/recipe';
import { getStoredRecipes, saveRecipes as saveToLocalStorage } from './storage';

const RECIPES_COLLECTION = 'recipes';

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
      saveToLocalStorage(cloudRecipes);
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
 * Saves a recipe document to Cloud Firestore.
 */
export async function saveRecipeToCloud(recipe: Recipe): Promise<void> {
  // Always update local cache immediately
  const local = getStoredRecipes();
  const existingIdx = local.findIndex((r) => r.id === recipe.id);
  const updatedLocal =
    existingIdx !== -1 ? local.map((r) => (r.id === recipe.id ? recipe : r)) : [recipe, ...local];
  saveToLocalStorage(updatedLocal);

  if (!isFirebaseConfigured || !db) return;

  const docRef = doc(db, RECIPES_COLLECTION, recipe.id);
  await setDoc(docRef, recipe, { merge: true });
}

/**
 * Stores a finished translation. Writes only the translation fields, so it can't overwrite an
 * edit made meanwhile and doesn't count as a new version. Also removes any leftover entry for
 * the source language (a merge save keeps it after a recipe is re-written in the other language).
 */
export async function saveTranslationToCloud(
  recipeId: string,
  sourceLanguage: Language,
  translation: LocalizedRecipeContent,
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;

  const target: Language = sourceLanguage === 'en' ? 'pl' : 'en';
  await updateDoc(doc(db, RECIPES_COLLECTION, recipeId), {
    sourceLanguage,
    [`translations.${target}`]: translation,
    [`translations.${sourceLanguage}`]: deleteField(),
  });
}

/**
 * Deletes a recipe document from Cloud Firestore.
 */
export async function deleteRecipeFromCloud(id: string): Promise<void> {
  const local = getStoredRecipes();
  saveToLocalStorage(local.filter((r) => r.id !== id));

  if (!isFirebaseConfigured || !db) return;

  const docRef = doc(db, RECIPES_COLLECTION, id);
  await deleteDoc(docRef);
}
