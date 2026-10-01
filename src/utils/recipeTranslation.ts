import {
  Ingredient,
  Language,
  LocalizedRecipeContent,
  Recipe,
  Step,
  StepFork,
} from '../types/recipe';
import {
  Piece,
  PieceValue,
  buildTranslation,
  fnv1a,
  pieceHash,
  pieceValue,
  recipePieces,
  tidyPieceHash,
} from './translationPieces';
import type { TranslationDoc } from './translationRequest';

export const LANGUAGES: readonly Language[] = ['en', 'pl'];

// Recipes saved on another device wait this long before this device translates them,
// so every family phone doesn't translate the same save at once.
export const TRANSLATION_GRACE_MS = 2 * 60 * 1000;

export type TranslationStatus = 'source' | 'fresh' | 'legacy' | 'stale' | 'missing';

/** Translated words, remembered by the fingerprint of the words they translate. */
export type TranslationMemory = Map<string, PieceValue>;

/** A finished translation request: the recipe's language, and the pieces' new words. */
export interface PieceTranslation {
  detectedLanguage: Language;
  values: TranslationMemory;
  /** Pieces the translator got wrong twice: they keep the original's words (see reviewReply). */
  gaveUp?: Piece[];
}

export function otherLanguage(lang: Language): Language {
  return lang === 'en' ? 'pl' : 'en';
}

/** Language the recipe was written in. Records from before two-way translation are English. */
export function sourceLanguageOf(recipe: Recipe): Language {
  return recipe.sourceLanguage ?? 'en';
}

/** The text a translator needs: everything readable, but no photos or ids. */
export function translatableContent(recipe: Recipe): LocalizedRecipeContent {
  return {
    name: recipe.name,
    cardDescription: recipe.cardDescription,
    yieldHeader: recipe.yieldHeader,
    tips: recipe.tips,
    notes: recipe.notes,
    laminationDirective: recipe.laminationDirective,
    ingredients: (recipe.ingredients || []).map((ing) => ({
      text: ing.text,
      name: ing.name,
      qty: ing.qty,
      unit: ing.unit,
      altQty: ing.altQty,
      altUnit: ing.altUnit,
      prefix: ing.prefix,
      suffix: ing.suffix,
      renderUnit: ing.renderUnit,
      renderUnitPlural: ing.renderUnitPlural,
      // Newer fields last, and missing on older rows, so their fingerprint doesn't change.
      note: ing.note,
      substitute: ing.substitute,
      substituteAmount: ing.substituteAmount,
      section: ing.section,
    })),
    steps: (recipe.steps || []).map((st) => ({
      num: st.num,
      text: st.text,
      notes: st.notes,
      imageCaption: st.imageCaption,
      section: st.section,
      substeps: st.substeps,
      fork: st.fork && {
        paths: st.fork.paths.map((path) => ({
          label: path.label,
          text: path.text,
          steps: path.steps,
          // Newer fields last, and missing on older forks, so their fingerprint doesn't change.
          notes: path.notes,
          imageCaption: path.imageCaption,
        })),
      },
    })),
    bakingOptions: recipe.bakingOptions,
  };
}

// A translated list in the source's shape: one entry per source entry, the original where the
// translation has none.
const overlayList = (source?: string[], translated?: string[]) =>
  source?.map((text, i) => translated?.[i] ?? text);

function overlayFork(source: StepFork, translated?: StepFork): StepFork {
  return {
    paths: source.paths.map((path, i) => {
      const t = translated?.paths[i];
      return {
        ...path,
        label: t?.label ?? path.label,
        text: t?.text ?? path.text,
        steps: overlayList(path.steps, t?.steps),
        notes: path.notes === undefined ? undefined : (t?.notes ?? path.notes),
        imageCaption:
          path.imageCaption === undefined ? undefined : (t?.imageCaption ?? path.imageCaption),
      };
    }),
  };
}

/** Fingerprint of the recipe's source text. Changes whenever a translation would go stale. */
export function sourceHash(recipe: Recipe): string {
  // JSON.stringify drops undefined keys, so missing and undefined fields hash the same.
  return fnv1a(JSON.stringify(translatableContent(recipe)));
}

export function translationStatus(recipe: Recipe, lang: Language): TranslationStatus {
  if (lang === sourceLanguageOf(recipe)) return 'source';
  const tr = recipe.translations?.[lang];
  if (!tr) return 'missing';
  if (tr.sourceHash === undefined) return 'legacy';
  return tr.sourceHash === sourceHash(recipe) ? 'fresh' : 'stale';
}

