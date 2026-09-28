import {
  Ingredient,
  Language,
  LocalizedRecipeContent,
  Recipe,
  Step,
  StepFork,
} from '../types/recipe';
import {
  INGREDIENT_WORD_KEYS,
  IngredientWords,
  Piece,
  PieceValue,
  buildTranslation,
  fnv1a,
  pieceHash,
  pieceValue,
  recipePieces,
} from './translationPieces';

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

/** The recipe's pieces that have no translation yet, each once (same words, one piece). */
export function pendingPieces(recipe: Recipe): Piece[] {
  const memory = translationMemory(recipe);
  const seen = new Set<string>();
  return recipePieces(translatableContent(recipe)).filter((piece) => {
    const hash = pieceHash(piece);
    if (memory.has(hash) || seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
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

export function shouldTranslateNow(recipe: Recipe, now: number, savedOnThisDevice: boolean) {
  if (savedOnThisDevice) return true;
  const changedAt = recipe.updatedAt ?? recipe.createdAt ?? 0;
  return now - changedAt >= TRANSLATION_GRACE_MS;
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

/** The recipe as a viewer in `lang` should see it. */
export function localizeRecipe(recipe: Recipe, lang: Language): Recipe {
  const status = translationStatus(recipe, lang);
  const tr = recipe.translations?.[lang];
  return tr && (status === 'fresh' || status === 'legacy')
    ? overlayTranslation(recipe, tr)
    : recipe;
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
  const original = polishScore(wordsOf(recipePieces(translatableContent(recipe)).map(pieceValue)));
  const translation = polishScore(wordsOf(result.values.values()));
  if (original === translation) return result.detectedLanguage === sourceLanguageOf(recipe);
  return result.detectedLanguage === 'pl' ? original > translation : translation > original;
}

// --- Storing a translation ------------------------------------------------------------------

/** The recipe with its other language rebuilt from `memory`, stamped as current. */
export function withTranslation(
  recipe: Recipe,
  memory: TranslationMemory,
  language: Language = sourceLanguageOf(recipe),
): Recipe {
  const { content, pieceSources } = buildTranslation(translatableContent(recipe), (piece) =>
    memory.get(pieceHash(piece)),
  );
  const translations = { ...recipe.translations };
  delete translations[language];
  translations[otherLanguage(language)] = {
    ...content,
    pieceSources,
    sourceHash: sourceHash(recipe),
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
): Recipe {
  if (sourceHash(recipe) !== hashAtRequest) return recipe;
  const sameLanguage = result.detectedLanguage === sourceLanguageOf(recipe);
  const memory = new Map(sameLanguage ? translationMemory(recipe) : []);
  for (const [hash, value] of result.values) memory.set(hash, value);
  return withTranslation(recipe, memory, result.detectedLanguage);
}

// --- Editing --------------------------------------------------------------------------------

/** Language the edit form shows: the viewer's own when a usable translation exists. */
export function editingLanguage(recipe: Recipe, viewerLanguage: Language): Language {
  return displayedLanguage(recipe, viewerLanguage);
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
 * What the edited recipe keeps of its translation, so only the pieces the edit changed are
 * translated again. Stored stale: it's shown only once rebuilt for the new text.
 * - Edited in the original's language: the translation as it was, remembering what it translates.
 * - Edited in the translation's language: that text is the new original, and the old original
 *   becomes the translation, so unchanged pieces keep their exact original words.
 */
function carriedTranslation(
  original: Recipe,
  editedIn: Language,
): LocalizedRecipeContent | undefined {
  const source = sourceLanguageOf(original);
  const shown = original.translations?.[otherLanguage(source)];
  const current = translationStatus(original, otherLanguage(source)) === 'fresh';

  if (editedIn === source) {
    if (!shown) return undefined;
    if (shown.pieceSources) return shown;
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
      steps: (original.steps || []).map((st, i) => ({
        ...st,
        hasImage: edited.steps[i]?.hasImage ?? st.hasImage,
        imageSrc: edited.steps[i] ? edited.steps[i].imageSrc : st.imageSrc,
      })),
    };
  }
  const shownLanguage = editingLanguage(original, viewerLanguage);
  const carried = carriedTranslation(original, shownLanguage);
  const translations = { ...original.translations };
  delete translations[shownLanguage];
  delete translations[otherLanguage(shownLanguage)];
  if (carried) translations[otherLanguage(shownLanguage)] = carried;
  return {
    ...edited,
    ownerEmail: original.ownerEmail,
    ownerName: original.ownerName,
    createdAt: original.createdAt,
    sourceLanguage: shownLanguage,
    translations,
  };
}

// --- Validation of the untrusted model response -------------------------------------------

/** The model answered, but not usably (bad JSON, wrong shape, nothing translated). */
export class TranslationRejectedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TranslationRejectedError';
  }
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Pieces sent to the translator, by the id it was given. */
export type PieceRequest = Map<string, Piece>;

function parseIngredient(raw: Json): IngredientWords | undefined {
  if (typeof raw.text !== 'string' || !raw.text.trim()) return undefined;
  const words: IngredientWords = { text: raw.text };
  for (const key of INGREDIENT_WORD_KEYS) {
    const value = raw[key];
    if (typeof value === 'string') words[key] = value;
  }
  return words;
}

/**
 * Validates a translation response against what was asked. Keeps only the pieces that were
 * asked for, with words of the right kind; anything else is dropped, and a missing piece is
 * simply asked for again later. `language`: the recipe's language when it's settled (the
 * model's guess is then ignored).
 */
export function parsePieceResponse(
  raw: unknown,
  requested: PieceRequest,
  language?: Language,
): PieceTranslation {
  if (!isObject(raw)) throw new TranslationRejectedError('Translation response is not an object');
  const detected = language ?? raw.detectedLanguage;
  if (detected !== 'en' && detected !== 'pl') {
    throw new TranslationRejectedError('Translation response has no valid detectedLanguage');
  }

  const values: TranslationMemory = new Map();
  const entries = (list: unknown) => (Array.isArray(list) ? list.filter(isObject) : []);
  for (const entry of entries(raw.texts)) {
    const piece = typeof entry.id === 'string' ? requested.get(entry.id) : undefined;
    if (
      piece &&
      piece.kind !== 'ingredient' &&
      typeof entry.text === 'string' &&
      entry.text.trim()
    ) {
      values.set(pieceHash(piece), entry.text);
    }
  }
  for (const entry of entries(raw.ingredients)) {
    const piece = typeof entry.id === 'string' ? requested.get(entry.id) : undefined;
    const words = piece?.kind === 'ingredient' ? parseIngredient(entry) : undefined;
    if (!piece || !words) continue;
    // Polish unit forms by amount; English reads renderUnit as its plural (utils/fractions).
    if (detected === 'pl') {
      delete words.renderUnit;
      delete words.renderUnitPlural;
    }
    values.set(pieceHash(piece), words);
  }
  if (values.size === 0)
    throw new TranslationRejectedError('Translation response translated nothing');
  return { detectedLanguage: detected, values };
}
