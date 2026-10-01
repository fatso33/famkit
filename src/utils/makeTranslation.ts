import { Language } from '../types/recipe';
import { Make, MakeTranslation } from '../types/make';
import { Piece, fnv1a, pieceHash } from './translationPieces';
import type { TranslationDoc } from './translationRequest';
import {
  PieceTranslation,
  TRANSLATION_GRACE_MS,
  languageFits,
  otherLanguage,
} from './recipeTranslation';
import { EDIT_SETTLE_MS, LocalTranslationState } from './translationQueue';

/**
 * A make's words (its title and note) in the family's other language. They join the recipes'
 * translation queue and ride in the same requests (hooks/useTranslationQueue), and, like an
 * edited recipe, a make waits EDIT_SETTLE_MS after its last save: a fixed typo costs nothing,
 * and a make almost always travels with a request that was going anyway.
 *
 * Translations work piece by piece ('title', 'note'), remembered by the fingerprint of the
 * words they translate, so an edit to the note keeps the title's translation.
 */

/** The language a make's words are in: the app's language when it was added, until settled. */
export function makeLanguage(make: Pick<Make, 'sourceLanguage'>): Language {
  return make.sourceLanguage ?? 'en';
}

/** A make's words to translate: its title and note, where they have words. */
export function makePieces(make: Pick<Make, 'title' | 'note'>): Piece[] {
  const pieces: Piece[] = [];
  if (make.title?.trim()) pieces.push({ key: 'title', kind: 'makeTitle', text: make.title });
  if (make.note?.trim()) pieces.push({ key: 'note', kind: 'makeNote', text: make.note });
  return pieces;
}

/** Fingerprint of a make's words. Changes whenever its translation would go out of date. */
export function makeSourceHash(make: Pick<Make, 'title' | 'note'>): string {
  return fnv1a(JSON.stringify({ title: make.title ?? '', note: make.note ?? '' }));
}

const otherTranslation = (make: Make): MakeTranslation | undefined =>
  make.translations?.[otherLanguage(makeLanguage(make))];

/** The translated words a make already has, by the fingerprint of the words they translate. */
export function makeMemory(make: Make): Map<string, string> {
  const tr = otherTranslation(make);
  const memory = new Map<string, string>();
  if (!tr) return memory;
  for (const [key, hash] of Object.entries(tr.pieceSources ?? {})) {
    const value = key === 'title' ? tr.title : key === 'note' ? tr.note : undefined;
    if (typeof value === 'string' && value.trim()) memory.set(hash, value);
  }
  return memory;
}

/**
 * The pieces with no translation yet. A piece the translator got wrong twice waits until its
 * words change (MakeTranslation.untranslated).
 */
export function pendingMakePieces(make: Make): Piece[] {
  const memory = makeMemory(make);
  const gaveUp = otherTranslation(make)?.untranslated ?? {};
  return makePieces(make).filter((piece) => {
    const hash = pieceHash(piece);
    return !memory.has(hash) && gaveUp[piece.key] !== hash;
  });
}

export type MakeTranslationStatus = 'source' | 'fresh' | 'stale' | 'missing';

export function makeTranslationStatus(make: Make, lang: Language): MakeTranslationStatus {
  if (lang === makeLanguage(make)) return 'source';
  const tr = make.translations?.[lang];
  if (!tr) return 'missing';
  return tr.sourceHash === makeSourceHash(make) ? 'fresh' : 'stale';
}

/** Whether the make's other language needs work: it has words, and some aren't translated. */
export function makeNeedsTranslation(make: Make): boolean {
  if (makePieces(make).length === 0) return false;
  const status = makeTranslationStatus(make, otherLanguage(makeLanguage(make)));
  return status !== 'fresh' || pendingMakePieces(make).length > 0;
}

/** Whether a reader in `lang` is waiting for some of the make's words. */
export function makeTranslationPending(make: Make, lang: Language): boolean {
  return lang !== makeLanguage(make) && makeNeedsTranslation(make);
}

/**
 * The make as a reader in `lang` sees it: each piece in their language where its translation is
 * current, the original's words where it isn't (never an old translation of changed words).
 */