// --- Translation memory --------------------------------------------------------------------

/** Pieces of `source` and `translated` at the same place, as memory. */
export function pairedMemory(
  source: LocalizedRecipeContent,
  translated: LocalizedRecipeContent,
): TranslationMemory {
  const values = new Map(recipePieces(translated).map((p) => [p.key, pieceValue(p)]));
  const memory: TranslationMemory = new Map();
  for (const piece of recipePieces(source)) {
    const value = values.get(piece.key);
    if (value !== undefined) memory.set(pieceHash(piece), value);
  }
  return memory;
}

/** What a translation remembers: its pieces, by the fingerprint of what each translates. */
function storedMemory(tr: LocalizedRecipeContent): TranslationMemory {
  const values = new Map(recipePieces(tr).map((p) => [p.key, pieceValue(p)]));
  const memory: TranslationMemory = new Map();
  for (const [key, hash] of Object.entries(tr.pieceSources ?? {})) {
    const value = values.get(key);
    if (value !== undefined) memory.set(hash, value);
  }
  return memory;
}

/**
 * The translated words the recipe already has for its other language. A translation made before
 * pieces counts only while it's current, when its pieces line up with the recipe's.
 */
export function translationMemory(recipe: Recipe): TranslationMemory {
  const tr = recipe.translations?.[otherLanguage(sourceLanguageOf(recipe))];
  if (!tr) return new Map();
  if (tr.pieceSources) return storedMemory(tr);
  if (tr.sourceHash === sourceHash(recipe)) return pairedMemory(translatableContent(recipe), tr);
  return new Map();
}

// Each language's unit words, which a translation into the other shouldn't keep: translations
// made while the prompt said to keep amounts "exactly as written" read "Mąka - 2 cups". Whole
// words only (not "Cup4Cup"), with Polish typed without its letters too. "Stick" isn't here: a
// stick of butter isn't a kostka, so it may rightly stay.
const unitWords = (list: string) => new RegExp(`(?<![\\p{L}\\d])(?:${list})(?![\\p{L}\\d])`, 'iu');
const UNIT_WORDS: Record<Language, RegExp> = {
  en: unitWords(
    'cups?|tsps?|teaspoons?|tbsps?|tbs|tablespoons?|oz|ounces?|lbs?|pounds?|pints?|quarts?|gallons?|cloves?|pinch(?:es)?|dash(?:es)?|handfuls?',
  ),
  pl: unitWords(
    'szklan\\p{L}*|łyż\\p{L}*|lyz\\p{L}*|szczypt\\p{L}*|ząb(?:ek|ki|ków|ka)|garś\\p{L}*|dag|dkg|opakowa\\p{L}*|pusz\\p{L}*|kost(?:ka|ki|kę|ek)|sztuk\\p{L}*',
  ),
};

/** Whether translated words still hold unit words of the language they were translated from. */
export function keepsSourceUnits(value: PieceValue, source: Language): boolean {
  const texts = typeof value === 'string' ? [value] : Object.values(value);
  return texts.some((text) => typeof text === 'string' && UNIT_WORDS[source].test(text));
}

/**
 * Whether the recipe's translation predates translated units, so each remembered piece that kept
 * its original's units is asked for once more. The next translation stored is stamped
 * (`unitsTranslated`), so whatever comes back then stays: nothing is asked for twice.
 */
function checksUnits(recipe: Recipe): boolean {
  const tr = recipe.translations?.[otherLanguage(sourceLanguageOf(recipe))];
  return Boolean(tr && !tr.unitsTranslated);
}

/**
 * The recipe's pieces that have no translation yet, or one that kept its original's units (see
 * checksUnits), each once (same words, one piece). A piece the translator got wrong twice isn't
 * asked for again until its words change (LocalizedRecipeContent.untranslated).
 */
