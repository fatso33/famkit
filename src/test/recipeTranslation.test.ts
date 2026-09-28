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
  parsePieceResponse,
  pendingPieces,
  recipeForEditing,
  resolveEdit,
  shouldTranslateNow,
  sourceHash,
  translatableContent,
  translationFitsRecipe,
  translationStatus,
} from '../utils/recipeTranslation';
import { Piece, pieceHash } from '../utils/translationPieces';
import { answerFrom } from './translator';

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
  yieldHeader: 'Na 8 porcji:',
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
    const result = applyTranslation(provisional, answerFrom(recipe, polish, 'en'), hash);
    expect(result.sourceLanguage).toBe('en');
    expect(result.translations?.pl).toMatchObject({
      name: 'Szarlotka',
      yieldHeader: 'Na 8 porcji:',
      ingredients: [{ text: 'Jabłka - 6 dużych', unit: 'dużych' }],
      steps: [{ num: 1, text: 'Pokrój jabłka.' }],
      sourceHash: hash,
    });
    expect(needsTranslation(result)).toBe(false);
    expect(result.version).toBe(3);
    expect(result.updatedAt).toBe(provisional.updatedAt);
  });

  it('ignores a translation of text that has changed since it was requested', () => {
    const hash = sourceHash(recipe);
    const edited = { ...recipe, name: 'Apple Tart' };
    expect(applyTranslation(edited, answerFrom(recipe, polish), hash)).toBe(edited);
  });
});

