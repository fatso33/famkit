import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import {
  TRANSLATION_GRACE_MS,
  applyTranslation,
  displayedLanguage,
  localizeRecipe,
  needsTranslation,
  overlayTranslation,
  parseTranslationResponse,
  recipeForEditing,
  resolveEdit,
  shouldTranslateNow,
  sourceHash,
  translatableContent,
  translationFitsRecipe,
  translationStatus,
} from '../utils/recipeTranslation';

const PHOTO = 'data:image/jpeg;base64,AAAA';

const recipe: Recipe = {
  id: 'r1',
  name: 'Apple Pie',
  author: 'Ola',
  category: 'family',
  heroImage: PHOTO,
  yieldHeader: 'Serves 8:',
  ingredients: [{ text: 'Apples - 6 large', qty: 6, unit: 'large' }],
  steps: [{ num: 1, text: 'Slice apples.', hasImage: true, imageSrc: PHOTO }],
  updatedAt: 1_000,
};

const polish = {
  name: 'Szarlotka',
  ingredients: [{ text: 'Jabłka - 6 dużych', qty: 60, unit: 'dużych' }],
  steps: [{ num: 9, text: 'Pokrój jabłka.' }],
};

const translated = (r: Recipe): Recipe => ({
  ...r,
  translations: { pl: { ...polish, sourceHash: sourceHash(r) } },
});

describe('translatableContent / sourceHash', () => {
  it('leaves out photos', () => {
    expect(JSON.stringify(translatableContent(recipe))).not.toContain('data:');
  });

  it('ignores photo changes but changes when the text changes', () => {
    const newPhoto = { ...recipe, heroImage: '', steps: [{ ...recipe.steps[0], imageSrc: '' }] };
    expect(sourceHash(newPhoto)).toBe(sourceHash(recipe));
    expect(sourceHash({ ...recipe, name: 'Pear Pie' })).not.toBe(sourceHash(recipe));
  });
});

describe('translationStatus / needsTranslation', () => {
  it('treats old records as English with a missing Polish version', () => {
    expect(translationStatus(recipe, 'en')).toBe('source');
    expect(translationStatus(recipe, 'pl')).toBe('missing');
    expect(needsTranslation(recipe)).toBe(true);
  });

  it('is fresh right after translation and stale after an edit', () => {
    const done = translated(recipe);
    expect(translationStatus(done, 'pl')).toBe('fresh');
    expect(needsTranslation(done)).toBe(false);

    const edited = { ...done, steps: [{ num: 1, text: 'Peel and slice apples.' }] };
    expect(translationStatus(edited, 'pl')).toBe('stale');
    expect(needsTranslation(edited)).toBe(true);
  });

  it('marks translations from before fingerprinting as legacy, and re-translates them', () => {
    const legacy = { ...recipe, translations: { pl: polish } };
    expect(translationStatus(legacy, 'pl')).toBe('legacy');
    expect(needsTranslation(legacy)).toBe(true);
  });

  it("never re-translates Wanda's hand-written Polish", () => {
    expect(needsTranslation(WANDAS_CHEESE_BREAD)).toBe(false);
  });

  it('looks for English when the recipe was written in Polish', () => {
    const pl = { ...recipe, sourceLanguage: 'pl' as const };
    expect(translationStatus(pl, 'pl')).toBe('source');
    expect(translationStatus(pl, 'en')).toBe('missing');
  });
});

describe('overlayTranslation / localizeRecipe', () => {
  it('keeps quantities, step numbers and step photos from the original', () => {
    const shown = overlayTranslation(recipe, polish);
    expect(shown.name).toBe('Szarlotka');
    expect(shown.ingredients[0]).toMatchObject({ text: 'Jabłka - 6 dużych', qty: 6 });
    expect(shown.steps[0]).toMatchObject({
      text: 'Pokrój jabłka.',
      num: 1,
      hasImage: true,
      imageSrc: PHOTO,
    });
  });

  it('shows the original instead of an outdated translation', () => {
    const stale = { ...translated(recipe), name: 'Pear Pie' };
    expect(localizeRecipe(stale, 'pl').name).toBe('Pear Pie');
    expect(localizeRecipe(translated(recipe), 'pl').name).toBe('Szarlotka');
    expect(localizeRecipe({ ...recipe, translations: { pl: polish } }, 'pl').name).toBe(
      'Szarlotka',
    );
  });

  it("still shows Wanda's Polish version", () => {
    expect(localizeRecipe(WANDAS_CHEESE_BREAD, 'pl').name).toBe('Chleb Serowy Wandy');
  });
});

describe('applyTranslation', () => {
  it('stores the other language and the detected source, without a new version', () => {
    const provisional = { ...recipe, sourceLanguage: 'pl' as const, version: 3 };
    const hash = sourceHash(provisional);
    const result = applyTranslation(
      provisional,
      { detectedLanguage: 'en', content: { name: 'Szarlotka' } },
      hash,
    );
    expect(result.sourceLanguage).toBe('en');
    expect(result.translations?.pl).toEqual({ name: 'Szarlotka', sourceHash: hash });
    expect(result.version).toBe(3);
    expect(result.updatedAt).toBe(provisional.updatedAt);
  });

  it('ignores a translation of text that has changed since it was requested', () => {
    const hash = sourceHash(recipe);
    const edited = { ...recipe, name: 'Apple Tart' };
    expect(applyTranslation(edited, { detectedLanguage: 'en', content: polish }, hash)).toBe(
      edited,
    );
  });
});

