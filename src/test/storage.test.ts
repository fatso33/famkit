import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredRecipes,
  saveRecipes,
  getStoredLanguage,
  setStoredLanguage,
  getStoredTheme,
  setStoredTheme,
  getStoredFontScale,
  setStoredFontScale,
  getStoredApiKey,
  setStoredApiKey,
} from '../services/storage';
import { DEFAULT_RECIPE } from '../data/defaultRecipe';
import { Recipe } from '../types/recipe';

describe('storage service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with DEFAULT_RECIPE if localStorage is empty', () => {
    const recipes = getStoredRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(1);
    expect(recipes[0].id).toBe(DEFAULT_RECIPE.id);
  });

  it('persists and retrieves custom recipes', () => {
    const customRecipe: Recipe = {
      id: 'custom-1',
      name: "Grandma's Apple Pie",
      author: 'Grandma M.',
      category: 'family',
      heroImage: '',
      yieldHeader: 'Serves 8:',
      ingredients: [{ text: 'Apples - 6 large' }],
      steps: [{ num: 1, text: 'Slice apples and bake.' }],
    };

    saveRecipes([DEFAULT_RECIPE, customRecipe]);
    const stored = getStoredRecipes();
    expect(stored.length).toBe(2);
    expect(stored[1].name).toBe("Grandma's Apple Pie");
  });

  it('correctly persists language preferences', () => {
    expect(getStoredLanguage()).toBe('en');
    setStoredLanguage('pl');
    expect(getStoredLanguage()).toBe('pl');
  });

  it('correctly persists theme preferences', () => {
    setStoredTheme('dark');
    expect(getStoredTheme()).toBe('dark');
    setStoredTheme('light');
    expect(getStoredTheme()).toBe('light');
  });

  it('clamps and persists font scaling', () => {
    setStoredFontScale(1.25);
    expect(getStoredFontScale()).toBe(1.25);

    setStoredFontScale(3.0); // Above max 1.4
    expect(getStoredFontScale()).toBe(1.4);

    setStoredFontScale(0.2); // Below min 0.85
    expect(getStoredFontScale()).toBe(0.85);
  });

  it('persists and clears Gemini API key', () => {
    expect(getStoredApiKey()).toBe('');
    setStoredApiKey('AIzaSyTestKey123');
    expect(getStoredApiKey()).toBe('AIzaSyTestKey123');
    setStoredApiKey('');
    expect(getStoredApiKey()).toBe('');
  });
});
