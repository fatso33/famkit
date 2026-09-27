import { Recipe, Language, Theme } from '../types/recipe';

const RECIPES_KEY = 'wandas_recipes';
const THEME_KEY = 'wandas_theme';
const LANG_KEY = 'wandas_language';
const FONT_SCALE_KEY = 'wandas_font_scale';
const LEGACY_API_KEY_STORAGE = 'wandas_gemini_api_key';
const INSTALL_DISMISSED_KEY = 'family_kitchen_install_dismissed';

/** This device's copy of the vault. Every recipe was added by a family member; none is built in. */
export function getStoredRecipes(): Recipe[] {
  if (typeof window === 'undefined') return [];

  const raw = localStorage.getItem(RECIPES_KEY);
  if (!raw) return [];

  try {
    const recipes: unknown = JSON.parse(raw);
    return Array.isArray(recipes) ? (recipes as Recipe[]) : [];
  } catch (e) {
    console.warn('Failed to parse stored recipes, starting with an empty vault:', e);
    return [];
  }
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
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
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

/** Removes a Gemini key pasted into the old Settings field; translation no longer needs one. */
export function clearLegacyApiKey(): void {
  try {
    localStorage.removeItem(LEGACY_API_KEY_STORAGE);
  } catch {
    // Storage unavailable (private mode): nothing to clear.
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
