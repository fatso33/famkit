import { Recipe, RecipeVersion, Language, Theme, VaultSort, VaultView } from '../types/recipe';
import { familyMemberName } from '../utils/ownership';
import { isSeasonPreference, SeasonPreference } from '../utils/season';
import { DEFAULT_SORT, formatVaultSort, parseVaultSort } from '../utils/vault';

const RECIPES_KEY = 'wandas_recipes';
const THEME_KEY = 'wandas_theme';
const LANG_KEY = 'wandas_language';
const FONT_SCALE_KEY = 'wandas_font_scale';
const SEASON_KEY = 'wandas_season';
const LEGACY_API_KEY_STORAGE = 'wandas_gemini_api_key';
const INSTALL_DISMISSED_KEY = 'family_kitchen_install_dismissed';
// How this person likes the vault laid out and ordered, kept per device.
const VAULT_VIEW_KEY = 'family_kitchen_vault_view';
const VAULT_SORT_KEY = 'family_kitchen_vault_sort';
// Earlier recipe versions, only when there is no cloud (local dev). With Firebase they live in
// Firestore, whose offline cache already covers them.
const LOCAL_VERSIONS_KEY = 'family_kitchen_versions';

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

function readLocalVersions(): Record<string, RecipeVersion[]> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_VERSIONS_KEY) || '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, RecipeVersion[]>)
      : {};
  } catch {
    return {};
  }
}

/** Keeps earlier versions on this device (no-cloud mode). Existing versions are never replaced. */
export function saveLocalVersions(recipeId: string, versions: RecipeVersion[]): void {
  if (typeof window === 'undefined' || versions.length === 0) return;
  const all = readLocalVersions();
  const kept = all[recipeId] ?? [];
  const known = new Set(kept.map((v) => v.id));
  all[recipeId] = [...kept, ...versions.filter((v) => !known.has(v.id))];
  try {
    localStorage.setItem(LOCAL_VERSIONS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Could not keep an earlier recipe version on this device (storage full?):', e);
  }
}

/** An earlier version kept on this device, as stored (validate before use). */
export function getLocalVersion(recipeId: string, versionId: string): unknown {
  if (typeof window === 'undefined') return null;
  return readLocalVersions()[recipeId]?.find((v) => v.id === versionId) ?? null;
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

export function getStoredSeasonPreference(): SeasonPreference {
  if (typeof window === 'undefined') return 'auto';
  const value = localStorage.getItem(SEASON_KEY);
  return isSeasonPreference(value) ? value : 'auto';
}

export function setStoredSeasonPreference(preference: SeasonPreference): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SEASON_KEY, preference);
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

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Could not remember the vault setting ${key} on this device:`, e);
  }
}

// The last person this device confirmed is on the family list, so a returning member gets in
// straight away (and offline) while the list is checked again in the background.
const CONFIRMED_MEMBER_KEY = 'family_kitchen_confirmed_member';

export interface ConfirmedMember {
  /** Lowercase. */
  email: string;
  /** The name the family list gives them, if any. */
  name: string | null;
}

export function getConfirmedMember(): ConfirmedMember | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed: unknown = JSON.parse(readSetting(CONFIRMED_MEMBER_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { email, name } = parsed as Record<string, unknown>;
    if (typeof email !== 'string' || !email) return null;
    return { email, name: familyMemberName(name) };
  } catch {
    return null;
  }
}

export function setConfirmedMember(member: ConfirmedMember | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (member) localStorage.setItem(CONFIRMED_MEMBER_KEY, JSON.stringify(member));
    else localStorage.removeItem(CONFIRMED_MEMBER_KEY);
  } catch (e) {
    console.warn('Could not remember family membership on this device:', e);
  }
}

export function getStoredVaultView(): VaultView {
  if (typeof window === 'undefined') return 'cards';
  return readSetting(VAULT_VIEW_KEY) === 'list' ? 'list' : 'cards';
}

export function setStoredVaultView(view: VaultView): void {
  if (typeof window === 'undefined') return;
  writeSetting(VAULT_VIEW_KEY, view);
}

export function getStoredVaultSort(): VaultSort {
  if (typeof window === 'undefined') return DEFAULT_SORT;
  return parseVaultSort(readSetting(VAULT_SORT_KEY)) ?? DEFAULT_SORT;
}

export function setStoredVaultSort(sort: VaultSort): void {
  if (typeof window === 'undefined') return;
  writeSetting(VAULT_SORT_KEY, formatVaultSort(sort));
}

// The fork path each recipe was last cooked on, per device: recipe id → fork step → path.
const FORK_PATHS_KEY = 'family_kitchen_fork_paths';

function readForkPaths(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FORK_PATHS_KEY) || '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The paths last chosen on a recipe's forks, by the fork step's position. */
export function getStoredPathChoices(recipeId: string): Record<number, number> {
  if (typeof window === 'undefined') return {};
  const own = readForkPaths()[recipeId];
  if (typeof own !== 'object' || own === null) return {};
  const choices: Record<number, number> = {};
  for (const [step, path] of Object.entries(own)) {
    if (/^\d+$/.test(step) && Number.isInteger(path) && (path as number) >= 0) {
      choices[Number(step)] = path as number;
    }
  }
  return choices;
}

export function setStoredPathChoices(recipeId: string, choices: Record<number, number>): void {
  if (typeof window === 'undefined') return;
  const all = readForkPaths();
  all[recipeId] = choices;
  try {
    localStorage.setItem(FORK_PATHS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Could not remember the chosen fork path (storage full?):', e);
  }
}
