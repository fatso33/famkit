import { describe, it, expect } from 'vitest';
import { Recipe } from '../types/recipe';
import { UI_TEXT } from '../i18n/translations';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { formFromRecipe, formText, formToRecipe } from '../utils/recipeForm';
import {
  PieceTranslation,
  applyTranslation,
  localizeRecipe,
  needsTranslation,
  pendingPieces,
  resolveEdit,
  retryDelayMs,
  sourceHash,
  translatableContent,
  translationStatus,
} from '../utils/recipeTranslation';
import { buildTranslation, pieceHash, recipePieces } from '../utils/translationPieces';
import { restoreWandasPolish } from '../utils/wandaPolish';
import { Piece } from '../utils/translationPieces';

const peter = { email: 'p.gzowski33@gmail.com', name: 'Peter Gzowski' } as const;
const labels = (lang: 'en' | 'pl') => ({
  bakingSection: UI_TEXT[lang].bakingOptions,
  bakingPaths: UI_TEXT[lang].legacyBakingPaths,
});

// Peter opens Wanda's in English: the editor makes her lamination and baking blocks steps and a
// Baking fork. He changes the notes and saves.
function migrateInEnglish(): Recipe {
  const open = () => formFromRecipe(localizeRecipe(WANDAS_CHEESE_BREAD, 'en'), labels('en'));
  const form = open();
  form.notes = 'Will not work in an air fryer!';
  const edited = { ...WANDAS_CHEESE_BREAD, ...formToRecipe(form) };
  return resolveEdit(WANDAS_CHEESE_BREAD, edited, 'en', formText(open()) !== formText(form));
}

// A stand-in translator: "PL " before every asked-for piece, except those it leaves out.
function answer(pieces: Piece[], leaveOut: (p: Piece) => boolean = () => false): PieceTranslation {
  const values: PieceTranslation['values'] = new Map();
  for (const p of pieces) {
    if (leaveOut(p)) continue;
    values.set(
      pieceHash(p),
      p.kind === 'ingredient' ? { text: `PL ${p.ingredient.text}` } : `PL ${p.text}`,
    );
  }
  return { detectedLanguage: 'en', values };
}

const isFork = (p: Piece) => p.key.includes(':fork:');
const forkOf = (r: Recipe) => r.steps.find((s) => s.fork)!.fork!;

describe("Wanda's Baking fork in Polish (it showed in English)", () => {
  it('asks only for what the migration changed, keeping her hand-written Polish meanwhile', () => {
    const migrated = migrateInEnglish();
    expect(forkOf(migrated).paths).toHaveLength(2);
    // Her words keep their hand-written Polish even where they moved (the lamination and baking
    // text, now steps and a fork). Only the changed note and the fork's new names are asked for.
    expect(pendingPieces(migrated).map((p) => p.key)).toEqual([
      'notes',
      'steps:10:section',
      'steps:10:fork:0:label',
      'steps:10:fork:1:label',
    ]);
  });

  it('never counts a translation that left the fork out as done', () => {
    const migrated = migrateInEnglish();
    const first = answer(pendingPieces(migrated), isFork);
    const partly = applyTranslation(migrated, first, sourceHash(migrated));

    expect(translationStatus(partly, 'pl')).toBe('fresh');
    expect(needsTranslation(partly)).toBe(true);
    expect(pendingPieces(partly).every(isFork)).toBe(true);

    const done = applyTranslation(partly, answer(pendingPieces(partly)), sourceHash(partly));
    expect(needsTranslation(done)).toBe(false);
    const handWritten = WANDAS_CHEESE_BREAD.translations!.pl!;
    const [fridge, oven] = forkOf(localizeRecipe(done, 'pl')).paths;
    expect(fridge).toMatchObject({
      label: 'PL Refrigerator Rest',
      text: handWritten.bakingOptions!.option1,
    });
    expect([oven.text, ...oven.steps!]).toEqual(handWritten.bakingOptions!.option2);
    expect(localizeRecipe(done, 'pl').steps[1].text).toBe(
      WANDAS_CHEESE_BREAD.translations!.pl!.steps![1].text,
    );
  });

  it('heals a current translation from before pieces that has no fork, asking only for the fork', () => {
    // As the cloud copy likely is now: the whole-recipe answer, stamped current, without the fork.
    const migrated = migrateInEnglish();
    const { content } = buildTranslation(translatableContent(migrated), (p) =>
      isFork(p) ? undefined : p.kind === 'ingredient' ? { text: 'PL' } : `PL ${p.text}`,
    );
    const noFork = structuredClone(content);
    delete noFork.steps![10].fork;
    const stored: Recipe = {
      ...migrated,
      translations: { pl: { ...noFork, sourceHash: sourceHash(migrated) } },
    };

    expect(translationStatus(stored, 'pl')).toBe('fresh');
    expect(needsTranslation(stored)).toBe(true);
    expect(pendingPieces(stored).every(isFork)).toBe(true);
  });
});

