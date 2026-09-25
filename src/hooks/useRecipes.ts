import { useState, useCallback } from 'react';
import { Recipe, Language } from '../types/recipe';
import { getStoredRecipes, saveRecipes } from '../services/storage';
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

  const selectedRecipe =
    recipes.find((r) => r.id === selectedRecipeId) || null;

  const addRecipe = useCallback((newRecipe: Omit<Recipe, 'id' | 'createdAt'>) => {
    const recipeWithId: Recipe = {
      ...newRecipe,
      id: 'recipe-' + Date.now(),
      createdAt: Date.now(),
    };

    setRecipes((prev) => {
      const updated = [recipeWithId, ...prev];
      saveRecipes(updated);
      return updated;
    });

    setSelectedRecipeId(recipeWithId.id);
    return recipeWithId;
  }, []);

  const translateSelectedRecipe = useCallback(
    async (recipe: Recipe) => {
      if (recipe.translations?.pl || isTranslating) return;
      setIsTranslating(true);
      try {
        const translatedContent = await translateRecipeToPolish(recipe);
        setRecipes((prev) => {
          const updated = prev.map((r) => {
            if (r.id === recipe.id) {
              return {
                ...r,
                translations: {
                  ...r.translations,
                  pl: translatedContent,
                },
              };
            }
            return r;
          });
          saveRecipes(updated);
          return updated;
        });
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
    translateSelectedRecipe,
    isTranslating,
  };
}
