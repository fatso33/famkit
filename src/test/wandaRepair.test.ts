import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecipes } from '../hooks/useRecipes';
import { fetchRecipeFromServer, saveRecipeToCloud } from '../services/firestore';
import { Recipe, Step } from '../types/recipe';
import {
  localizeRecipe,
  needsTranslation,
  translatableContent,
  translationStatus,
} from '../utils/recipeTranslation';
import { WANDA_REPAIR_NOTE, needsWandaRepair, repairWanda } from '../utils/wandaRepair';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

// Only I/O is mocked: Firestore, and no translation service.
vi.mock('../services/firebase', () => ({ isFirebaseConfigured: true }));
vi.mock('../services/gemini', () => ({ isTranslationAvailable: false, translateRecipe: vi.fn() }));
vi.mock('../services/firestore', () => ({
  subscribeToRecipes: () => () => {},
  saveRecipeToCloud: vi.fn(() => Promise.resolve()),
  saveTranslationToCloud: vi.fn(() => Promise.resolve(true)),
  fetchRecipeVersion: vi.fn(),
  fetchRecipeFromServer: vi.fn(),
}));

const peter = { email: 'P.Gzowski33@gmail.com', name: 'Peter Gzowski' };
const HERO = 'data:image/jpeg;base64,NEWHERO';
const DOUGH = 'data:image/jpeg;base64,DOUGH';

// The live record as it was found: English labelled Polish, machine Polish filed as English,
// Peter's new hero photo, and his test edit to the name.
const broken: Recipe = {
  ...WANDAS_CHEESE_BREAD,
  name: "Wanda's Cheese Bread (test)",
  heroImage: HERO,
  steps: WANDAS_CHEESE_BREAD.steps.map((st, i) => (i === 2 ? { ...st, imageSrc: DOUGH } : st)),
  sourceLanguage: 'pl',
  translations: { en: { name: 'Chleb serowy Wandy', sourceHash: '0badf00d' } },
  version: 4,
  updatedAt: 1790479983309,
  versionIndex: [{ id: 'v3-1790478830629', version: 3, savedAt: 1790478830629 }],
};

const withoutPhotos = ({ hasImage: _h, imageSrc: _s, ...step }: Step) => step;

describe('needsWandaRepair', () => {
  it("matches only the broken record, on its owner's device", () => {
    expect(needsWandaRepair(broken, peter)).toBe(true);
    expect(needsWandaRepair(broken, { email: 'ola@example.com', name: 'Ola' })).toBe(false);
    expect(needsWandaRepair(broken, null)).toBe(false);
    // A later, deliberate edit is never touched.
    expect(needsWandaRepair({ ...broken, version: 5, updatedAt: Date.now() }, peter)).toBe(false);
    expect(needsWandaRepair({ ...broken, id: 'other' }, peter)).toBe(false);
  });
});

describe('repairWanda', () => {
  const repaired = repairWanda(broken);

  it("puts back Wanda's original English and her hand-written Polish, marked current", () => {
    expect(translatableContent(repaired)).toEqual(translatableContent(WANDAS_CHEESE_BREAD));
    const handWritten = WANDAS_CHEESE_BREAD.translations!.pl!;
    expect(repaired.translations).toEqual({
      pl: { ...handWritten, steps: handWritten.steps!.map(withoutPhotos) },
    });
    expect(repaired.sourceLanguage).toBe('en');
    expect(translationStatus(repaired, 'pl')).toBe('fresh');
    expect(needsTranslation(repaired)).toBe(false);
  });

  it('shows English to English readers and Polish to Polish readers', () => {
    expect(localizeRecipe(repaired, 'en').name).toBe("Wanda's Cheese Bread");
    expect(localizeRecipe(repaired, 'pl').name).toBe('Chleb Serowy Wandy');
  });

  it('keeps the photos, author, owner and version bookkeeping', () => {
    expect(repaired.heroImage).toBe(HERO);
    expect(repaired.steps[2].imageSrc).toBe(DOUGH);
    expect(repaired.steps[2].hasImage).toBe(true);
    expect(repaired.steps.filter((st) => st.imageSrc)).toHaveLength(1);
    for (const key of [
      'author',
      'authorMode',
      'ownerEmail',
      'createdAt',
      'versionIndex',
    ] as const) {
      expect(repaired[key]).toEqual(broken[key]);
    }
  });
});

describe("the repair on Peter's device", () => {
  beforeEach(() => {
    vi.mocked(saveRecipeToCloud).mockClear();
    vi.mocked(fetchRecipeFromServer).mockReset();
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([broken]));
  });

  it('saves the repair once, as a new version that backs up the broken one', async () => {
    vi.mocked(fetchRecipeFromServer).mockResolvedValue(broken);
    const { result } = renderHook(() => useRecipes(peter));
    await act(async () => {});
    await act(async () => {});

    expect(saveRecipeToCloud).toHaveBeenCalledTimes(1);
    const [saved, backups] = vi.mocked(saveRecipeToCloud).mock.calls[0];
    expect(saved.version).toBe(5);
    expect(saved.changeNote).toBe(WANDA_REPAIR_NOTE);
    expect(saved.sourceLanguage).toBe('en');
    expect(backups?.map((v) => v.id)).toEqual(['v4-1790479983309']);
    expect(localizeRecipe(result.current.recipes[0], 'pl').name).toBe('Chleb Serowy Wandy');
  });

  it("leaves it alone when the server's copy has changed since this phone cached it", async () => {
    vi.mocked(fetchRecipeFromServer).mockResolvedValue({ ...broken, version: 5, updatedAt: 2 });
    renderHook(() => useRecipes(peter));
    await act(async () => {});

    expect(fetchRecipeFromServer).toHaveBeenCalledTimes(1);
    expect(saveRecipeToCloud).not.toHaveBeenCalled();
  });

  it("does nothing on anyone else's device", async () => {
    renderHook(() => useRecipes({ email: 'ola@example.com', name: 'Ola' }));
    await act(async () => {});

    expect(fetchRecipeFromServer).not.toHaveBeenCalled();
    expect(saveRecipeToCloud).not.toHaveBeenCalled();
  });
});
