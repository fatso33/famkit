import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  getStoredVaultSort,
  setStoredVaultSort,
  getStoredVaultView,
  setStoredVaultView,
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

  describe('when the photos outgrow this device', () => {
    // About 5.2M characters of photos: more than a browser lets a site keep (about 5M).
    const bigVault = (): Recipe[] =>
      Array.from({ length: 40 }, (_, i) => ({
        id: `r${i}`,
        name: `Recipe ${String(i).padStart(2, '0')}`,
        author: 'Raye',
        category: 'mains',
        heroImage: `data:image/jpeg;base64,${String(i % 10).repeat(130_000)}`,
        yieldHeader: 'Serves 4:',
        ingredients: [{ text: 'Flour - 2 cups' }],
        steps: [{ num: 1, text: 'Mix.' }],
        createdAt: 1000 + i,
        updatedAt: 1000 + i,
      }));

    it('keeps every recipe, with photos for the newest, when the cloud has the rest', () => {
      setStoredVaultSort({ by: 'changed', reversed: false });
      const vault = bigVault();
      saveRecipes(vault, { photosInCloud: true });

      const stored = getStoredRecipes();
      expect(stored.map((r) => r.id)).toEqual(vault.map((r) => r.id));
      const newest = stored.find((r) => r.id === 'r39')!;
      expect(newest.heroImage).toBe(vault[39].heroImage);
      expect(newest.photosOmitted).toBeUndefined();
      const oldest = stored.find((r) => r.id === 'r0')!;
      expect(oldest.heroImage).toBe('');
      expect(oldest.photosOmitted).toEqual({ hero: true });
    });

    it('keeps photos for the recipes first in the order this device sorts the vault', () => {
      setStoredVaultSort({ by: 'name', reversed: false });
      saveRecipes(bigVault(), { photosInCloud: true });

      const stored = getStoredRecipes();
      expect(stored.find((r) => r.id === 'r0')!.photosOmitted).toBeUndefined();
      expect(stored.find((r) => r.id === 'r39')!.photosOmitted).toEqual({ hero: true });
    });

    it('keeps just the words when little room is left, and nothing out of date when none is', () => {
      const setItem = Storage.prototype.setItem;
      let room = 100_000;
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
      ) {
        if (value.length > room) throw new DOMException('Storage full', 'QuotaExceededError');
        setItem.call(this, key, value);
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        saveRecipes(bigVault(), { photosInCloud: true });
        const stored = getStoredRecipes();
        expect(stored).toHaveLength(40);
        expect(stored.every((r) => r.photosOmitted)).toBe(true);

        room = 0;
        saveRecipes(bigVault(), { photosInCloud: true });
        expect(localStorage.getItem('wandas_recipes')).toBeNull();
      } finally {
        spy.mockRestore();
        vi.mocked(console.warn).mockRestore();
      }
    });

    it('never leaves photos out when this device is the only copy', () => {
      const small = bigVault().slice(0, 2);
      saveRecipes(small);
      saveRecipes(bigVault());
      expect(getStoredRecipes()).toEqual(small);
    });
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

  it("keeps the vault's sort and layout, falling back to by category as a list", () => {
    expect(getStoredVaultSort()).toEqual({ by: 'category', reversed: false });
    expect(getStoredVaultView()).toBe('list');

    setStoredVaultSort({ by: 'cook', reversed: true });
    setStoredVaultView('cards');
    expect(getStoredVaultSort()).toEqual({ by: 'cook', reversed: true });
    expect(getStoredVaultView()).toBe('cards');

    localStorage.setItem('family_kitchen_vault_sort', 'by-colour');
    expect(getStoredVaultSort()).toEqual({ by: 'category', reversed: false });
  });

  it('clears a Gemini API key left over from the old Settings field', () => {
    localStorage.setItem('wandas_gemini_api_key', 'AIzaSyTestKey123');
    clearLegacyApiKey();
    expect(localStorage.getItem('wandas_gemini_api_key')).toBeNull();
  });
});
