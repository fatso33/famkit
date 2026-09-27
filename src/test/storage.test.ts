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
  clearLegacyApiKey,
} from '../services/storage';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { Recipe } from '../types/recipe';

describe('storage service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with an empty vault: no recipe is built into the app', () => {
    expect(getStoredRecipes()).toEqual([]);
  });

  it('keeps stored recipes exactly as saved', () => {
    const edited = { ...WANDAS_CHEESE_BREAD, tips: 'Grease the pot first.' };
    saveRecipes([edited]);
    expect(getStoredRecipes()).toEqual([edited]);
  });

  it('starts empty rather than crashing on corrupt storage', () => {
    localStorage.setItem('wandas_recipes', '{not json');
    expect(getStoredRecipes()).toEqual([]);
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

    saveRecipes([WANDAS_CHEESE_BREAD, customRecipe]);
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

  it('clears a Gemini API key left over from the old Settings field', () => {
    localStorage.setItem('wandas_gemini_api_key', 'AIzaSyTestKey123');
    clearLegacyApiKey();
    expect(localStorage.getItem('wandas_gemini_api_key')).toBeNull();
  });
});