describe('translationFitsRecipe', () => {
  const wandasPolish = WANDAS_CHEESE_BREAD.translations!.pl!;

  it("rejects Polish labelled as the English translation (how Wanda's languages got swapped)", () => {
    const swapped = { detectedLanguage: 'pl' as const, content: wandasPolish };
    expect(translationFitsRecipe(WANDAS_CHEESE_BREAD, swapped)).toBe(false);
    const correct = { detectedLanguage: 'en' as const, content: wandasPolish };
    expect(translationFitsRecipe(WANDAS_CHEESE_BREAD, correct)).toBe(true);
  });

  it('accepts a Polish recipe that was provisionally labelled English', () => {
    const typedInPolish: Recipe = { ...recipe, ...polish, sourceLanguage: 'en' };
    const english = translatableContent(recipe);
    expect(translationFitsRecipe(typedInPolish, { detectedLanguage: 'pl', content: english })).toBe(
      true,
    );
    expect(translationFitsRecipe(typedInPolish, { detectedLanguage: 'en', content: english })).toBe(
      false,
    );
  });

  it("won't relabel a recipe when the text gives no clue either way", () => {
    const noClue = { detectedLanguage: 'en' as const, content: { name: 'Apple Pie' } };
    expect(translationFitsRecipe(recipe, noClue)).toBe(true);
    expect(translationFitsRecipe({ ...recipe, sourceLanguage: 'pl' }, noClue)).toBe(false);
  });
});

describe('shouldTranslateNow', () => {
  it('translates at once on the saving device, and after a grace period elsewhere', () => {
    expect(shouldTranslateNow(recipe, 1_000, true)).toBe(true);
    expect(shouldTranslateNow(recipe, 1_000 + TRANSLATION_GRACE_MS - 1, false)).toBe(false);
    expect(shouldTranslateNow(recipe, 1_000 + TRANSLATION_GRACE_MS, false)).toBe(true);
  });
});

describe('resolveEdit', () => {
  const original = translated(recipe);

  it('edits the translation when the viewer reads it, making it the new original', () => {
    expect(displayedLanguage(original, 'pl')).toBe('pl');
    const edited: Recipe = { ...overlayTranslation(original, polish), name: 'Szarlotka Oli' };
    const saved = resolveEdit(original, edited, 'pl', true);
    expect(saved.sourceLanguage).toBe('pl');
    expect(saved.name).toBe('Szarlotka Oli');
    expect(saved.translations?.pl).toBeUndefined();
    expect(needsTranslation(saved)).toBe(true);
  });

  it('keeps the English original when only the photo changed', () => {
    const edited: Recipe = {
      ...overlayTranslation(original, polish),
      heroImage: 'new.jpg',
      steps: [{ num: 1, text: 'Pokrój jabłka.', hasImage: false, imageSrc: undefined }],
    };
    const saved = resolveEdit(original, edited, 'pl', false);
    expect(saved.name).toBe('Apple Pie');
    expect(saved.sourceLanguage).toBeUndefined();
    expect(saved.heroImage).toBe('new.jpg');
    expect(saved.steps[0]).toMatchObject({ text: 'Slice apples.', imageSrc: undefined });
    expect(needsTranslation(saved)).toBe(false);
  });

  it('keeps the owner and creation date when the text is edited', () => {
    const owned = { ...recipe, ownerEmail: 'ola@example.com', ownerName: 'Ola', createdAt: 5 };
    // The form sends no record metadata, only what it edits.
    const edited = { ...recipe, name: 'Pear Pie', createdAt: undefined };
    const saved = resolveEdit(owned, edited, 'en', true);
    expect(saved).toMatchObject({
      name: 'Pear Pie',
      ownerEmail: 'ola@example.com',
      ownerName: 'Ola',
      createdAt: 5,
    });
  });

  it("edits Wanda's recipe like any other: in Polish for a Polish viewer", () => {
    expect(recipeForEditing(WANDAS_CHEESE_BREAD, 'pl').name).toBe('Chleb Serowy Wandy');
  });

  it('edits the original when no usable translation was shown', () => {
    const edited = { ...recipe, name: 'Pear Pie' };
    const saved = resolveEdit(recipe, edited, 'pl', true);
    expect(saved.sourceLanguage).toBe('en');
    expect(saved.name).toBe('Pear Pie');
  });
});

describe('parseTranslationResponse', () => {
  it('keeps known fields of the right type and drops the rest', () => {
    const parsed = parseTranslationResponse({
      detectedLanguage: 'pl',
      name: 'Apple pie',
      tips: 42,
      ingredients: [{ text: 'Apples', qty: 6, onclick: 'x' }, { name: 'no text' }, 'junk'],
      steps: [{ text: 'Slice.' }],
      bakingOptions: { option1: 'Bake', option2: ['a', 1] },
      extra: 'ignored',
    });
    expect(parsed.detectedLanguage).toBe('pl');
    expect(parsed.content).toEqual({
      name: 'Apple pie',
      ingredients: [{ text: 'Apples' }],
      steps: [{ num: 1, text: 'Slice.' }],
      bakingOptions: { option1: 'Bake' },
    });
  });

  it.each([
    ['not an object', 'text'],
    ['an unknown language', { detectedLanguage: 'de', name: 'Kuchen' }],
    ['no name', { detectedLanguage: 'en', name: ' ' }],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseTranslationResponse(raw)).toThrow();
  });
});
