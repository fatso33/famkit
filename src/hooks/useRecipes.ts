import { useState, useCallback, useEffect, useRef } from 'react';
import { Recipe, Language } from '../types/recipe';
import { getStoredRecipes, saveRecipes } from '../services/storage';
import {
  subscribeToRecipes,
  saveRecipeToCloud,
  saveTranslationToCloud,
  deleteRecipeFromCloud,
} from '../services/firestore';
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

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) || null;

  const addRecipe = useCallback(
    (newRecipe: Omit<Recipe, 'id' | 'createdAt'>): Recipe => {
      const recipeWithId: Recipe = {
        ...newRecipe,
        ownerEmail: currentUser?.email,
        ownerName: currentUser?.name,
        id: 'recipe-' + Date.now(),
        version: 1,
        history: [],
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

  const updateRecipe = useCallback((recipeUpdates: Recipe): Recipe => {
    let finalRecipe: Recipe = recipeUpdates;
    savedOnThisDevice.current.set(recipeUpdates.id, sourceHash(recipeUpdates));

    setRecipes((prev) => {
      const existing = prev.find((r) => r.id === recipeUpdates.id);
      const currentVersion = existing?.version || 1;
      const newVersion = currentVersion + 1;

      const historyEntry = existing
        ? [
            {
              version: currentVersion,
              savedAt: existing.updatedAt || existing.createdAt || Date.now(),
              recipe: {
                id: existing.id,
                name: existing.name,
                author: existing.author,
                authorMode: existing.authorMode,
                category: existing.category,
                heroImage: existing.heroImage?.startsWith('data:') ? '' : existing.heroImage || '',
                yieldHeader: existing.yieldHeader,
                baseYield: existing.baseYield,
                ingredients: existing.ingredients,
                cardDescription: existing.cardDescription,
                tips: existing.tips,
                steps: (existing.steps || []).map((st) => ({
                  ...st,
                  imageSrc: st.imageSrc?.startsWith('data:') ? '' : st.imageSrc,
                })),
                laminationDirective: existing.laminationDirective,
                bakingOptions: existing.bakingOptions,
                notes: existing.notes,
                sourceLanguage: existing.sourceLanguage,
                translations: existing.translations,
                createdAt: existing.createdAt,
                version: existing.version,
              },
            },
            ...(existing.history || []),
          ]
        : [];

      finalRecipe = {
        ...recipeUpdates,
        version: newVersion,
        history: historyEntry,
        updatedAt: Date.now(),
      };

      const updated = prev.map((r) => (r.id === finalRecipe.id ? finalRecipe : r));
      saveRecipes(updated);
      return updated;
    });

    // Async sync to Cloud Firestore in background
    saveRecipeToCloud(finalRecipe).catch((err) => {
      console.warn('Failed to sync updated recipe to cloud (retained locally):', err);
    });

    return finalRecipe;
  }, []);

  const deleteRecipe = useCallback(
    async (id: string) => {
      setRecipes((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        saveRecipes(updated);
        return updated;
      });

      if (selectedRecipeId === id) {
        setSelectedRecipeId(null);
      }

      try {
        await deleteRecipeFromCloud(id);
      } catch (err) {
        console.warn('Failed to delete recipe from cloud:', err);
      }
    },
    [selectedRecipeId],
  );

  return {
    recipes,
    selectedRecipe,
    selectedRecipeId,
    setSelectedRecipeId,
    addRecipe,
    updateRecipe,
    deleteRecipe,
  };
}
