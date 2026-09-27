import {
  BakingOptions,
  Ingredient,
  Language,
  LocalizedRecipeContent,
  Recipe,
  Step,
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
    })),
    steps: (recipe.steps || []).map((st) => ({
      num: st.num,
      text: st.text,
      notes: st.notes,
      imageCaption: st.imageCaption,
    })),
    bakingOptions: recipe.bakingOptions,
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
 * Lays translated text over the recipe. Quantities, step numbers and photos always come from
 * the original, so a translation can't change amounts or drop step photos.
 */
export function overlayTranslation(recipe: Recipe, tr: LocalizedRecipeContent): Recipe {
  const ingredients: Ingredient[] = (recipe.ingredients || []).map((src, i) => {
    const t = tr.ingredients?.[i];
    return t ? { ...t, qty: src.qty, altQty: src.altQty } : src;
  });
  const steps: Step[] = (recipe.steps || []).map((src, i) => {
    const t = tr.steps?.[i];
    return t ? { ...t, num: src.num, hasImage: src.hasImage, imageSrc: src.imageSrc } : src;
  });
  return {
    ...recipe,
    name: tr.name || recipe.name,
    cardDescription: tr.cardDescription || recipe.cardDescription,
    yieldHeader: tr.yieldHeader || recipe.yieldHeader,
    tips: tr.tips !== undefined ? tr.tips : recipe.tips,
    notes: tr.notes !== undefined ? tr.notes : recipe.notes,
    laminationDirective:
      tr.laminationDirective !== undefined ? tr.laminationDirective : recipe.laminationDirective,
    ingredients: tr.ingredients && tr.ingredients.length > 0 ? ingredients : recipe.ingredients,
    steps: tr.steps && tr.steps.length > 0 ? steps : recipe.steps,
    bakingOptions: tr.bakingOptions || recipe.bakingOptions,
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

/** Stores a finished translation without touching version, history or edit time. */
export function applyTranslation(
  recipe: Recipe,
  result: ParsedTranslation,
  hashAtRequest: string,
): Recipe {
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
] as const;

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
    content.steps = raw.steps.filter(isObject).flatMap((st, i): Step[] =>
      typeof st.text === 'string'
        ? [
            {
              num: typeof st.num === 'number' ? st.num : i + 1,
              text: st.text,
              ...pickStrings(st, ['notes', 'imageCaption'] as const),
            },
          ]
        : [],
    );
  }

  const bakingOptions = parseBakingOptions(raw.bakingOptions);
  if (bakingOptions) content.bakingOptions = bakingOptions;

  return { detectedLanguage: detected, content };
}
