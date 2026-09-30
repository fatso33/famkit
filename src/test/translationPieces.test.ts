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
import { Piece } from '../utils/translationPieces';

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
    // Every piece still has its words, so the translation is current straight away.
    expect(needsTranslation(moved)).toBe(false);
    expect(pendingPieces(moved)).toEqual([]);
    expect(localizeRecipe(moved, 'pl').steps[4].text).toBe(`PL ${steps[4].text}`);
    expect(localizeRecipe(moved, 'pl').steps[5].text).toBe(`PL ${steps[5].text}`);
  });

  it("translates a fork path's own tip and caption, and keeps its photo and a restart", () => {
    const recipe: Recipe = {
      ...WANDAS_CHEESE_BREAD,
      laminationDirective: undefined,
      bakingOptions: undefined,
      translations: undefined,
      steps: [
        { num: 1, text: 'Mix.' },
        {
          num: 1,
          text: 'Bake.',
          section: 'Baking',
          restart: true,
          fork: {
            paths: [
              { label: 'Oven', text: 'Bake.' },
              {
                label: 'Pan',
                text: 'Fry.',
                notes: 'Low heat.',
                hasImage: true,
                imageSrc: 'data:pan',
                imageCaption: 'Golden',
              },
            ],
          },
        },
      ],
    };
    const pieces = pendingPieces(recipe);
    expect(pieces.map((p) => p.key)).toEqual(
      expect.arrayContaining(['steps:1:fork:1:notes', 'steps:1:fork:1:imageCaption']),
    );
    const done = applyTranslation(recipe, answer(pieces), sourceHash(recipe));
    const pl = localizeRecipe(done, 'pl').steps[1];
    expect(pl.restart).toBe(true);
    expect(pl.fork!.paths[1]).toMatchObject({
      notes: 'PL Low heat.',
      imageCaption: 'PL Golden',
      imageSrc: 'data:pan',
    });
  });

  it('stores nothing undefined (Firestore rejects it)', () => {
    const tr = translated.translations!.pl!;
    expect(JSON.parse(JSON.stringify(tr))).toEqual(tr);
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
