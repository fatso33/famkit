import { useState, useCallback, useEffect } from 'react';
import { Recipe, Language } from '../types/recipe';
import { getStoredRecipes, saveRecipes } from '../services/storage';
import {
  subscribeToRecipes,
  saveRecipeToCloud,
  deleteRecipeFromCloud,
} from '../services/firestore';
import { translateRecipeToPolish } from '../services/gemini';

export function getLocalizedRecipe(
  recipe: Recipe | null | undefined,
  lang: Language = 'en'
): Recipe | null {
  if (!recipe) return null;
  if (lang === 'pl' && recipe.translations && recipe.translations.pl) {
    const tr = recipe.translations.pl;
    return {
      ...recipe,
      name: tr.name || recipe.name,
      cardDescription: tr.cardDescription || recipe.cardDescription,
      yieldHeader: tr.yieldHeader || recipe.yieldHeader,
      tips: tr.tips !== undefined ? tr.tips : recipe.tips,
      notes: tr.notes !== undefined ? tr.notes : recipe.notes,
      laminationDirective:
        tr.laminationDirective !== undefined
          ? tr.laminationDirective
          : recipe.laminationDirective,
      ingredients:
        tr.ingredients && tr.ingredients.length > 0
          ? tr.ingredients
          : recipe.ingredients,
      steps: tr.steps && tr.steps.length > 0 ? tr.steps : recipe.steps,
      bakingOptions: tr.bakingOptions || recipe.bakingOptions,
    };
  }
  return recipe;
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(getStoredRecipes);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Subscribe to real-time Cloud Firestore updates
  useEffect(() => {
    const unsubscribe = subscribeToRecipes((updatedRecipes) => {
      setRecipes(updatedRecipes);
    });

    return () => unsubscribe();
  }, []);

  const selectedRecipe =
    recipes.find((r) => r.id === selectedRecipeId) || null;

  const addRecipe = useCallback(
    (newRecipe: Omit<Recipe, 'id' | 'createdAt'>): Recipe => {
      const recipeWithId: Recipe = {
        ...newRecipe,
        id: 'recipe-' + Date.now(),
        version: 1,
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

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
    []
  );

  const updateRecipe = useCallback(
    (recipeUpdates: Recipe): Recipe => {
      let finalRecipe: Recipe = recipeUpdates;

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
                  category: existing.category,
                  heroImage: existing.heroImage,
                  yieldHeader: existing.yieldHeader,
                  baseYield: existing.baseYield,
                  ingredients: existing.ingredients,
                  cardDescription: existing.cardDescription,
                  tips: existing.tips,
                  steps: existing.steps,
                  laminationDirective: existing.laminationDirective,
                  bakingOptions: existing.bakingOptions,
                  notes: existing.notes,
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
    },
    []
  );

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
    [selectedRecipeId]
  );

  const translateSelectedRecipe = useCallback(
    async (recipe: Recipe) => {
      if (recipe.translations?.pl || isTranslating) return;
      setIsTranslating(true);
      try {
        const translatedContent = await translateRecipeToPolish(recipe);
        const updatedRecipe: Recipe = {
          ...recipe,
          translations: {
            ...recipe.translations,
            pl: translatedContent,
          },
        };

        setRecipes((prev) => {
          const updated = prev.map((r) => (r.id === recipe.id ? updatedRecipe : r));
          saveRecipes(updated);
          return updated;
        });

        // Persist translated version to Firestore
        await saveRecipeToCloud(updatedRecipe);
      } finally {
        setIsTranslating(false);
      }
    },
    [isTranslating]
  );

  return {
    recipes,
    selectedRecipe,
    selectedRecipeId,
    setSelectedRecipeId,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    translateSelectedRecipe,
    isTranslating,
  };
}
