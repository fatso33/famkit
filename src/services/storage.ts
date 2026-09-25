import { Recipe, Language, Theme } from '../types/recipe';
import { DEFAULT_RECIPE } from '../data/defaultRecipe';

const RECIPES_KEY = 'wandas_recipes';
const THEME_KEY = 'wandas_theme';
const LANG_KEY = 'wandas_language';
const FONT_SCALE_KEY = 'wandas_font_scale';
const API_KEY_STORAGE = 'wandas_gemini_api_key';
const INSTALL_DISMISSED_KEY = 'family_kitchen_install_dismissed';

export function getStoredRecipes(): Recipe[] {
  if (typeof window === 'undefined') return [DEFAULT_RECIPE];

  const raw = localStorage.getItem(RECIPES_KEY);
  let recipes: Recipe[] = [];

  if (!raw) {
    recipes = [DEFAULT_RECIPE];
    saveRecipes(recipes);
    return recipes;
  }

  try {
    recipes = JSON.parse(raw);
    if (!Array.isArray(recipes) || recipes.length === 0) {
      recipes = [DEFAULT_RECIPE];
    }
  } catch (e) {
    console.warn('Failed to parse stored recipes, resetting to default:', e);
    recipes = [DEFAULT_RECIPE];
  }

  // Synchronize default recipe properties (ensures latest verbatim instructions/translations)
  const defaultIdx = recipes.findIndex(
    (r) => r.id === 'wandas-cheese-bread' || r.isDefault
  );

  if (defaultIdx !== -1) {
    recipes[defaultIdx] = {
      ...DEFAULT_RECIPE,
      ...recipes[defaultIdx],
      // Always ensure canonical heirloom content takes precedence
      ingredients: DEFAULT_RECIPE.ingredients,
      steps: DEFAULT_RECIPE.steps,
      laminationDirective: DEFAULT_RECIPE.laminationDirective,
      bakingOptions: DEFAULT_RECIPE.bakingOptions,
      tips: DEFAULT_RECIPE.tips,
      notes: DEFAULT_RECIPE.notes,
      translations: DEFAULT_RECIPE.translations,
      heroImage: DEFAULT_RECIPE.heroImage,
    };
  } else {
    recipes.unshift(DEFAULT_RECIPE);
  }

  saveRecipes(recipes);
  return recipes;
}

export function saveRecipes(recipes: Recipe[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
  } catch (e) {
    console.error('Failed to save recipes to localStorage:', e);
  }
}

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const lang = localStorage.getItem(LANG_KEY);
  return lang === 'pl' ? 'pl' : 'en';
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANG_KEY, lang);
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const theme = localStorage.getItem(THEME_KEY);
  if (theme === 'dark' || theme === 'light') return theme;
  return window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
}

export function getStoredFontScale(): number {
  if (typeof window === 'undefined') return 1;
  const val = parseFloat(localStorage.getItem(FONT_SCALE_KEY) || '1');
  return isNaN(val) ? 1 : Math.min(1.4, Math.max(0.85, val));
}

export function setStoredFontScale(scale: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FONT_SCALE_KEY, scale.toFixed(2));
}

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem(API_KEY_STORAGE) ||
    (import.meta.env.VITE_GEMINI_API_KEY as string) ||
    ''
  );
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key.trim()) {
    localStorage.removeItem(API_KEY_STORAGE);
  } else {
    localStorage.setItem(API_KEY_STORAGE, key.trim());
  }
}

export function isInstallBannerDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  return Boolean(localStorage.getItem(INSTALL_DISMISSED_KEY));
}

export function dismissInstallBanner(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
}
