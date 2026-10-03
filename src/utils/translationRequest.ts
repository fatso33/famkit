import { Language } from '../types/recipe';
import {
  INGREDIENT_WORD_KEYS,
  IngredientWords,
  Piece,
  PieceValue,
  TextKind,
  ingredientWords,
  pieceHash,
} from './translationPieces';

/**
 * One translation request, for any number of documents (a recipe now; a Make's title and
 * description later). Each request is precious: the family shares a small daily allowance, so
 * several documents travel together, and the reply's shape is fixed in advance so it can't
 * leave anything out: each piece asked for is a required, named field in the list it belongs
 * to (texts or ingredients). The reply is still untrusted: it's checked piece by piece
 * (reviewReply), and a piece that doesn't pass is asked for once more.
 */

/** A document to translate. */
export interface TranslationDoc {
  /** Who it is in the app (a recipe id). Not sent. */
  ref: string;
  /** The pieces to translate (see utils/translationPieces). */
  pieces: Piece[];
  /** The language it's written in, once settled; otherwise the translator says which. */
  language?: Language;
  /**
   * When only some of its pieces are asked for: all its text, and its current translation, so
   * new words match the old.
   */
  context?: { whole: unknown; current?: unknown };
}

/** What came back for one document: its language, and each piece's words, by fingerprint. */
export interface DocReply {
  ref: string;
  /** The document's language; undefined when the translator named none it could have. */
  detectedLanguage?: Language;
  values: Map<string, PieceValue>;
}

// --- Asking --------------------------------------------------------------------------------

/**
 * An ingredient row as sent. A row saved by the editor reads "name - amount" with the name
 * alongside: it's sent as the name and the amount, and rebuilt, rather than every word twice.
 * Only fields with words are sent; empty ones stay empty.
 */
export function ingredientRequest(words: IngredientWords): Record<string, string> {
  const fields: Record<string, string> = {};
  const { text, name } = words;
  if (name?.trim() && (text === name || text.startsWith(`${name} - `))) {
    fields.name = name;
    const amount = text.slice(name.length).replace(/^ - /, '');
    if (amount.trim()) fields.amount = amount;
  } else {
    fields.text = text;
    if (name?.trim()) fields.name = name;
  }
  for (const key of INGREDIENT_WORD_KEYS) {
    const value = words[key];
    if (key !== 'name' && value?.trim()) fields[key] = value;
  }
  return fields;
}

/** A row's translated words, from the fields sent and the fields that came back. */
function ingredientReply(
  source: IngredientWords,
  sent: Record<string, string>,
  raw: Record<string, unknown>,
): IngredientWords | undefined {
  const got = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : undefined);
  const has = (key: string) => Boolean(got(key)?.trim());
  // Every field sent must come back with words.
  if (!Object.keys(sent).every(has)) return undefined;
  const name = got('name');
  // Only an amount it was sent with: a reply mustn't give a row an amount it never had.
  const amount = 'amount' in sent ? got('amount') : undefined;
  const text = 'text' in sent ? got('text')! : amount ? `${name} - ${amount}` : name!;
  const words: IngredientWords = { text };
  for (const key of INGREDIENT_WORD_KEYS) {
    const value = got(key);
    if (key in sent || ((key === 'renderUnit' || key === 'renderUnitPlural') && value?.trim())) {
      if (value !== undefined) words[key] = value;
    } else if (typeof source[key] === 'string') {
      // Empty in the original, and not sent: empty here too.
      words[key] = source[key];
    }
  }
  return ingredientWords(words);
}

/** The shape the reply must have, for the service to hand to Gemini as a schema. */
export interface ReplyShape {
  documents: {
    key: string;
    /** It must name its language: the document's isn't settled. */
    detect: boolean;
    texts: string[];
    ingredients: { id: string; required: string[]; optional: string[] }[];
  }[];
}

export interface BuiltRequest {
  /** The documents as the prompt shows them. */
  payload: Record<string, unknown>;
  shape: ReplyShape;
  /** What each id stands for. */
  asked: Map<string, { doc: number; piece: Piece; sent?: Record<string, string> }>;
}

const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', pl: 'Polish' };

