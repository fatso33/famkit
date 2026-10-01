import { describe, it, expect } from 'vitest';
import { Make } from '../types/make';
import {
  applyMakeTranslation,
  localizeMake,
  makePieces,
  makeSourceHash,
  makeTranslationDoc,
  makeTranslationDueAt,
  makeTranslationPending,
  pendingMakePieces,
} from '../utils/makeTranslation';
import { EDIT_SETTLE_MS } from '../utils/translationQueue';
import { TRANSLATION_GRACE_MS } from '../utils/recipeTranslation';
import { pieceHash } from '../utils/translationPieces';

const make = (over: Partial<Make> = {}): Make => ({
  id: 'make-1',
  recipeId: 'recipe-1',
  photo: 'data:image/jpeg;base64,AAAA',
  title: 'Sunday loaves',
  note: 'Doubled it.',
  sourceLanguage: 'en',
  createdAt: 1000,
  updatedAt: 1000,
  ...over,
});

const POLISH: Record<string, string> = {
  'Sunday loaves': 'Niedzielne bochenki',
  'Doubled it.': 'Podwoiłam.',
  'Doubled it, two loaves.': 'Podwoiłam, dwa bochenki.',
};
/** The translator's answer for these pieces, from the dictionary above. */
const answer = (m: Make, language: 'en' | 'pl' = 'en') => ({
  detectedLanguage: language,
  values: new Map(
    makePieces(m).flatMap((p) =>
      p.kind !== 'ingredient' && POLISH[p.text] ? [[pieceHash(p), POLISH[p.text]] as const] : [],
    ),
  ),
});

describe('make translation', () => {
  it('asks for the title and note of a new make, letting the translator name its language', () => {
    const m = make();
    expect(pendingMakePieces(m).map((p) => p.key)).toEqual(['title', 'note']);
    const doc = makeTranslationDoc(m, pendingMakePieces(m));
    expect(doc).toMatchObject({ ref: 'make:make-1', language: undefined });
    expect(doc.context).toBeUndefined();
    // Nothing to translate without words.
    expect(makeTranslationPending(make({ title: undefined, note: undefined }), 'pl')).toBe(false);
  });

  it('shows a translated make in the other language, and the original in its own', () => {
    const m = applyMakeTranslation(make(), answer(make()), makeSourceHash(make()), 5);
    expect(localizeMake(m, 'pl')).toMatchObject({
      title: 'Niedzielne bochenki',
      note: 'Podwoiłam.',
    });
    expect(localizeMake(m, 'en').title).toBe('Sunday loaves');
    expect(makeTranslationPending(m, 'pl')).toBe(false);
    expect(m.translations?.pl?.translatedAt).toBe(5);
  });

  it('after an edit, keeps the unchanged piece and shows the changed one as written', () => {
    const translated = applyMakeTranslation(make(), answer(make()), makeSourceHash(make()));
    const edited = { ...translated, note: 'Doubled it, two loaves.', updatedAt: 2000 };
    expect(localizeMake(edited, 'pl')).toMatchObject({
      title: 'Niedzielne bochenki',
      note: 'Doubled it, two loaves.',
    });
    expect(pendingMakePieces(edited).map((p) => p.key)).toEqual(['note']);
    // Only the note is asked for, with the rest for context.
    const doc = makeTranslationDoc(edited, pendingMakePieces(edited));
    expect(doc.language).toBe('en');
    expect(doc.context).toEqual({
      whole: { title: 'Sunday loaves', note: 'Doubled it, two loaves.' },
      current: { title: 'Niedzielne bochenki', note: 'Podwoiłam.' },
    });
    const done = applyMakeTranslation(edited, answer(edited), makeSourceHash(edited));
    expect(localizeMake(done, 'pl').note).toBe('Podwoiłam, dwa bochenki.');
  });

  it('ignores a translation of words that have changed since it was asked for', () => {
    const asked = makeSourceHash(make());
    const changed = make({ title: 'Saturday loaves' });
    expect(applyMakeTranslation(changed, answer(make()), asked)).toBe(changed);
  });

  it('relabels a make written in the other language than the app was in', () => {
    const polish = make({ title: 'Niedzielne bochenki', note: undefined });
    const result = {
      detectedLanguage: 'pl' as const,
      values: new Map([[pieceHash(makePieces(polish)[0]), 'Sunday loaves']]),
    };
    const m = applyMakeTranslation(polish, result, makeSourceHash(polish));
    expect(m.sourceLanguage).toBe('pl');
    expect(localizeMake(m, 'en').title).toBe('Sunday loaves');
    expect(m.translations?.pl).toBeUndefined();
  });

  it('waits for a new or edited make to settle, giving the phone that saved it a head start', () => {
    const m = make({ updatedAt: 1000 });
    const mine = { savedHere: true, translatedHere: false };
    const theirs = { savedHere: false, translatedHere: false };
    expect(makeTranslationDueAt(m, mine)).toBe(1000 + EDIT_SETTLE_MS);
    expect(makeTranslationDueAt(m, theirs)).toBe(1000 + EDIT_SETTLE_MS + TRANSLATION_GRACE_MS);
  });
});
