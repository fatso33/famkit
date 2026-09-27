export interface Ingredient {
  text: string;
  name?: string;
  qty?: number | null;
  unit?: string;
  altQty?: number | null;
  altUnit?: string;
  prefix?: string;
  suffix?: string;
  renderUnit?: string;
  renderUnitPlural?: string;
}

export interface Step {
  num: number;
  text: string;
  hasImage?: boolean;
  imageSrc?: string;
  imageCaption?: string;
  notes?: string;
}

export interface RecipeHistoryEntry {
  version: number;
  savedAt: number;
  recipe: Omit<Recipe, 'history'>;
  changeNote?: string;
}

export interface BakingOptions {
  option1?: string | string[];
  option2?: string | string[];
}

export interface LocalizedRecipeContent {
  name?: string;
  cardDescription?: string;
  yieldHeader?: string;
  tips?: string;
  notes?: string;
  laminationDirective?: string;
  ingredients?: Ingredient[];
  steps?: Step[];
  bakingOptions?: BakingOptions;
  /** Fingerprint of the source text this was translated from (see utils/recipeTranslation). */
  sourceHash?: string;
}

export interface RecipeTranslations {
  en?: LocalizedRecipeContent;
  pl?: LocalizedRecipeContent;
  [lang: string]: LocalizedRecipeContent | undefined;
}

export interface Recipe {
  id: string;
  name: string;
  /** The name shown as the recipe's author (see `authorMode`). */
  author: string;
  /**
   * 'auto': the author is the family member who added it. 'custom': it's someone else's recipe
   * (e.g. a grandma who doesn't use the app), typed in. Missing on older records.
   */
  authorMode?: AuthorMode;
  /** Google email of the family member who added the recipe. Only they may edit it. */
  ownerEmail?: string;
  /** Their Google name when they added it, shown as "added by" on someone else's recipe. */
  ownerName?: string;
  category: 'breads' | 'heirloom' | 'family' | string;
  version?: number;
  history?: RecipeHistoryEntry[];
  heroImage: string;
  yieldHeader: string;
  baseYield?: number;
  ingredients: Ingredient[];
  cardDescription?: string;
  tips?: string;
  steps: Step[];
  laminationDirective?: string;
  bakingOptions?: BakingOptions;
  notes?: string;
  /** Language of the top-level text fields. Missing on older records, which are English. */
  sourceLanguage?: Language;
  translations?: RecipeTranslations;
  createdAt?: number;
  updatedAt?: number;
}

export type AuthorMode = 'auto' | 'custom';
export type Language = 'en' | 'pl';
export type Theme = 'light' | 'dark';
export type FilterType = 'all' | 'breads' | 'heirloom' | 'recent';

export interface ParsedIngredientRow {
  name: string;
  notes: string[];
  amount: string;
  originalText: string;
}