const KIND_NAMES: Record<TextKind, string> = {
  title: 'title',
  description: 'short description for its card',
  yield: 'yield line, like "For 1 loaf:"',
  tips: 'tips',
  notes: 'notes',
  step: 'step',
  stepTip: 'tip for the step',
  caption: 'photo caption',
  heading: 'section heading (a few words)',
  substep: 'part of a step',
  pathLabel: 'name on a switch between ways of doing a step (1-3 words)',
  pathText: 'step, done this way',
  pathStep: 'step, done this way',
  time: 'cooking time, like "overnight" or "1 h 10" (keep it this short, keep the numbers)',
  source: 'where the recipe came from, like "Aunt Ola\'s notebook"',
  makeTitle: "title of a family member's post about something they cooked",
  makeNote: "a family member's note about how their cooking went",
};

/** Each piece gets an id (p1, p2, …, unique across the request) in the list it belongs to. */
export function buildRequest(docs: TranslationDoc[]): BuiltRequest {
  const asked: BuiltRequest['asked'] = new Map();
  const payload: Record<string, unknown> = {};
  const shape: ReplyShape = { documents: [] };
  let count = 0;
  docs.forEach((doc, d) => {
    const key = `d${d + 1}`;
    const texts: { id: string; kind: string; text: string }[] = [];
    const ingredients: Record<string, string>[] = [];
    const docShape: ReplyShape['documents'][number] = {
      key,
      detect: !doc.language,
      texts: [],
      ingredients: [],
    };
    for (const piece of doc.pieces) {
      const id = `p${++count}`;
      if (piece.kind === 'ingredient') {
        const sent = ingredientRequest(piece.ingredient);
        asked.set(id, { doc: d, piece, sent });
        ingredients.push({ id, ...sent });
        // Into Polish, a row with a unit also gets the unit's forms by amount (utils/fractions).
        const unitForms =
          'unit' in sent ? ['renderUnit', 'renderUnitPlural'].filter((f) => !(f in sent)) : [];
        docShape.ingredients.push({
          id,
          required: [...Object.keys(sent), ...(doc.language === 'en' ? unitForms : [])],
          optional: doc.language === undefined ? unitForms : [],
        });
      } else {
        asked.set(id, { doc: d, piece });
        texts.push({ id, kind: KIND_NAMES[piece.kind], text: piece.text });
        docShape.texts.push(id);
      }
    }
    payload[key] = {
      from: doc.language ? LANGUAGE_NAMES[doc.language] : 'unknown',
      ...(doc.context ? { context: doc.context } : {}),
      ...(texts.length > 0 ? { texts } : {}),
      ...(ingredients.length > 0 ? { ingredients } : {}),
    };
    shape.documents.push(docShape);
  });
  return { payload, shape, asked };
}

// --- The reply -----------------------------------------------------------------------------

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads the reply against what was asked: per document, its language and the pieces that came
 * back in the list they were asked in, with words in every field. Anything else is left out, so
 * the piece counts as missing. Throws only when the reply isn't the right shape at all.
 */
export function parseReply(
  raw: unknown,
  docs: TranslationDoc[],
  request: BuiltRequest,
): DocReply[] {
  if (!isObject(raw) || !isObject(raw.documents)) {
    throw new Error('Translation response has no documents');
  }
  const documents = raw.documents;
  const replies: DocReply[] = docs.map((doc, d) => {
    const reply = documents[`d${d + 1}`];
    const named = isObject(reply) ? reply.detectedLanguage : undefined;
    const detectedLanguage =
      doc.language ?? (named === 'en' || named === 'pl' ? (named as Language) : undefined);
    return { ref: doc.ref, detectedLanguage, values: new Map() };
  });

  for (const [id, { doc: d, piece, sent }] of request.asked) {
    const reply = documents[`d${d + 1}`];
    if (!isObject(reply)) continue;
    const { detectedLanguage, values } = replies[d];
    if (piece.kind === 'ingredient') {
      const row = isObject(reply.ingredients) ? reply.ingredients[id] : undefined;
      const words = isObject(row) ? ingredientReply(piece.ingredient, sent!, row) : undefined;
      if (!words) continue;
      // Into English: the Polish unit forms don't apply (English reads renderUnit as a plural).
      if (detectedLanguage === 'pl') {
        delete words.renderUnit;
        delete words.renderUnitPlural;
      }
      values.set(pieceHash(piece), words);
    } else {
      const text = isObject(reply.texts) ? reply.texts[id] : undefined;
      if (typeof text === 'string' && text.trim()) values.set(pieceHash(piece), text);
    }
  }
  return replies;
}

// --- Checking each piece -------------------------------------------------------------------