describe('translationFitsRecipe', () => {
  const wandasPolish = WANDAS_CHEESE_BREAD.translations!.pl!;

  it("rejects Polish labelled as the English translation (how Wanda's languages got swapped)", () => {
    const swapped = answerFrom(WANDAS_CHEESE_BREAD, wandasPolish, 'pl');
    expect(translationFitsRecipe(WANDAS_CHEESE_BREAD, swapped)).toBe(false);
    const correct = answerFrom(WANDAS_CHEESE_BREAD, wandasPolish, 'en');
    expect(translationFitsRecipe(WANDAS_CHEESE_BREAD, correct)).toBe(true);
  });

  it('accepts a Polish recipe that was provisionally labelled English', () => {
    const typedInPolish: Recipe = { ...recipe, ...polish, sourceLanguage: 'en' };
    const english = translatableContent(recipe);
    const answer = (lang: 'en' | 'pl') => answerFrom(typedInPolish, english, lang);
    expect(translationFitsRecipe(typedInPolish, answer('pl'))).toBe(true);
    expect(translationFitsRecipe(typedInPolish, answer('en'))).toBe(false);
  });

  it('accepts Polish typed without Polish letters, added while the app was in English', () => {
    const pierogi: Recipe = {
      ...recipe,
      name: 'Pierogi z serem',
      yieldHeader: 'Na 4 osoby:',
      ingredients: [{ text: 'Maka - 500g' }],
      steps: [{ num: 1, text: 'Zagniec ciasto i odstaw na godzine.' }],
      sourceLanguage: 'en',
    };
    const english = {
      name: 'Cheese pierogi',
      yieldHeader: 'Serves 4:',
      ingredients: [{ text: 'Flour - 500g' }],
      steps: [{ num: 1, text: 'Knead the dough and rest it for an hour.' }],
    };
    expect(translationFitsRecipe(pierogi, answerFrom(pierogi, english, 'pl'))).toBe(true);
    expect(translationFitsRecipe(pierogi, answerFrom(pierogi, english, 'en'))).toBe(false);
  });

  it("won't relabel a recipe when the text gives no clue either way", () => {
    const noClue = answerFrom(recipe, { name: 'Apple Pie' }, 'en');
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
    // Only the edited title needs English; the rest keeps the original English words.
    const [title] = pendingPieces(saved);
    expect(pendingPieces(saved)).toEqual([title]);
    const answer = {
      detectedLanguage: 'pl' as const,
      values: new Map([[pieceHash(title), "Ola's Apple Pie"]]),
    };
    const done = applyTranslation(saved, answer, sourceHash(saved));
    expect(localizeRecipe(done, 'en')).toMatchObject({
      name: "Ola's Apple Pie",
      yieldHeader: 'Serves 8:',
      ingredients: [{ text: 'Apples - 6 large', qty: 6 }],
      steps: [{ text: 'Slice apples.' }],
    });
  });

  it('stops showing a translation from before fingerprinting once the text is edited', () => {
    const legacy = { ...recipe, translations: { pl: polish } };
    expect(localizeRecipe(legacy, 'pl').name).toBe('Szarlotka');
    const saved = resolveEdit(legacy, { ...recipe, name: 'Pear Pie' }, 'en', true);
    expect(translationStatus(saved, 'pl')).toBe('stale');
    expect(localizeRecipe(saved, 'pl').name).toBe('Pear Pie');
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

describe('parsePieceResponse', () => {
  const title: Piece = { key: 'name', kind: 'title', text: 'Apple Pie' };
  const flour: Piece = { key: 'ingredients:0', kind: 'ingredient', ingredient: { text: 'Flour' } };
  const step: Piece = { key: 'steps:0:text', kind: 'step', text: 'Mix.' };
  const requested = new Map<string, Piece>([
    ['p1', title],
    ['p2', flour],
    ['p3', step],
  ]);

  it('keeps only asked-for pieces of the right kind, by id, and drops the rest', () => {
    const parsed = parsePieceResponse(
      {
        detectedLanguage: 'en',
        texts: [
          { id: 'p1', text: 'Szarlotka' },
          { id: 'p2', text: 'not an ingredient' },
          { id: 'p9', text: 'never asked' },
          { id: 'p3', text: 42 },
          'junk',
        ],
        ingredients: [{ id: 'p2', text: 'Mąka', unit: 'g', onclick: 'x', renderUnit: 'gramy' }],
        extra: 'ignored',
      },
      requested,
    );
    expect(parsed.detectedLanguage).toBe('en');
    expect(parsed.values).toEqual(
      new Map<string, unknown>([
        [pieceHash(title), 'Szarlotka'],
        [pieceHash(flour), { text: 'Mąka', unit: 'g', renderUnit: 'gramy' }],
      ]),
    );
  });

  it('keeps each piece in its place when another comes back malformed', () => {
    // The old whole-recipe answer shifted every later step onto the wrong one.
    const { translations: _t, ...recipe } = WANDAS_CHEESE_BREAD;
    const pieces = pendingPieces(recipe);
    const ids = new Map(pieces.map((p, i) => ['p' + (i + 1), p]));
    const texts = pieces.flatMap((p, i) =>
      p.kind === 'ingredient' ? [] : [{ id: 'p' + (i + 1), text: 'PL ' + p.text } as object],
    );
    const broken = pieces.findIndex(
      (p) => p.kind !== 'ingredient' && p.text.startsWith('Add water'),
    );
    const withBroken = texts.map((t) =>
      (t as { id: string }).id === 'p' + (broken + 1) ? { id: 'p' + (broken + 1), text: 42 } : t,
    );
    const parsed = parsePieceResponse({ detectedLanguage: 'en', texts: withBroken }, ids);
    const done = applyTranslation(recipe, parsed, sourceHash(recipe));
    const shown = localizeRecipe(done, 'pl');
    expect(shown.steps[2].text).toBe(recipe.steps[2].text);
    expect(shown.steps[3].text).toBe('PL ' + recipe.steps[3].text);
    // The malformed step and the unanswered ingredients are asked for again.
    expect(pendingPieces(done).map((p) => p.key)).toEqual([
      ...recipe.ingredients.map((_, i) => 'ingredients:' + i),
      'steps:2:text',
    ]);
  });

  it('keeps the recipe’s settled language over the model’s guess', () => {
    const raw = { detectedLanguage: 'pl', texts: [{ id: 'p1', text: 'Szarlotka' }] };
    expect(parsePieceResponse(raw, requested, 'en').detectedLanguage).toBe('en');
  });

  it.each([
    ['not an object', 'text'],
    ['an unknown language', { detectedLanguage: 'de', texts: [{ id: 'p1', text: 'Kuchen' }] }],
    ['nothing usable', { detectedLanguage: 'en', texts: [{ id: 'p1', text: ' ' }] }],
  ])('rejects %s', (_label, raw) => {
    expect(() => parsePieceResponse(raw, requested)).toThrow();
  });
});

describe('the method, translated', () => {
  const method: Recipe = {
    ...recipe,
    steps: [
      { num: 1, text: 'Mix.', substeps: ['Sift.', 'Stir.'] },
      { num: 0, text: 'Rest an hour.', plain: true },
      {
        num: 2,
        text: 'Chill.',
        section: 'Baking',
        fork: {
          paths: [
            { label: 'Fridge', text: 'Chill.', steps: ['Warm up.'] },
            { label: 'Now', text: 'Bake.', sameAsFirst: true },
          ],
        },
      },
    ],
  };

  it('keeps sections, unnumbered text, substeps and forks from the original', () => {
    const shown = overlayTranslation(method, {
      steps: [
        { num: 5, text: 'Wymieszaj.', substeps: ['Przesiej.'], plain: false } as never,
        { num: 0, text: 'Odstaw na godzinę.' },
        {
          num: 7,
          text: 'Schłodź.',
          section: 'Pieczenie',
          fork: { paths: [{ label: 'Lodówka', text: 'Schłodź.', steps: ['Ogrzej.'] }] },
        },
      ],
    });
    expect(shown.steps.map((s) => [s.num, s.plain, s.section])).toEqual([
      [1, undefined, undefined],
      [0, true, undefined],
      [2, undefined, 'Pieczenie'],
    ]);
    // One entry per original substep, the original where the translation has none.
    expect(shown.steps[0].substeps).toEqual(['Przesiej.', 'Stir.']);
    const [fridge, now] = shown.steps[2].fork!.paths;
    expect(fridge).toEqual({ label: 'Lodówka', text: 'Schłodź.', steps: ['Ogrzej.'] });
    expect(now).toEqual({ label: 'Now', text: 'Bake.', sameAsFirst: true, steps: undefined });
  });

  it('sees a change to a path or substep as a text change', () => {
    const renamed = structuredClone(method);
    renamed.steps[2].fork!.paths[1].label = 'Straight away';
    expect(sourceHash(renamed)).not.toBe(sourceHash(method));
    const sub = structuredClone(method);
    sub.steps[0].substeps![1] = 'Fold.';
    expect(sourceHash(sub)).not.toBe(sourceHash(method));
  });

  it("keeps the fingerprint of recipes saved before these fields, so Wanda's Polish stays current", () => {
    // As computed by the app before sections, forks, notes and substitutes existed.
    expect(sourceHash(WANDAS_CHEESE_BREAD)).toBe('66a5d883');
    expect(translationStatus(WANDAS_CHEESE_BREAD, 'pl')).toBe('fresh');
  });
});

describe('resolveEdit, for an edit that changes no text', () => {
  it('still saves a new category or time (they were dropped before)', () => {
    const original = translated(recipe);
    const edited: Recipe = { ...recipe, category: 'cakes', manualMinutes: 75 };
    const saved = resolveEdit(original, edited, 'en', false);
    expect(saved).toMatchObject({ category: 'cakes', manualMinutes: 75, name: 'Apple Pie' });
    expect(saved.translations).toEqual(original.translations);
  });
});

describe('a legacy translation over a recipe whose blocks are now steps', () => {
  it("doesn't bring back the lamination directive or baking options", () => {
    const converted: Recipe = {
      ...recipe,
      steps: [...recipe.steps, { num: 0, plain: true, text: 'Repeat steps 1 to 1.' }],
    };
    const shown = overlayTranslation(converted, {
      ...polish,
      laminationDirective: 'Powtórz kroki.',
      bakingOptions: { option1: 'Piecz.' },
    });
    expect(shown.laminationDirective).toBeUndefined();
    expect(shown.bakingOptions).toBeUndefined();
    // A recipe that still has them shows them translated.
    const legacy = overlayTranslation(
      { ...recipe, laminationDirective: 'Repeat.', bakingOptions: { option1: 'Bake.' } },
      { ...polish, laminationDirective: 'Powtórz kroki.', bakingOptions: { option1: 'Piecz.' } },
    );
    expect(legacy.laminationDirective).toBe('Powtórz kroki.');
    expect(legacy.bakingOptions).toEqual({ option1: 'Piecz.' });
  });
});
