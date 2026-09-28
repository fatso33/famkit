import { useState, useCallback, useEffect, useRef } from 'react';
import { Recipe, RecipeVersion, Language } from '../types/recipe';
import {
  getStoredRecipes,
  getTranslationFailures,
  recordTranslationFailure,
  saveRecipes,
} from '../services/storage';
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
import type { CurrentUser } from './useCurrentUser';
import { isTranslationAvailable, translatePieces } from '../services/gemini';
import { isFirebaseConfigured } from '../services/firebase';
import {
  PieceTranslation,
  TRANSLATION_GRACE_MS,
  TranslationRejectedError,
  applyTranslation,
  languageSettled,
  localizeRecipe,
  needsTranslation,
  otherLanguage,
  pendingPieces,
  retryDelayMs,
  shouldTranslateNow,
  sourceHash,
  sourceLanguageOf,
  translationFitsRecipe,
} from '../utils/recipeTranslation';
import { fnv1a, pieceHash } from '../utils/translationPieces';

export function getLocalizedRecipe(
  recipe: Recipe | null | undefined,
  lang: Language = 'en',
): Recipe | null {
  return recipe ? localizeRecipe(recipe, lang) : null;
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
export function useRecipes(currentUser: CurrentUser | null) {
  const [recipes, setRecipes] = useState<Recipe[]>(getStoredRecipes);
  // The latest list, for callbacks that must build on it (an edit needs the version it replaces).
  const latestRecipes = useRef(recipes);
  useEffect(() => {
    latestRecipes.current = recipes;
  }, [recipes]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Background translation bookkeeping (see the effect below).
  const triedKeys = useRef(new Set<string>());
  // Recipe id → text fingerprint this device saved. A later edit from another phone changes the
  // fingerprint, so it no longer counts as "saved here" (no grace-period skip).
  const savedOnThisDevice = useRef(new Map<string, string>());
  const translationInFlight = useRef(false);
  const [translationScan, setTranslationScan] = useState(0);

  // Subscribe to real-time Cloud Firestore updates
  useEffect(() => {
    const unsubscribe = subscribeToRecipes((updatedRecipes) => {
      setRecipes((prev) => keepLoadedPhotos(prev, updatedRecipes));
    });

    return () => unsubscribe();
  }, []);

  // Translates new and edited recipes into their other language, one at a time, and only the
  // pieces that have no translation yet. Each request is tried once per session; coming back
  // online or reopening the app retries lost connections, and an unusable answer waits longer.
  useEffect(() => {
    if (!isTranslationAvailable || translationInFlight.current) return;

    const now = Date.now();
    const failures = getTranslationFailures();
    let nextCheckIn = Infinity;
    let job: { recipe: Recipe; hash: string; key: string } | null = null;
    for (const recipe of recipes) {
      // Every synced recipe has an owner, so one without is a stale copy cached from before
      // (e.g. Wanda's, whose hand-written Polish wasn't stamped yet). Its cloud version is coming.
      if (isFirebaseConfigured && !recipe.ownerEmail) continue;
      if (isDeleted(recipe)) continue;
      if (!needsTranslation(recipe)) continue;
      const hash = sourceHash(recipe);
      const key = `${recipe.id}@${hash}@${fnv1a(pendingPieces(recipe).map(pieceHash).join())}`;
      if (triedKeys.current.has(key)) continue;
      const failure = failures[key];
      if (failure && now - failure.at < retryDelayMs(failure.count)) continue;
      if (!shouldTranslateNow(recipe, now, savedOnThisDevice.current.get(recipe.id) === hash)) {
        const changedAt = recipe.updatedAt ?? recipe.createdAt ?? 0;
        nextCheckIn = Math.min(nextCheckIn, changedAt + TRANSLATION_GRACE_MS - now);
        continue;
      }
      job = { recipe, hash, key };
      break;
    }

    if (!job) {
      // Someone else saved recently: give their phone the chance to translate first.
      if (nextCheckIn === Infinity) return;
      const timer = window.setTimeout(
        () => setTranslationScan((n) => n + 1),
        Math.max(1000, nextCheckIn),
      );
      return () => window.clearTimeout(timer);
    }

    const { recipe, hash, key } = job;
    const savedHere = savedOnThisDevice.current.get(recipe.id) === hash;
    triedKeys.current.add(key);
    translationInFlight.current = true;

    // A settled recipe's language is known; a new one's is checked by the translator.
    const language = languageSettled(recipe) ? sourceLanguageOf(recipe) : undefined;
    const pieces = pendingPieces(recipe);
    // Every piece already translated (e.g. steps only moved): rebuilt here, with no request.
    const work: Promise<PieceTranslation> =
      pieces.length > 0
        ? translatePieces(recipe, pieces, language)
        : Promise.resolve({ detectedLanguage: sourceLanguageOf(recipe), values: new Map() });

    work
      .then((result) => {
        if (!language && !translationFitsRecipe(recipe, result)) {
          throw new TranslationRejectedError(
            `A translation of recipe ${recipe.id} named the wrong language`,
          );
        }
        // Edited or synced meanwhile: the new text gets its own translation.
        const current = latestRecipes.current.find((r) => r.id === recipe.id);
        if (!current || sourceHash(current) !== hash) return;

        const updated = applyTranslation(current, result, hash);
        const lang = sourceLanguageOf(updated);
        setRecipes((prev) => {
          const next = prev.map((r) =>
            r.id === recipe.id ? applyTranslation(r, result, hash) : r,
          );
          saveRecipes(next, { photosInCloud: hasCloud });
          return next;
        });
        saveTranslationToCloud(recipe.id, lang, updated.translations![otherLanguage(lang)]!).catch(
          (err) => {
            console.warn('Failed to sync recipe translation to cloud (retained locally):', err);
          },
        );
        if (savedHere) savedOnThisDevice.current.delete(recipe.id);
      })
      .catch((err: unknown) => {
        if (err instanceof TranslationRejectedError) recordTranslationFailure(key, Date.now());
        console.warn('Recipe translation failed (showing the original):', err);
      })
      .finally(() => {
        translationInFlight.current = false;
        setTranslationScan((n) => n + 1);
      });
  }, [recipes, translationScan]);

  // Back online: retry translations that failed while offline.
  useEffect(() => {
    const handleOnline = () => {
      triedKeys.current.clear();
      setTranslationScan((n) => n + 1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Deleted recipes stay in the vault (for restoring) but aren't shown.
  const visibleRecipes = recipes.filter((r) => !isDeleted(r));
  const selectedRecipe = visibleRecipes.find((r) => r.id === selectedRecipeId) || null;

  const addRecipe = useCallback(
    (newRecipe: Omit<Recipe, 'id' | 'createdAt'>): Recipe => {
      const recipeWithId: Recipe = {
        ...newRecipe,
        ownerEmail: currentUser?.email,
        ownerName: currentUser?.name,
        id: 'recipe-' + Date.now(),
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
  const updateRecipe = useCallback((recipeUpdates: Recipe, note = ''): Recipe | null => {
    const existing = latestRecipes.current.find((r) => r.id === recipeUpdates.id);
    if (!canSaveOver(existing) || !canSaveOver(recipeUpdates)) return null;
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
    });

    return finalRecipe;
  }, []);

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