const VULGAR: Record<string, number> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅐': 1 / 7,
  '⅑': 1 / 9,
  '⅒': 1 / 10,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const FRACTION_CHARS = Object.keys(VULGAR).join('');
// "1 1/2" (or "1 and 1/2", "1 i 1/2"), "1/2", "1½", "1 ½", "1.5", "1,5", "½", "450": one amount
// each. A decimal comma is how Polish writes a decimal point.
const AMOUNT = new RegExp(
  String.raw`(\d+)\s+(?:(?:and|i)\s+)?(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:[.,]\d+)?)\s*([${FRACTION_CHARS}])|(\d+(?:[.,]\d+)?)|([${FRACTION_CHARS}])`,
  'gu',
);

/** The amounts in some words, as numbers, smallest first: what a translation must keep. */
export function amountsIn(text: string): number[] {
  const amounts: number[] = [];
  const decimal = (s: string) => Number(s.replace(',', '.'));
  for (const m of text.matchAll(AMOUNT)) {
    if (m[1]) amounts.push(Number(m[1]) + Number(m[2]) / Number(m[3]));
    else if (m[4]) amounts.push(Number(m[4]) / Number(m[5]));
    else if (m[6]) amounts.push(decimal(m[6]) + VULGAR[m[7]]);
    else if (m[8]) amounts.push(decimal(m[8]));
    else if (m[9]) amounts.push(VULGAR[m[9]]);
  }
  return amounts.sort((a, b) => a - b);
}

const wordsOf = (value: PieceValue) =>
  typeof value === 'string' ? value : Object.values(value).join('\n');

/** Whether every amount of the original is still in the translation (each as often). */
function keepsAmounts(source: number[], translated: number[]): boolean {
  const left = [...translated];
  return source.every((n) => {
    const at = left.findIndex((m) => Math.abs(m - n) < 1e-6);
    if (at >= 0) left.splice(at, 1);
    return at >= 0;
  });
}

const sameWords = (a: PieceValue, b: PieceValue) =>
  JSON.stringify(typeof a === 'string' ? a.trim() : ingredientWords(a)) ===
  JSON.stringify(typeof b === 'string' ? b.trim() : ingredientWords(b));

/**
 * What's wrong with a piece's translation, if anything: an amount of the original is missing or
 * changed ("numbers": a cook must never get the wrong amount; a number written as a digit, or a
 * measure added, is harmless), or words came back exactly as sent, still in the original language
 * ("untranslated"). A word or two may rightly be the same in both ("Pierogi", "oregano"), so only
 * longer words count: asking again for those would spend a request for nothing.
 */
export function pieceProblem(source: PieceValue, translated: PieceValue) {
  if (!keepsAmounts(amountsIn(wordsOf(source)), amountsIn(wordsOf(translated)))) return 'numbers';
  const words = wordsOf(source).match(/\p{L}+/gu)?.length ?? 0;
  if (words >= 3 && sameWords(source, translated)) return 'untranslated';
  return null;
}

/** A document's reply, checked: what to keep, what to ask for again, what to give up on. */
export interface ReviewedReply {
  values: Map<string, PieceValue>;
  /** Missing, or with a problem: asked for once more. */
  retry: Piece[];
  /** Still wrong when asked once more: left in the original's words until the text changes. */
  gaveUp: Piece[];
}

/**
 * Checks each piece of a document's reply. On the first try, a missing piece or one with a
 * problem is asked for again. On the last try, words that came back the same are taken as they
 * are (they're the same in both languages); amounts that still differ are given up on, so the
 * original's words stay; a missing piece waits for a later request.
 */
export function reviewReply(doc: TranslationDoc, reply: DocReply, lastTry: boolean): ReviewedReply {
  const reviewed: ReviewedReply = { values: new Map(), retry: [], gaveUp: [] };
  for (const piece of doc.pieces) {
    const hash = pieceHash(piece);
    const value = reply.values.get(hash);
    const source = piece.kind === 'ingredient' ? piece.ingredient : piece.text;
    const problem = value === undefined ? 'missing' : pieceProblem(source, value);
    if (!problem || (lastTry && problem === 'untranslated')) {
      reviewed.values.set(hash, value!);
    } else if (!lastTry) {
      reviewed.retry.push(piece);
    } else if (problem === 'numbers') {
      reviewed.gaveUp.push(piece);
    }
  }
  return reviewed;
}