export function pendingPieces(recipe: Recipe): Piece[] {
  const memory = translationMemory(recipe);
  const source = sourceLanguageOf(recipe);
  const recheck = checksUnits(recipe);
  const gaveUp = recipe.translations?.[otherLanguage(source)]?.untranslated ?? {};
  const seen = new Set<string>();
  return recipePieces(translatableContent(recipe)).filter((piece) => {
    const hash = pieceHash(piece);
    const known = memory.get(hash);
    const done = known !== undefined && !(recheck && keepsSourceUnits(known, source));
    if (done || gaveUp[piece.key] === hash || seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}

/** Whether every piece of the recipe has words in its other language. */
function translationComplete(recipe: Recipe): boolean {
  const memory = translationMemory(recipe);
  return recipePieces(translatableContent(recipe)).every((p) => memory.has(pieceHash(p)));
}

/**
 * The recipe as a translation request: its pending pieces, its language once settled, and, when
 * only some pieces are asked for, all its text and its current translation for context.
 */
export function recipeTranslationDoc(recipe: Recipe, pieces: Piece[]): TranslationDoc {
  const content = translatableContent(recipe);
  const all = new Set(recipePieces(content).map(pieceHash));
  const doc: TranslationDoc = {
    ref: recipe.id,
    pieces,
    language: languageSettled(recipe) ? sourceLanguageOf(recipe) : undefined,
  };
  if (pieces.length < all.size) {
    const memory = translationMemory(recipe);
    doc.context = {
      whole: defined(content),
      ...(memory.size > 0
        ? { current: buildTranslation(content, (p) => memory.get(pieceHash(p))).content }
        : {}),
    };
  }
  return doc;
}

/**
 * Whether the recipe's other language needs work: missing, outdated, from before fingerprinting,
 * or current but missing some pieces (e.g. a fork the model left out).
 */
export function needsTranslation(recipe: Recipe): boolean {
  const status = translationStatus(recipe, otherLanguage(sourceLanguageOf(recipe)));
  return status !== 'fresh' || pendingPieces(recipe).length > 0;
}

/**
 * Whether the recipe's language is settled: it has, or had, a translation. A new recipe's
 * language is only the app language it was added in, so the translator checks it.
 */
export function languageSettled(recipe: Recipe): boolean {
  return Object.values(recipe.translations ?? {}).some(Boolean);
}

/**
 * How long this device waits before asking again for a translation that came back unusable:
 * an hour, doubling each time, at most a day. Losing the connection isn't counted.
 */
export function retryDelayMs(failures: number): number {
  const hour = 60 * 60 * 1000;
  return Math.min(24 * hour, hour * 2 ** Math.max(0, failures - 1));
}

/** Language a viewer actually sees: theirs if a usable translation exists, else the original. */
export function displayedLanguage(recipe: Recipe, viewerLanguage: Language): Language {
  const status = translationStatus(recipe, viewerLanguage);
  return status === 'fresh' || status === 'legacy' ? viewerLanguage : sourceLanguageOf(recipe);
}

/**
 * Lays translated text over the recipe. Quantities, step numbers, photos and the method's shape
 * (sections, unnumbered text, substeps, forks) always come from the original, so a translation
 * can't change amounts, drop step photos or rearrange the steps.
 */
export function overlayTranslation(recipe: Recipe, tr: LocalizedRecipeContent): Recipe {
  const ingredients: Ingredient[] = (recipe.ingredients || []).map((src, i) => {
    const t = tr.ingredients?.[i];
    return t
      ? {
          ...t,
          qty: src.qty,
          altQty: src.altQty,
          note: t.note ?? src.note,
          substitute: t.substitute ?? src.substitute,
          substituteAmount: t.substituteAmount ?? src.substituteAmount,
          section: src.section === undefined ? undefined : (t.section ?? src.section),
        }
      : src;
  });
  const steps: Step[] = (recipe.steps || []).map((src, i) => {
    const t = tr.steps?.[i];
    return t
      ? {
          ...t,
          num: src.num,
          hasImage: src.hasImage,
          imageSrc: src.imageSrc,
          plain: src.plain,
          restart: src.restart,
          section: src.section === undefined ? undefined : (t.section ?? src.section),
          substeps: overlayList(src.substeps, t.substeps),
          fork: src.fork && overlayFork(src.fork, t.fork),
        }
      : src;
  });
  return {
    ...recipe,
    name: tr.name || recipe.name,
    cardDescription: tr.cardDescription || recipe.cardDescription,
    yieldHeader: tr.yieldHeader || recipe.yieldHeader,
    tips: tr.tips !== undefined ? tr.tips : recipe.tips,
    notes: tr.notes !== undefined ? tr.notes : recipe.notes,
    // The legacy blocks only where the recipe still has them: once the editor has made them
    // steps, an older translation mustn't bring them back.
    laminationDirective:
      recipe.laminationDirective && (tr.laminationDirective ?? recipe.laminationDirective),
    ingredients: tr.ingredients && tr.ingredients.length > 0 ? ingredients : recipe.ingredients,
    steps: tr.steps && tr.steps.length > 0 ? steps : recipe.steps,
    bakingOptions: recipe.bakingOptions && (tr.bakingOptions || recipe.bakingOptions),
  };
}

/**
 * The recipe as a viewer in `lang` should see it. After an edit, while its translation waits
 * (see utils/translationQueue), every piece the edit didn't change stays in the viewer's language
 * and the changed ones show the original's words: never the old translation of a changed piece,
 * which could give an amount the edit corrected.
 */
export function localizeRecipe(recipe: Recipe, lang: Language): Recipe {
  const status = translationStatus(recipe, lang);
  const tr = recipe.translations?.[lang];
  if (!tr) return recipe;
  if (status === 'fresh' || status === 'legacy') return overlayTranslation(recipe, tr);
  if (status === 'stale' && tr.pieceSources) {
    const memory = storedMemory(tr);
    const { content } = buildTranslation(translatableContent(recipe), (p) =>
      memory.get(pieceHash(p)),
    );
    return overlayTranslation(recipe, content);
  }
  return recipe;
}

/**
 * Whether a viewer in `lang` is waiting for some of the recipe's words: it's written in the
 * other language, and its translation isn't finished (new, edited, or missing pieces).
 */
export function translationPending(recipe: Recipe, lang: Language): boolean {
  return lang !== sourceLanguageOf(recipe) && needsTranslation(recipe);
}

// --- Checking the language ------------------------------------------------------------------

// Letters only Polish uses, and short words common in one language's recipes but not the
// other's. Polish typed on a phone often lacks the letters, so the words count too.
const POLISH_LETTERS = /[ąćęłńóśźż]/giu;
// Whole words, where a word may hold Polish letters (\b only knows a-z).
const words = (list: string) => new RegExp(`(?<!\\p{L})(${list})(?!\\p{L})`, 'giu');
const POLISH_WORDS = words('i|w|z|ze|na|nie|się|sie|oraz|lub|aż|az|po|od|przez|minut');
const ENGLISH_WORDS = words('the|and|with|until|into|of|for|then|add|your|minutes|it');

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

/** How Polish the text reads: positive for Polish, negative for English. */
function polishScore(text: string): number {
  return count(text, POLISH_LETTERS) + count(text, POLISH_WORDS) - count(text, ENGLISH_WORDS);
}

const wordsOf = (values: Iterable<PieceValue>) =>
  [...values].map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join('\n');

/**
 * Whether a translation's language labels fit the text: the side called Polish must read more
 * Polish than the other. The model sometimes names the wrong source language, which would store
 * the English as "Polish" and the Polish as "English". When the text gives no clue, it may only
 * confirm the recipe's current language, never relabel it.
 */
export function translationFitsRecipe(recipe: Recipe, result: PieceTranslation): boolean {
  return languageFits(
    recipePieces(translatableContent(recipe)).map(pieceValue),
    result,
    sourceLanguageOf(recipe),
  );
}

/**
 * Whether a translation's language labels fit any document's words (`source`, in what's taken
 * as `current` language until then): see translationFitsRecipe.
 */
export function languageFits(
  source: Iterable<PieceValue>,
  result: PieceTranslation,
  current: Language,
): boolean {
  const original = polishScore(wordsOf(source));
  const translation = polishScore(wordsOf(result.values.values()));
  if (original === translation) return result.detectedLanguage === current;
  return result.detectedLanguage === 'pl' ? original > translation : translation > original;
}

// --- Storing a translation ------------------------------------------------------------------

/**
 * The recipe with its other language rebuilt from `memory`, stamped as current. `gaveUp`: pieces
 * the translator got wrong twice, recorded (with those recorded before whose words are the same)
 * so they aren't asked for again until they change.
 */
export function withTranslation(
  recipe: Recipe,
  memory: TranslationMemory,
  language: Language = sourceLanguageOf(recipe),
  { now = Date.now(), gaveUp = [] as Piece[] } = {},
): Recipe {
  const content = translatableContent(recipe);
  const { content: translated, pieceSources } = buildTranslation(content, (piece) =>
    memory.get(pieceHash(piece)),
  );
  const before =
    language === sourceLanguageOf(recipe)
      ? recipe.translations?.[otherLanguage(language)]?.untranslated
      : undefined;
  const untranslated: Record<string, string> = {};
  for (const piece of recipePieces(content)) {
    const hash = pieceHash(piece);
    if (pieceSources[piece.key] === undefined && before?.[piece.key] === hash) {
      untranslated[piece.key] = hash;
    }
  }
  for (const piece of gaveUp) untranslated[piece.key] = pieceHash(piece);

  const translations = { ...recipe.translations };
  delete translations[language];
  translations[otherLanguage(language)] = {
    ...translated,
    pieceSources,
    sourceHash: sourceHash(recipe),
    unitsTranslated: true,
    translatedAt: now,
    ...(Object.keys(untranslated).length > 0 ? { untranslated } : {}),
  };
  return { ...recipe, sourceLanguage: language, translations };
}

/**
 * Stores finished pieces without touching version, history or edit time: what the recipe already
 * had, plus the new pieces. A translation of text that has changed since (`hashAtRequest` no
 * longer matches) is ignored. A corrected language starts from the new pieces alone.
 */
export function applyTranslation(
  recipe: Recipe,
  result: PieceTranslation,
  hashAtRequest: string,
  now = Date.now(),
): Recipe {
  if (sourceHash(recipe) !== hashAtRequest) return recipe;
  const sameLanguage = result.detectedLanguage === sourceLanguageOf(recipe);
  const memory = new Map(sameLanguage ? translationMemory(recipe) : []);
  for (const [hash, value] of result.values) memory.set(hash, value);
  return withTranslation(recipe, memory, result.detectedLanguage, {
    now,
    gaveUp: result.gaveUp,
  });
}

// --- Editing --------------------------------------------------------------------------------

/**
 * Language the edit form shows: the viewer's own when its translation is current and complete.
 * A translation still missing pieces holds the original's words for them, which a save would
 * store as the viewer's language.
 */
export function editingLanguage(recipe: Recipe, viewerLanguage: Language): Language {
  const shown = displayedLanguage(recipe, viewerLanguage);
  if (shown === sourceLanguageOf(recipe) || translationStatus(recipe, shown) === 'legacy') {
    return shown;
  }
  return translationComplete(recipe) ? shown : sourceLanguageOf(recipe);
}

/** The recipe as the edit form should show it. */
export function recipeForEditing(recipe: Recipe, viewerLanguage: Language): Recipe {
  return localizeRecipe(recipe, editingLanguage(recipe, viewerLanguage));
}

/** Content without undefined values (Firestore rejects them). */
const defined = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The fingerprint, by key, of each piece of `source` that `translated` has at the same place. */
function pairedSources(source: LocalizedRecipeContent, translated: LocalizedRecipeContent) {
  const keys = new Set(recipePieces(translated).map((p) => p.key));
  const sources: Record<string, string> = {};
  for (const piece of recipePieces(source)) {
    if (keys.has(piece.key)) sources[piece.key] = pieceHash(piece);
  }
  return sources;
}

/**
 * The translation carried across an edit in the original's language, rebuilt for the edited
 * text: every piece keeps its words if its own words are unchanged, or changed only in ways that
 * can't alter a translation (spacing, a full stop at the end: see tidyPieceHash). When that covers
 * every piece of a current translation, it stays current, and the edit needs no request at all.
 */
function tidiedAcross(
  original: Recipe,
  edited: Recipe,
  shown: LocalizedRecipeContent,
): LocalizedRecipeContent {
  const memory = translationMemory(original);
  const tidy = new Map<string, PieceValue>();
  for (const piece of recipePieces(translatableContent(original))) {
    const value = memory.get(pieceHash(piece));
    if (value !== undefined) tidy.set(tidyPieceHash(piece), value);
  }
  const lookup = (piece: Piece) => memory.get(pieceHash(piece)) ?? tidy.get(tidyPieceHash(piece));
  const content = translatableContent(edited);
  const { content: translated, pieceSources } = buildTranslation(content, lookup);
  const current =
    translationStatus(original, otherLanguage(sourceLanguageOf(original))) === 'fresh';
  const covered = recipePieces(content).every((piece) => lookup(piece) !== undefined);
  // Only the words the edited text still has: a field the edit cleared mustn't keep its old words.
  return {
    ...translated,
    pieceSources,
    sourceHash: current && covered ? sourceHash(edited) : shown.sourceHash,
    ...(shown.unitsTranslated ? { unitsTranslated: true } : {}),
    ...(shown.translatedAt !== undefined ? { translatedAt: shown.translatedAt } : {}),
  };
}

/**
 * What the edited recipe keeps of its translation, so only the pieces the edit changed are
 * translated again. Stored stale: it's shown only once rebuilt for the new text.
 * - Edited in the original's language: the translation as it was, remembering what it translates.
 * - Edited in the translation's language: that text is the new original, and the old original
 *   becomes the translation, so unchanged pieces keep their exact original words.
 */
function carriedTranslation(
  original: Recipe,
  edited: Recipe,
  editedIn: Language,
): LocalizedRecipeContent | undefined {
  const source = sourceLanguageOf(original);
  const shown = original.translations?.[otherLanguage(source)];
  const current = translationStatus(original, otherLanguage(source)) === 'fresh';

  if (editedIn === source) {
    if (!shown) return undefined;
    if (shown.pieceSources) return tidiedAcross(original, edited, shown);
    // Its pieces can't be matched to the old text: kept, but out of date until translated again.
    if (!current) return { ...shown, sourceHash: sourceHash(original) };
    return { ...shown, pieceSources: pairedSources(translatableContent(original), shown) };
  }
  if (!shown) return undefined;
  const originalText = defined(translatableContent(original));
  return {
    ...originalText,
    pieceSources: pairedSources(shown, originalText),
    sourceHash: sourceHash(original),
    // The author's own words, not a translation: their units are as they wrote them.
    unitsTranslated: true,
  };
}

/**
 * Merges an edit-form save into the stored recipe.
 * - Text unchanged: keep the original wording and structure; take only photos and author.
 * - Text changed: the form's text becomes the original, in the language the form showed. The
 *   translation keeps every piece the edit didn't change (see carriedTranslation).
 * Either way the record's owner and creation date stay as they were.
 */
export function resolveEdit(
  original: Recipe,
  edited: Recipe,
  viewerLanguage: Language,
  textChanged: boolean,
): Recipe {
  if (!textChanged) {
    return {
      ...original,
      author: edited.author,
      authorMode: edited.authorMode,
      // Not text to translate, so a change to these alone still saves.
      category: edited.category,
      manualMinutes: edited.manualMinutes,
      heroImage: edited.heroImage,
      steps: (original.steps || []).map((st, i) => {
        const photo = edited.steps[i];
        const step: Step = {
          ...st,
          hasImage: photo?.hasImage ?? st.hasImage,
          imageSrc: photo ? photo.imageSrc : st.imageSrc,
        };
        // A fork's other paths have photos of their own.
        if (st.fork) {
          step.fork = {
            paths: st.fork.paths.map((path, k) => {
              const other = photo?.fork?.paths[k];
              if (k === 0 || !photo) return path;
              const { hasImage: _h, imageSrc: _s, ...rest } = path;
              return other?.imageSrc ? { ...rest, hasImage: true, imageSrc: other.imageSrc } : rest;
            }),
          };
        }
        return step;
      }),
    };
  }
  const shownLanguage = editingLanguage(original, viewerLanguage);
  const carried = carriedTranslation(original, edited, shownLanguage);
  const translations = { ...original.translations };
  delete translations[shownLanguage];
  delete translations[otherLanguage(shownLanguage)];
  if (carried) translations[otherLanguage(shownLanguage)] = carried;
  return {
    ...edited,
    ownerEmail: original.ownerEmail,
    ownerName: original.ownerName,
    ownerNameAsTyped: original.ownerNameAsTyped,
    createdAt: original.createdAt,
    // Not in the form: a remix stays one through its edits.
    ...(original.remixOf ? { remixOf: original.remixOf } : {}),
    sourceLanguage: shownLanguage,
    translations,
  };
}

// --- Failures -------------------------------------------------------------------------------

/** The model answered, but not usably (bad JSON, wrong shape, blocked, nothing translated). */
export class TranslationRejectedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TranslationRejectedError';
  }
}

/**
 * The family's translation allowance is used up for now: nothing is asked for until
 * `retryAt` (the daily allowance resets at midnight Pacific time; a per-minute one sooner).
 */
export class TranslationQuotaError extends Error {
  constructor(
    message: string,
    readonly retryAt: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'TranslationQuotaError';
  }
}
