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
}

export interface RecipeTranslations {
  pl?: LocalizedRecipeContent;
  [lang: string]: LocalizedRecipeContent | undefined;
}

export interface Recipe {
  id: string;
  name: string;
  author: string;
  category: 'breads' | 'heirloom' | 'family' | string;
  version?: number;
  history?: RecipeHistoryEntry[];
  isDefault?: boolean;
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
  translations?: RecipeTranslations;
  createdAt?: number;
  updatedAt?: number;
}

export type Language = 'en' | 'pl';
export type Theme = 'light' | 'dark';
export type FilterType = 'all' | 'breads' | 'heirloom' | 'recent';

export interface ParsedIngredientRow {
  name: string;
  notes: string[];
  amount: string;
  originalText: string;
}