describe('only what changed is translated again', () => {
  const translated = applyTranslation(
    WANDAS_CHEESE_BREAD,
    answer(recipePieces(translatableContent(WANDAS_CHEESE_BREAD))),
    sourceHash(WANDAS_CHEESE_BREAD),
  );

  it('moving a step needs no request: its words are remembered, not its place', () => {
    const steps = [...translated.steps];
    [steps[4], steps[5]] = [steps[5], steps[4]];
    const moved = resolveEdit(translated, { ...translated, steps }, 'en', true);
    expect(needsTranslation(moved)).toBe(true); // rebuilt for the new order...
    expect(pendingPieces(moved)).toEqual([]); // ...without asking the translator
    const rebuilt = applyTranslation(
      moved,
      { detectedLanguage: 'en', values: new Map() },
      sourceHash(moved),
    );
    expect(localizeRecipe(rebuilt, 'pl').steps[4].text).toBe(`PL ${steps[4].text}`);
    expect(needsTranslation(rebuilt)).toBe(false);
  });

  it('stores nothing undefined (Firestore rejects it)', () => {
    const tr = translated.translations!.pl!;
    expect(JSON.parse(JSON.stringify(tr))).toEqual(tr);
  });
});

describe("restoring Wanda's hand-written Polish (one-time repair)", () => {
  // What the migration left in the cloud: machine Polish for every piece but the fork.
  const migrated = migrateInEnglish();
  const machine = applyTranslation(
    migrated,
    answer(recipePieces(translatableContent(migrated)), isFork),
    sourceHash(migrated),
  );

  it('puts her words back wherever the English is unchanged, and the app’s Polish on the fork', () => {
    const restored = restoreWandasPolish(machine, peter)!;
    const shown = localizeRecipe(restored, 'pl');
    const handWritten = WANDAS_CHEESE_BREAD.translations!.pl!;

    expect(shown.name).toBe(handWritten.name);
    expect(shown.steps[2].text).toBe(handWritten.steps![2].text);
    expect(shown.steps[2].imageCaption).toBe(handWritten.steps![2].imageCaption);
    expect(shown.ingredients[1]).toMatchObject({ text: handWritten.ingredients![1].text, qty: 2 });
    expect(shown.steps[9].text).toBe(handWritten.laminationDirective);
    expect(shown.steps[10].section).toBe(UI_TEXT.pl.bakingOptions);
    const [fridge, oven] = forkOf(shown).paths;
    expect(fridge).toMatchObject({
      label: UI_TEXT.pl.legacyBakingPaths[0],
      text: handWritten.bakingOptions!.option1,
    });
    expect(oven.label).toBe(UI_TEXT.pl.legacyBakingPaths[1]);
    expect([oven.text, ...oven.steps!]).toEqual(handWritten.bakingOptions!.option2);
    // Peter's changed note keeps its (machine) translation; nothing is left to ask for.
    expect(shown.notes).toBe('PL Will not work in an air fryer!');
    expect(needsTranslation(restored)).toBe(false);
    // Only the translation changes: no new version.
    expect({ ...restored, translations: undefined }).toEqual({
      ...machine,
      translations: undefined,
    });
  });

  it('runs once, and only on its owner’s phone', () => {
    const restored = restoreWandasPolish(machine, peter)!;
    // As it comes back from Firestore (maps may come back in another key order).
    expect(restoreWandasPolish(JSON.parse(JSON.stringify(restored)) as Recipe, peter)).toBeNull();
    expect(restoreWandasPolish(machine, { email: 'ola@example.com', name: 'Ola' })).toBeNull();
    expect(restoreWandasPolish(machine, null)).toBeNull();
    expect(restoreWandasPolish(WANDAS_CHEESE_BREAD, peter)).toBeNull();
  });
});

describe('retryDelayMs', () => {
  it('waits an hour after an unusable answer, doubling up to a day', () => {
    const hour = 60 * 60 * 1000;
    expect([1, 2, 3, 5, 6, 9].map(retryDelayMs)).toEqual([
      hour,
      2 * hour,
      4 * hour,
      16 * hour,
      24 * hour,
      24 * hour,
    ]);
  });
});
