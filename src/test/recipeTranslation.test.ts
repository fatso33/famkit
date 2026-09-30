import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import {
  applyTranslation,
  displayedLanguage,
  editingLanguage,
  localizeRecipe,
  needsTranslation,
  overlayTranslation,
  pendingPieces,
  recipeForEditing,
  resolveEdit,
  sourceHash,
  translatableContent,
  translationFitsRecipe,
  translationPending,
  translationStatus,
} from '../utils/recipeTranslation';
import { pieceHash } from '../utils/translationPieces';
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

  it("keeps a new photo on a fork's other path when only photos changed", () => {
    const forked: Recipe = {
      ...recipe,
      steps: [
        {
          num: 1,
          text: 'Bake.',
          fork: {
            paths: [
              { label: 'Oven', text: 'Bake.' },
              { label: 'Pan', text: 'Fry.', hasImage: true, imageSrc: 'old.jpg' },
              { label: 'Grill', text: 'Grill.' },
            ],
          },
        },
      ],
    };
    const photos = structuredClone(forked);
    photos.steps[0].fork!.paths[1].imageSrc = 'new.jpg';
    photos.steps[0].fork!.paths[2] = { label: 'Grill', text: 'Grill.', imageSrc: 'grill.jpg' };
    const saved = resolveEdit(forked, photos, 'en', false);
    expect(saved.steps[0].fork!.paths.map((p) => p.imageSrc)).toEqual([
      undefined,
      'new.jpg',
      'grill.jpg',
    ]);
    expect(saved.steps[0].imageSrc).toBeUndefined();
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

describe('while an edit waits for its translation', () => {
  const pie: Recipe = {
    id: 'pie',
    name: 'Apple Pie',
    author: 'Ola',
    category: 'cakes',
    heroImage: '',
    yieldHeader: 'For 1 pie:',
    tips: 'Use tart apples.',
    ingredients: [
      { text: 'Flour - 2 cups', name: 'Flour', note: '' },
      { text: 'Apples - 6', name: 'Apples', note: '' },
    ],
    steps: [{ num: 1, text: 'Mix.' }],
  };
  const polish = {
    name: 'Szarlotka',
    yieldHeader: 'Na 1 szarlotkę:',
    tips: 'Użyj kwaśnych jabłek.',
    ingredients: [
      { text: 'Mąka - 2 szklanki', name: 'Mąka', note: '' },
      { text: 'Jabłka - 6', name: 'Jabłka', note: '' },
    ],
    steps: [{ num: 1, text: 'Wymieszaj.' }],
  };
  const translated = applyTranslation(pie, answerFrom(pie, polish, 'en'), sourceHash(pie), 42);
  const edit = (changes: Partial<Recipe>) =>
    resolveEdit(translated, { ...translated, ...changes }, 'en', true);

  it('stamps when the translation was made', () => {
    expect(translated.translations?.pl?.translatedAt).toBe(42);
  });

  it('shows the unchanged pieces translated and the edited ones as written, never the old words', () => {
    const edited = edit({
      ingredients: [pie.ingredients[0], { text: 'Apples - 8', name: 'Apples', note: '' }],
    });
    expect(translationStatus(edited, 'pl')).toBe('stale');
    const shown = localizeRecipe(edited, 'pl');
    expect(shown.name).toBe('Szarlotka');
    expect(shown.ingredients.map((i) => i.text)).toEqual(['Mąka - 2 szklanki', 'Apples - 8']);
    expect(shown.steps[0].text).toBe('Wymieszaj.');
    expect(translationPending(edited, 'pl')).toBe(true);
    // The reader of the original waits for nothing.
    expect(translationPending(edited, 'en')).toBe(false);
  });

  it('opens the editor in the original until the translation is whole again', () => {
    const edited = edit({ name: 'Apple Pie from Ola' });
    expect(editingLanguage(edited, 'pl')).toBe('en');
    // Current but missing a piece (a reply left it out): editing it in Polish would store the
    // piece's English as Polish.
    const partial = applyTranslation(
      pie,
      { detectedLanguage: 'en', values: new Map([[pieceHash(title()), 'Szarlotka']]) },
      sourceHash(pie),
    );
    expect(translationStatus(partial, 'pl')).toBe('fresh');
    expect(editingLanguage(partial, 'pl')).toBe('en');
    expect(editingLanguage(translated, 'pl')).toBe('pl');
  });

  it('keeps the translation current through an edit that only tidies spacing and full stops', () => {
    const tidied = edit({ name: '  Apple Pie ', steps: [{ num: 1, text: 'Mix' }] });
    expect(translationStatus(tidied, 'pl')).toBe('fresh');
    expect(needsTranslation(tidied)).toBe(false);
    expect(localizeRecipe(tidied, 'pl').steps[0].text).toBe('Wymieszaj.');
  });

  it('asks again after an edit that changes a letter or a number', () => {
    expect(pendingPieces(edit({ steps: [{ num: 1, text: 'Mix!' }] }))).toEqual([]);
    expect(pendingPieces(edit({ steps: [{ num: 1, text: 'Fix.' }] })).map((p) => p.key)).toEqual([
      'steps:0:text',
    ]);
    const row = { text: 'Flour - 3 cups', name: 'Flour', note: '' };
    expect(
      pendingPieces(edit({ ingredients: [row, pie.ingredients[1]] })).map((p) => p.key),
    ).toEqual(['ingredients:0']);
  });

  it('drops the translation of a field the edit cleared', () => {
    const cleared = edit({ tips: undefined });
    expect(cleared.translations?.pl?.tips).toBeUndefined();
    expect(localizeRecipe(cleared, 'pl').tips).toBeUndefined();
  });

  function title() {
    return { key: 'name', kind: 'title' as const, text: 'Apple Pie' };
  }
});

describe('a piece the translator got wrong twice', () => {
  const soup: Recipe = {
    id: 'soup',
    name: 'Soup',
    author: 'Ola',
    category: 'soups',
    heroImage: '',
    yieldHeader: '',
    ingredients: [{ text: 'Water - 2 cups', name: 'Water', note: '' }],
    steps: [{ num: 1, text: 'Simmer 30 minutes.' }],
  };
  const [water, simmer] = pendingPieces(soup).slice(1);
  const done = applyTranslation(
    soup,
    {
      detectedLanguage: 'en',
      values: new Map([[pieceHash(pendingPieces(soup)[0]), 'Zupa']]),
      gaveUp: [simmer],
    },
    sourceHash(soup),
  );

  it('keeps the original’s words and isn’t asked for again', () => {
    expect(localizeRecipe(done, 'pl').steps[0].text).toBe('Simmer 30 minutes.');
    expect(pendingPieces(done)).toEqual([water]);
    // Still given up after the rest is translated.
    const rest = applyTranslation(
      done,
      {
        detectedLanguage: 'en',
        values: new Map([
          [pieceHash(water), { text: 'Woda - 2 szklanki', name: 'Woda', note: '' }],
        ]),
      },
      sourceHash(done),
    );
    expect(pendingPieces(rest)).toEqual([]);
    expect(needsTranslation(rest)).toBe(false);
    expect(translationPending(rest, 'pl')).toBe(false);
  });

  it('is asked for again once its words change', () => {
    const edited = resolveEdit(
      done,
      { ...done, steps: [{ num: 1, text: 'Simmer 40 minutes.' }] },
      'en',
      true,
    );
    expect(pendingPieces(edited).map((p) => p.key)).toContain('steps:0:text');
  });
});
