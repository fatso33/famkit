import {
  BakingOptions,
  ForkPath,
  Ingredient,
  Language,
  LocalizedRecipeContent,
  Recipe,
  Step,
  StepFork,
} from '../types/recipe';

export const LANGUAGES: readonly Language[] = ['en', 'pl'];

// Recipes saved on another device wait this long before this device translates them,
// so every family phone doesn't translate the same save at once.
export const TRANSLATION_GRACE_MS = 2 * 60 * 1000;

export type TranslationStatus = 'source' | 'fresh' | 'legacy' | 'stale' | 'missing';

export interface ParsedTranslation {
  detectedLanguage: Language;
  content: LocalizedRecipeContent;
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

// FNV-1a (32-bit): a cheap fingerprint to tell whether a translation matches the current text.
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
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

/** Whether the recipe's other language is missing, outdated, or from before fingerprinting. */
export function needsTranslation(recipe: Recipe): boolean {
  const status = translationStatus(recipe, otherLanguage(sourceLanguageOf(recipe)));
  return status !== 'fresh';
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

// Letters only Polish uses: Polish recipe text practically always has some, English none.
const POLISH_LETTERS = /[ąćęłńóśźż]/gi;

const polishLetterCount = (content: LocalizedRecipeContent) =>
  JSON.stringify(content).match(POLISH_LETTERS)?.length ?? 0;

/**
 * Whether a translation's language labels fit the text: the side called Polish must have more
 * Polish letters than the other. The model sometimes names the wrong source language, which
 * would store the English as "Polish" and the Polish as "English". When the letters give no
 * clue, it may only confirm the recipe's current language, never relabel it.
 */
export function translationFitsRecipe(recipe: Recipe, result: ParsedTranslation): boolean {
  const original = polishLetterCount(translatableContent(recipe));
  const translation = polishLetterCount(result.content);
  if (original === translation) return result.detectedLanguage === sourceLanguageOf(recipe);
  return result.detectedLanguage === 'pl' ? original > translation : translation > original;
}

/**
 * Stores a finished translation without touching version, history or edit time. A translation
 * of text that has changed since (`hashAtRequest` no longer matches) is ignored.
 */
export function applyTranslation(
  recipe: Recipe,
  result: ParsedTranslation,
  hashAtRequest: string,
): Recipe {
  if (sourceHash(recipe) !== hashAtRequest) return recipe;
  const target = otherLanguage(result.detectedLanguage);
  const translations = { ...recipe.translations };
  delete translations[result.detectedLanguage];
  translations[target] = { ...result.content, sourceHash: hashAtRequest };
  return { ...recipe, sourceLanguage: result.detectedLanguage, translations };
}

/** Language the edit form shows: the viewer's own when a usable translation exists. */
export function editingLanguage(recipe: Recipe, viewerLanguage: Language): Language {
  return displayedLanguage(recipe, viewerLanguage);
}

/** The recipe as the edit form should show it. */
export function recipeForEditing(recipe: Recipe, viewerLanguage: Language): Recipe {
  return localizeRecipe(recipe, editingLanguage(recipe, viewerLanguage));
}

/**
 * Merges an edit-form save into the stored recipe.
 * - Text unchanged: keep the original wording and structure; take only photos and author.
 * - Text changed: the form's text becomes the original, in the language the form showed.
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
  const translations = { ...original.translations };
  delete translations[shownLanguage];
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

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function pickStrings<K extends string>(src: Json, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function parseStringOrList(v: unknown): string | string[] | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.every((s) => typeof s === 'string')) return v as string[];
  return undefined;
}

function parseBakingOptions(v: unknown): BakingOptions | undefined {
  if (!isObject(v)) return undefined;
  const out: BakingOptions = {};
  const option1 = parseStringOrList(v.option1);
  const option2 = parseStringOrList(v.option2);
  if (option1 !== undefined) out.option1 = option1;
  if (option2 !== undefined) out.option2 = option2;
  return option1 !== undefined || option2 !== undefined ? out : undefined;
}

const INGREDIENT_TEXT_KEYS = [
  'name',
  'prefix',
  'unit',
  'renderUnit',
  'renderUnitPlural',
  'altUnit',
  'suffix',
  'note',
  'substitute',
  'substituteAmount',
] as const;

const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

function parseFork(v: unknown): StepFork | undefined {
  if (!isObject(v) || !Array.isArray(v.paths)) return undefined;
  const paths = v.paths.filter(isObject).map((path) => {
    const out: ForkPath = {
      label: typeof path.label === 'string' ? path.label : '',
      text: typeof path.text === 'string' ? path.text : '',
    };
    if (isStringList(path.steps)) out.steps = path.steps;
    return out;
  });
  return paths.length > 0 ? { paths } : undefined;
}

/** A translated step's text fields (its shape always comes from the original). */
function parseStep(st: Json, i: number): Step[] {
  if (typeof st.text !== 'string') return [];
  const step: Step = {
    num: typeof st.num === 'number' ? st.num : i + 1,
    text: st.text,
    ...pickStrings(st, ['notes', 'imageCaption', 'section'] as const),
  };
  if (isStringList(st.substeps)) step.substeps = st.substeps;
  const fork = parseFork(st.fork);
  if (fork) step.fork = fork;
  return [step];
}

/**
 * Validates a translation response. Keeps only known fields of the right type, and never
 * returns undefined values (Firestore rejects them).
 */
export function parseTranslationResponse(raw: unknown): ParsedTranslation {
  if (!isObject(raw)) throw new Error('Translation response is not an object');
  const detected = raw.detectedLanguage;
  if (detected !== 'en' && detected !== 'pl') {
    throw new Error('Translation response has no valid detectedLanguage');
  }
  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    throw new Error('Translation response has no name');
  }

  const content: LocalizedRecipeContent = pickStrings(raw, [
    'name',
    'cardDescription',
    'yieldHeader',
    'tips',
    'notes',
    'laminationDirective',
  ] as const);

  if (Array.isArray(raw.ingredients)) {
    content.ingredients = raw.ingredients
      .filter(isObject)
      .flatMap((ing): Ingredient[] =>
        typeof ing.text === 'string'
          ? [{ text: ing.text, ...pickStrings(ing, INGREDIENT_TEXT_KEYS) }]
          : [],
      );
  }

  if (Array.isArray(raw.steps)) {
    content.steps = raw.steps.filter(isObject).flatMap(parseStep);
  }

  const bakingOptions = parseBakingOptions(raw.bakingOptions);
  if (bakingOptions) content.bakingOptions = bakingOptions;

  return { detectedLanguage: detected, content };
}
