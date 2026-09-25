import { describe, it, expect, beforeEach } from 'vitest';
import { Recipe } from '../types/recipe';
import { saveRecipes, getStoredRecipes } from '../services/storage';

describe('Recipe Versioning & Step Notes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('supports step-level notes, photos, and captions in recipe model', () => {
    const recipe: Recipe = {
      id: 'test-recipe-1',
      name: 'Artisan Rye',
      author: 'Baker Tom',
      category: 'breads',
      version: 1,
      heroImage: 'test.jpg',
      yieldHeader: 'For 1 loaf:',
      ingredients: [{ text: 'Rye Flour - 400g' }],
      tips: 'Use warm water.',
      notes: 'Requires long fermentation.',
      steps: [
        {
          num: 1,
          text: 'Mix rye flour with warm water and starter.',
          notes: 'Consistency will feel like wet cement, which is normal.',
          hasImage: true,
          imageSrc: 'data:image/jpeg;base64,sample',
          imageCaption: 'Wet cement texture',
        },
        {
          num: 2,
          text: 'Ferment for 12 hours.',
        },
      ],
    };

    saveRecipes([recipe]);
    const loaded = getStoredRecipes();
    const target = loaded.find((r) => r.id === 'test-recipe-1');

    expect(target).toBeDefined();
    expect(target?.steps[0].notes).toBe('Consistency will feel like wet cement, which is normal.');
    expect(target?.steps[0].hasImage).toBe(true);
    expect(target?.steps[0].imageCaption).toBe('Wet cement texture');
  });

  it('correctly tracks version increments and historical archive upon editing', () => {
    const v1Recipe: Recipe = {
      id: 'recipe-version-test',
      name: 'Family Sourdough',
      author: 'Wanda',
      category: 'family',
      version: 1,
      heroImage: '',
      yieldHeader: 'For 1 loaf:',
      ingredients: [{ text: 'Flour - 500g' }, { text: 'Water - 350g' }],
      steps: [{ num: 1, text: 'Mix ingredients.' }],
      createdAt: 1000,
      updatedAt: 1000,
    };

    // Simulate an edit to create v2
    const v2Recipe: Recipe = {
      ...v1Recipe,
      version: 2,
      ingredients: [
        { text: 'Flour - 500g' },
        { text: 'Water - 375g' }, // hydration adjusted
        { text: 'Salt - 10g' },
      ],
      history: [
        {
          version: 1,
          savedAt: 1000,
          recipe: { ...v1Recipe },
          changeNote: 'Initial family recipe version',
        },
      ],
      updatedAt: 2000,
    };

    saveRecipes([v2Recipe]);
    const stored = getStoredRecipes();
    const retrieved = stored.find((r) => r.id === 'recipe-version-test');

    expect(retrieved?.version).toBe(2);
    expect(retrieved?.ingredients.length).toBe(3);
    expect(retrieved?.history).toBeDefined();
    expect(retrieved?.history?.length).toBe(1);
    expect(retrieved?.history?.[0].version).toBe(1);
    expect(retrieved?.history?.[0].recipe.ingredients.length).toBe(2);
  });
});
