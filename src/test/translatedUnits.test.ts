import { describe, it, expect } from 'vitest';
import { LocalizedRecipeContent, Recipe } from '../types/recipe';
import {
  PieceTranslation,
  applyTranslation,
  keepsSourceUnits,
  localizeRecipe,
  needsTranslation,
  pendingPieces,
  resolveEdit,
  sourceHash,
  translatableContent,
} from '../utils/recipeTranslation';
import { Piece, buildTranslation, pieceHash } from '../utils/translationPieces';

// Translations stored while the prompt said to keep amounts "exactly as written" kept English
// units in Polish ("Mąka - 2 cups"). Each such piece is asked for once more, and only those.

const bread: Recipe = {
  id: 'r1',
  name: 'Farm Bread',
  author: 'Ola',
  category: 'bread',
  heroImage: '',
  yieldHeader: '',
  ingredients: [{ text: 'Flour - 2 cups' }, { text: 'Salt - 1 tsp' }, { text: 'Eggs - 2' }],
  steps: [
    { num: 1, text: 'Add 1 cup of water.' },
    { num: 2, text: 'Bake at 450°F for 30 minutes.' },
  ],
  updatedAt: 1_000,
};

// What the old prompt gave back: Polish words, English units in two places.
const OLD_POLISH: Record<string, string> = {
  'Farm Bread': 'Chleb wiejski',
  'Flour - 2 cups': 'Mąka - 2 cups',
  'Salt - 1 tsp': 'Sól - 1 łyżeczka',
  'Eggs - 2': 'Jajka - 2',
  'Add 1 cup of water.': 'Dodaj 1 cup wody.',
  'Bake at 450°F for 30 minutes.': 'Piecz w 450°F przez 30 minut.',
};

/** `recipe` with a current translation made of `words`, stored before the units fix. */
function translatedBefore(recipe: Recipe, words: Record<string, string>): Recipe {
  const { content, pieceSources } = buildTranslation(translatableContent(recipe), (piece) => {
    const text = piece.kind === 'ingredient' ? piece.ingredient.text : piece.text;
    const found = words[text ?? ''];
    if (found === undefined) return undefined;
    return piece.kind === 'ingredient' ? { text: found } : found;
  });
  const target = recipe.sourceLanguage === 'pl' ? 'en' : 'pl';
  const tr: LocalizedRecipeContent = { ...content, pieceSources, sourceHash: sourceHash(recipe) };
  return { ...recipe, translations: { [target]: tr } };
}

const keys = (r: Recipe) => pendingPieces(r).map((p) => p.key);

/** The translator's answer for the asked-for pieces it has words for. */
function translate(pieces: Piece[], words: Record<string, string>): PieceTranslation {
  const values: PieceTranslation['values'] = new Map();
  for (const piece of pieces) {
    const found = words[(piece.kind === 'ingredient' ? piece.ingredient.text : piece.text) ?? ''];
    if (found !== undefined) {
      values.set(pieceHash(piece), piece.kind === 'ingredient' ? { text: found } : found);
    }
  }
  return { detectedLanguage: 'en', values };
}

describe('translations that kept their units', () => {
  it('asks once more for only the pieces that kept English units', () => {
    const stored = translatedBefore(bread, OLD_POLISH);
    expect(needsTranslation(stored)).toBe(true);
    expect(keys(stored)).toEqual(['ingredients:0', 'steps:0:text']);
  });

  it('keeps showing its Polish meanwhile, never the English original', () => {
    const shown = localizeRecipe(translatedBefore(bread, OLD_POLISH), 'pl');
    expect(shown.name).toBe('Chleb wiejski');
    expect(shown.ingredients.map((i) => i.text)).toEqual([
      'Mąka - 2 cups',
      'Sól - 1 łyżeczka',
      'Jajka - 2',
    ]);
  });

  it('stores the new words and never asks again, even for a unit that stayed', () => {
    const stored = translatedBefore(bread, OLD_POLISH);
    const answer = translate(pendingPieces(stored), {
      'Flour - 2 cups': 'Mąka - 2 szklanki',
      // The model keeps a unit again: taken as it is, so the step isn't asked for forever.
      'Add 1 cup of water.': 'Dodaj 1 cup wody.',
    });
    expect(answer.values.size).toBe(2);

    const done = applyTranslation(stored, answer, sourceHash(stored));
    expect(done.translations?.pl?.unitsTranslated).toBe(true);
    expect(localizeRecipe(done, 'pl').ingredients.map((i) => i.text)).toEqual([
      'Mąka - 2 szklanki',
      'Sól - 1 łyżeczka',
      'Jajka - 2',
    ]);
    expect(pendingPieces(done)).toEqual([]);
    expect(needsTranslation(done)).toBe(false);
  });

  it('looks for Polish units in the English of a recipe written in Polish', () => {
    const babka: Recipe = {
      ...bread,
      sourceLanguage: 'pl',
      name: 'Babka',
      ingredients: [{ text: 'Mąka - 2 szklanki' }, { text: 'Masło - 200g' }],
      steps: [{ num: 1, text: 'Wymieszaj.' }],
    };
    const stored = translatedBefore(babka, {
      Babka: 'Babka',
      'Mąka - 2 szklanki': 'Flour - 2 szklanki',
      'Masło - 200g': 'Butter - 200g',
      'Wymieszaj.': 'Mix.',
    });
    expect(keys(stored)).toEqual(['ingredients:0']);
  });

  it("keeps an author's own words when an edit in the other language swaps them", () => {
    const stored = translatedBefore(bread, OLD_POLISH);
    // Read in Polish and edited there: the Polish becomes the original, the English its translation.
    const edited = { ...localizeRecipe(stored, 'pl'), name: 'Chleb z farmy' };
    const saved = resolveEdit(stored, edited, 'pl', true);
    expect(saved.sourceLanguage).toBe('pl');
    expect(saved.translations?.en?.unitsTranslated).toBe(true);
  });
});

describe('keepsSourceUnits', () => {
  it('finds unit words of the language translated from, as whole words', () => {
    expect(keepsSourceUnits('Mąka - 2 cups', 'en')).toBe(true);
    expect(keepsSourceUnits('Cukier - 3 Tbsp', 'en')).toBe(true);
    expect(keepsSourceUnits({ text: 'Masło - 4', unit: 'oz' }, 'en')).toBe(true);
    expect(keepsSourceUnits('Flour - 2 lyzeczki', 'pl')).toBe(true);
    expect(keepsSourceUnits('Sugar - 1 szklanka', 'pl')).toBe(true);
  });

  it('leaves symbols, other words and names that only contain a unit alone', () => {
    expect(keepsSourceUnits('Mąka - 450g', 'en')).toBe(false);
    expect(keepsSourceUnits('Piecz w 450°F przez 30 minut.', 'en')).toBe(false);
    expect(keepsSourceUnits('Mąka Cup4Cup - 2 szklanki', 'en')).toBe(false);
    expect(keepsSourceUnits('Babeczki (cupcakes)', 'en')).toBe(false);
    // A US stick of butter isn't a Polish kostka, so it may rightly stay.
    expect(keepsSourceUnits('Masło - 1 stick', 'en')).toBe(false);
    expect(keepsSourceUnits('Butter - 200g', 'pl')).toBe(false);
  });
});
