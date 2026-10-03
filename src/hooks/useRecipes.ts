import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Recipe, RecipeVersion, Language } from '../types/recipe';
import { getStoredRecipes, saveRecipes, withDeviceRecipePhotos } from '../services/storage';
import { whenDevicePhotosLoad } from '../services/photoStore';
import {
  subscribeToRecipes,
  saveRecipeToCloud,
  saveTranslationToCloud,
  fetchRecipeVersion,
  hasCloud,
} from '../services/firestore';
import { hasLeftOutPhotos, keepLoadedPhotos } from '../utils/deviceCopy';
import { legacyVersions, prepareEdit } from '../utils/recipeVersions';
import { isDeleted, withDeletedAt } from '../utils/recipeTrash';
import { newRecipeId } from '../utils/recipeId';
import type { CurrentUser } from './useCurrentUser';
import { TranslationJob, useTranslationQueue } from './useTranslationQueue';
import { isTranslationAvailable } from '../services/gemini';
import { isFirebaseConfigured } from '../services/firebase';
import {
  PieceTranslation,
  applyTranslation,
  localizeRecipe,
  needsTranslation,
  otherLanguage,
  pendingPieces,
  recipeTranslationDoc,
  sourceHash,
  sourceLanguageOf,
  translationFitsRecipe,
  translationPending,
} from '../utils/recipeTranslation';
import { mayRideAlong, translationDueAt } from '../utils/translationQueue';
import { Piece } from '../utils/translationPieces';
import { ownerCredit } from '../utils/ownership';

export function getLocalizedRecipe(
  recipe: Recipe | null | undefined,
  lang: Language = 'en',
): Recipe | null {
  return recipe ? localizeRecipe(recipe, lang) : null;
}

/**
 * Whether a reader in `lang` is waiting for some of the recipe's words to be translated: only
 * where translation runs (it doesn't without Firebase, e.g. local development).
 */
export function awaitsTranslation(recipe: Recipe, lang: Language): boolean {
  return isTranslationAvailable && translationPending(recipe, lang);
}

/**
 * Whether a save may replace this recipe. Not this device's copy without its photos: the save
 * would write the recipe back without them. The full recipe arrives with the cloud's answer.
 */
function canSaveOver(existing: Recipe | undefined): boolean {
  if (!existing || !hasLeftOutPhotos(existing)) return true;
  console.warn(`Not saving recipe ${existing.id}: its photos haven't loaded on this device yet`);
  return false;
}