export function localizeMake(make: Make, lang: Language): Make {
  if (lang === makeLanguage(make) || !make.translations?.[lang]) return make;
  const memory = makeMemory(make);
  const shown = (piece: Piece | undefined, original: string | undefined) =>
    piece ? (memory.get(pieceHash(piece)) ?? original) : original;
  const pieces = makePieces(make);
  return {
    ...make,
    title: shown(
      pieces.find((p) => p.key === 'title'),
      make.title,
    ),
    note: shown(
      pieces.find((p) => p.key === 'note'),
      make.note,
    ),
  };
}

/**
 * The make as a translation request: its pending pieces, its language once settled (a make that
 * has had a translation), and, when only some pieces are asked for, all its words and their
 * current translation, so new words match the old.
 */
export function makeTranslationDoc(make: Make, pieces: Piece[], sofar?: PieceTranslation) {
  const base = sofar ? applyMakeTranslation(make, sofar, makeSourceHash(make)) : make;
  const settled = Object.values(base.translations ?? {}).some(Boolean);
  const doc: TranslationDoc = {
    ref: `make:${make.id}`,
    pieces,
    language: settled ? makeLanguage(base) : undefined,
  };
  if (pieces.length < makePieces(base).length) {
    const tr = otherTranslation(base);
    doc.context = {
      whole: { title: base.title ?? '', note: base.note ?? '' },
      ...(tr ? { current: { title: tr.title ?? '', note: tr.note ?? '' } } : {}),
    };
  }
  return doc;
}

/** Whether a reply's language label fits the make's words (see languageFits). */
export function makeTranslationFits(make: Make, result: PieceTranslation): boolean {
  return languageFits(
    makePieces(make).map((p) => (p.kind === 'ingredient' ? '' : p.text)),
    result,
    makeLanguage(make),
  );
}

/**
 * Stores finished pieces: what the make already had plus the new ones, stamped as current. A
 * translation of words that have changed since (`hashAtRequest`) is ignored. A corrected
 * language starts from the new pieces alone. Never touches the make's own fields or edit time.
 */
export function applyMakeTranslation(
  make: Make,
  result: PieceTranslation,
  hashAtRequest: string,
  now = Date.now(),
): Make {
  if (makeSourceHash(make) !== hashAtRequest) return make;
  const language = result.detectedLanguage;
  const sameLanguage = language === makeLanguage(make);
  const memory = new Map(sameLanguage ? makeMemory(make) : []);
  for (const [hash, value] of result.values) if (typeof value === 'string') memory.set(hash, value);

  const before = sameLanguage ? otherTranslation(make)?.untranslated : undefined;
  const tr: MakeTranslation = {
    sourceHash: makeSourceHash(make),
    pieceSources: {},
    translatedAt: now,
  };
  const untranslated: Record<string, string> = {};
  for (const piece of makePieces(make)) {
    if (piece.kind === 'ingredient') continue;
    const hash = pieceHash(piece);
    const value = memory.get(hash);
    if (value !== undefined) {
      tr[piece.key as 'title' | 'note'] = value;
      tr.pieceSources![piece.key] = hash;
    } else if (before?.[piece.key] === hash) {
      untranslated[piece.key] = hash;
    }
  }
  for (const piece of result.gaveUp ?? []) untranslated[piece.key] = pieceHash(piece);
  if (Object.keys(untranslated).length > 0) tr.untranslated = untranslated;

  const translations = { ...make.translations };
  delete translations[language];
  translations[otherLanguage(language)] = tr;
  return { ...make, sourceLanguage: language, translations };
}

/**
 * When the make's translation is due on this phone: like an edit, once it has had no saves for
 * EDIT_SETTLE_MS (other phones give the phone that saved it a head start); a translation still
 * missing pieces is finished at once by the phone that made it.
 */
export function makeTranslationDueAt(make: Make, here: LocalTranslationState): number {
  const status = makeTranslationStatus(make, otherLanguage(makeLanguage(make)));
  const headStart = (mine: boolean) => (mine ? 0 : TRANSLATION_GRACE_MS);
  if (status === 'missing' || status === 'stale') {
    return make.updatedAt + EDIT_SETTLE_MS + headStart(here.savedHere);
  }
  const translatedAt = otherTranslation(make)?.translatedAt ?? 0;
  return here.translatedHere ? 0 : translatedAt + headStart(false);
}
