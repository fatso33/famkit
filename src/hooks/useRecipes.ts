import { useState, useCallback, useEffect, useRef } from 'react';
import { Recipe, RecipeVersion, Language } from '../types/recipe';
import { getStoredRecipes, saveRecipes } from '../services/storage';
import {
  subscribeToRecipes,
  saveRecipeToCloud,
  saveTranslationToCloud,
  fetchRecipeVersion,
  fetchRecipeFromServer,
} from '../services/firestore';
import { legacyVersions, prepareEdit } from '../utils/recipeVersions';
import { WANDA_REPAIR_NOTE, needsWandaRepair, repairWanda } from '../utils/wandaRepair';
import { isDeleted, withDeletedAt } from '../utils/recipeTrash';
import type { CurrentUser } from './useCurrentUser';
import { isTranslationAvailable, translateRecipe } from '../services/gemini';
import { isFirebaseConfigured } from '../services/firebase';
import {
  TRANSLATION_GRACE_MS,
  applyTranslation,
  localizeRecipe,
  needsTranslation,
  shouldTranslateNow,
  sourceHash,
  translationFitsRecipe,
} from '../utils/recipeTranslation';

export function getLocalizedRecipe(
  recipe: Recipe | null | undefined,
  lang: Language = 'en',
): Recipe | null {
  return recipe ? localizeRecipe(recipe, lang) : null;
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
      setRecipes(updatedRecipes);
    });

    return () => unsubscribe();
  }, []);

  // Translates new and edited recipes into their other language, one at a time. Each recipe
  // text is tried once per session; coming back online or reopening the app retries failures.
  useEffect(() => {
    if (!isTranslationAvailable || translationInFlight.current) return;

    const now = Date.now();
    let nextCheckIn = Infinity;
    let job: { recipe: Recipe; hash: string } | null = null;
    for (const recipe of recipes) {
      // Every synced recipe has an owner, so one without is a stale copy cached from before
      // (e.g. Wanda's, whose hand-written Polish wasn't stamped yet). Its cloud version is coming.
      if (isFirebaseConfigured && !recipe.ownerEmail) continue;
      if (isDeleted(recipe)) continue;
      if (!needsTranslation(recipe)) continue;
      const hash = sourceHash(recipe);
      if (triedKeys.current.has(`${recipe.id}@${hash}`)) continue;
      if (!shouldTranslateNow(recipe, now, savedOnThisDevice.current.get(recipe.id) === hash)) {
        const changedAt = recipe.updatedAt ?? recipe.createdAt ?? 0;
        nextCheckIn = Math.min(nextCheckIn, changedAt + TRANSLATION_GRACE_MS - now);
        continue;
      }
      job = { recipe, hash };
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

    const { recipe, hash } = job;
    const savedHere = savedOnThisDevice.current.get(recipe.id) === hash;
    triedKeys.current.add(`${recipe.id}@${hash}`);
    translationInFlight.current = true;

    translateRecipe(recipe)
      .then((result) => {
        if (!translationFitsRecipe(recipe, result)) {
          console.warn(
            `Discarded a translation of recipe ${recipe.id} that named the wrong language (showing the original)`,
          );
          return;
        }
        // Edited or synced meanwhile: the new text gets its own translation.
        const current = latestRecipes.current.find((r) => r.id === recipe.id);
        if (!current || sourceHash(current) !== hash) return;

        setRecipes((prev) => {
          const updated = prev.map((r) =>
            r.id === recipe.id ? applyTranslation(r, result, hash) : r,
          );
          saveRecipes(updated);
          return updated;
        });
        saveTranslationToCloud(recipe.id, result.detectedLanguage, {
          ...result.content,
          sourceHash: hash,
        }).catch((err) => {
          console.warn('Failed to sync recipe translation to cloud (retained locally):', err);
        });
        if (savedHere) savedOnThisDevice.current.delete(recipe.id);
      })
      .catch((err: unknown) => {
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
        saveRecipes(updated);
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
   * so the owner can restore it later. `note` is the optional "what changed".
   */
  const updateRecipe = useCallback((recipeUpdates: Recipe, note = ''): Recipe => {
    savedOnThisDevice.current.set(recipeUpdates.id, sourceHash(recipeUpdates));

    const existing = latestRecipes.current.find((r) => r.id === recipeUpdates.id);
    const now = Date.now();
    const { recipe: finalRecipe, newVersions } = existing
      ? prepareEdit(existing, recipeUpdates, note, now)
      : { recipe: { ...recipeUpdates, updatedAt: now }, newVersions: [] };

    setRecipes((prev) => {
      const updated = prev.map((r) => (r.id === finalRecipe.id ? finalRecipe : r));
      saveRecipes(updated);
      return updated;
    });

    // Async sync to Cloud Firestore in background
    saveRecipeToCloud(finalRecipe, newVersions).catch((err) => {
      console.warn('Failed to sync updated recipe to cloud (retained locally):', err);
    });

    return finalRecipe;
  }, []);

  // One-time repair of Wanda's Cheese Bread on its owner's device (see utils/wandaRepair). It
  // checks the server's copy first, so a stale cached copy never overwrites a newer edit.
  const repairTried = useRef(false);
  useEffect(() => {
    if (repairTried.current) return;
    const broken = recipes.find((r) => needsWandaRepair(r, currentUser));
    if (!broken) return;
    repairTried.current = true;
    fetchRecipeFromServer(broken.id)
      .then((server) => {
        if (server && needsWandaRepair(server, currentUser)) {
          updateRecipe(repairWanda(server), WANDA_REPAIR_NOTE);
        }
      })
      .catch((err: unknown) => {
        console.warn("Could not repair Wanda's Cheese Bread (retries next launch):", err);
      });
  }, [recipes, currentUser, updateRecipe]);

  /** One earlier version of a recipe, for the owner to restore. Rejects when it can't be loaded. */
  const loadVersion = useCallback(
    async (recipe: Recipe, versionId: string): Promise<RecipeVersion> =>
      legacyVersions(recipe).find((v) => v.id === versionId) ??
      fetchRecipeVersion(recipe.id, versionId),
    [],
  );

  /**
   * Deletes (`deleted`) or restores a recipe. Nothing is erased: the recipe is only marked, so it
   * stays restorable. Not a content change, so no new version.
   */
  const setRecipeDeleted = useCallback((id: string, deleted: boolean) => {
    const existing = latestRecipes.current.find((r) => r.id === id);
    if (!existing) return;
    const updated = withDeletedAt(existing, deleted ? Date.now() : undefined);

    setRecipes((prev) => {
      const next = prev.map((r) => (r.id === id ? updated : r));
      saveRecipes(next);
      return next;
    });

    saveRecipeToCloud(updated).catch((err) => {
      console.warn(`Failed to sync recipe ${deleted ? 'deletion' : 'restore'} to cloud:`, err);
    });
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