/** The vault, kept in sync with Firestore. `currentUser` owns the recipes added here. */
export function useRecipes(
  currentUser: CurrentUser | null,
  /** Other documents waiting for translation (the makes), which share the recipes' requests. */
  extraJobs?: (now: number) => TranslationJob[],
  /**
   * A save the cloud refused (offline saves wait instead, and arrive later): told to the person
   * who saved it, since the family won't see it.
   */
  onCloudSaveFailed?: (recipe: Recipe) => void,
) {
  const latestOnCloudSaveFailed = useRef(onCloudSaveFailed);
  useEffect(() => {
    latestOnCloudSaveFailed.current = onCloudSaveFailed;
  });
  const [recipes, setRecipes] = useState<Recipe[]>(getStoredRecipes);
  // The latest list, for callbacks that must build on it (an edit needs the version it replaces).
  const latestRecipes = useRef(recipes);
  useEffect(() => {
    latestRecipes.current = recipes;
  }, [recipes]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Background translation bookkeeping (see collectRecipeJobs).
  // Recipe id → text fingerprint this device saved. A later edit from another phone changes the
  // fingerprint, so it no longer counts as "saved here" (no head start for this phone).
  const savedOnThisDevice = useRef(new Map<string, string>());
  // "id@text fingerprint" of translations made here: this phone finishes them without waiting.
  const translatedOnThisDevice = useRef(new Set<string>());

  /**
   * Keeps a finished translation, here and in the cloud. Returns the pieces still untranslated,
   * or null when the recipe's words changed meanwhile (the new words get their own).
   */
  const storeTranslation = useCallback(
    (id: string, hash: string, result: PieceTranslation): Piece[] | null => {
      const current = latestRecipes.current.find((r) => r.id === id);
      if (!current || sourceHash(current) !== hash) return null;
      const at = Date.now();
      const updated = applyTranslation(current, result, hash, at);
      const lang = sourceLanguageOf(updated);
      setRecipes((prev) => {
        const next = prev.map((r) => (r.id === id ? applyTranslation(r, result, hash, at) : r));
        saveRecipes(next, { photosInCloud: hasCloud });
        return next;
      });
      saveTranslationToCloud(id, lang, updated.translations![otherLanguage(lang)]!).catch((err) => {
        console.warn('Failed to sync recipe translation to cloud (retained locally):', err);
      });
      translatedOnThisDevice.current.add(`${id}@${hash}`);
      return pendingPieces(updated);
    },
    [],
  );

  // Subscribe to real-time Cloud Firestore updates
  useEffect(() => {
    const unsubscribe = subscribeToRecipes((updatedRecipes) => {
      setRecipes((prev) => keepLoadedPhotos(prev, updatedRecipes));
    });

    return () => unsubscribe();
  }, []);

  // Photos kept on this device that were still being read at the first render (a slow phone).
  useEffect(
    () => whenDevicePhotosLoad(() => setRecipes((prev) => withDeviceRecipePhotos(prev))),
    [],
  );

  // Each recipe waiting for translation, for the queue the family's makes share
  // (hooks/useTranslationQueue): only the pieces with no translation yet, due when
  // utils/translationQueue says.
  const collectRecipeJobs = useCallback(
    (now: number): TranslationJob[] =>
      recipes.flatMap((recipe) => {
        // Every synced recipe has an owner, so one without is a stale copy cached from before
        // (e.g. Wanda's, whose hand-written Polish wasn't stamped yet). Its cloud version is coming.
        if (isFirebaseConfigured && !recipe.ownerEmail) return [];
        if (isDeleted(recipe) || !needsTranslation(recipe)) return [];
        const hash = sourceHash(recipe);
        const here = {
          savedHere: savedOnThisDevice.current.get(recipe.id) === hash,
          translatedHere: translatedOnThisDevice.current.has(`${recipe.id}@${hash}`),
        };
        return [
          {
            id: recipe.id,
            hash,
            pieces: pendingPieces(recipe),
            dueAt: translationDueAt(recipe, here),
            rideAlong: mayRideAlong(recipe, here),
            language: sourceLanguageOf(recipe),
            doc: (pieces, sofar) =>
              recipeTranslationDoc(
                sofar ? applyTranslation(recipe, sofar, hash, now) : recipe,
                pieces,
              ),
            fits: (result) => translationFitsRecipe(recipe, result),
            store: (result) => storeTranslation(recipe.id, hash, result),
          },
        ];
      }),
    [recipes, storeTranslation],
  );
  const collectors = useMemo(
    () => (extraJobs ? [collectRecipeJobs, extraJobs] : [collectRecipeJobs]),
    [collectRecipeJobs, extraJobs],
  );
  useTranslationQueue(collectors);

  // Deleted recipes stay in the vault (for restoring) but aren't shown.
  const visibleRecipes = recipes.filter((r) => !isDeleted(r));
  const selectedRecipe = visibleRecipes.find((r) => r.id === selectedRecipeId) || null;

  const addRecipe = useCallback(
    (newRecipe: Omit<Recipe, 'id' | 'createdAt'>): Recipe => {
      const recipeWithId: Recipe = {
        ...newRecipe,
        ownerEmail: currentUser?.email,
        ...ownerCredit(undefined, currentUser),
        id: newRecipeId(),
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      savedOnThisDevice.current.set(recipeWithId.id, sourceHash(recipeWithId));

      // Optimistic local update
      setRecipes((prev) => {
        const updated = [recipeWithId, ...prev];
        saveRecipes(updated, { photosInCloud: hasCloud });
        return updated;
      });

      setSelectedRecipeId(recipeWithId.id);

      // Async sync to Cloud Firestore in background
      saveRecipeToCloud(recipeWithId).catch((err) => {
        console.warn('Failed to sync new recipe to cloud (retained locally):', err);
        latestOnCloudSaveFailed.current?.(recipeWithId);
      });

      return recipeWithId;
    },
    [currentUser],
  );

  /**
   * Saves an edit as a new version. The version it replaces is backed up whole, photos included,
   * so the owner can restore it later. `note` is the optional "what changed". Returns null, saving
   * nothing, while the recipe is this device's copy without its photos.
   */
  const updateRecipe = useCallback(
    (edited: Recipe, note = ''): Recipe | null => {
      const existing = latestRecipes.current.find((r) => r.id === edited.id);
      if (!canSaveOver(existing) || !canSaveOver(edited)) return null;
      const recipeUpdates = { ...edited, ...ownerCredit(existing ?? edited, currentUser) };
      savedOnThisDevice.current.set(recipeUpdates.id, sourceHash(recipeUpdates));

      const now = Date.now();
      const { recipe: finalRecipe, newVersions } = existing
        ? prepareEdit(existing, recipeUpdates, note, now)
        : { recipe: { ...recipeUpdates, updatedAt: now }, newVersions: [] };

      setRecipes((prev) => {
        const updated = prev.map((r) => (r.id === finalRecipe.id ? finalRecipe : r));
        saveRecipes(updated, { photosInCloud: hasCloud });
        return updated;
      });

      // Async sync to Cloud Firestore in background
      saveRecipeToCloud(finalRecipe, newVersions).catch((err) => {
        console.warn('Failed to sync updated recipe to cloud (retained locally):', err);
        latestOnCloudSaveFailed.current?.(finalRecipe);
      });

      return finalRecipe;
    },
    [currentUser],
  );

  /** One earlier version of a recipe, for the owner to restore. Rejects when it can't be loaded. */
  const loadVersion = useCallback(
    async (recipe: Recipe, versionId: string): Promise<RecipeVersion> =>
      legacyVersions(recipe).find((v) => v.id === versionId) ??
      fetchRecipeVersion(recipe.id, versionId),
    [],
  );

  /**
   * Deletes (`deleted`) or restores a recipe. Nothing is erased: the recipe is only marked, so it
   * stays restorable. Not a content change, so no new version. Returns whether it was done.
   */
  const setRecipeDeleted = useCallback((id: string, deleted: boolean): boolean => {
    const existing = latestRecipes.current.find((r) => r.id === id);
    if (!existing || !canSaveOver(existing)) return false;
    const updated = withDeletedAt(existing, deleted ? Date.now() : undefined);

    setRecipes((prev) => {
      const next = prev.map((r) => (r.id === id ? updated : r));
      saveRecipes(next, { photosInCloud: hasCloud });
      return next;
    });

    saveRecipeToCloud(updated).catch((err) => {
      console.warn(`Failed to sync recipe ${deleted ? 'deletion' : 'restore'} to cloud:`, err);
      latestOnCloudSaveFailed.current?.(updated);
    });
    return true;
  }, []);

  const deleteRecipe = useCallback((id: string) => setRecipeDeleted(id, true), [setRecipeDeleted]);
  const restoreRecipe = useCallback(
    (id: string) => setRecipeDeleted(id, false),
    [setRecipeDeleted],
  );

  return {
    recipes: visibleRecipes,
    /** Every recipe, deleted ones included. */
    allRecipes: recipes,
    selectedRecipe,
    selectedRecipeId,
    setSelectedRecipeId,
    addRecipe,
    updateRecipe,
    loadVersion,
    deleteRecipe,
    restoreRecipe,
  };
}
