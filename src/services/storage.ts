import { Recipe, RecipeVersion, Language, Theme, VaultSort, VaultView } from '../types/recipe';
import { Make } from '../types/make';
import { MAKES_DEVICE_BUDGET, makesDeviceJson, parseMake } from '../utils/makes';
import { DEVICE_COPY_BUDGET, deviceCopyJson } from '../utils/deviceCopy';
import { familyMemberName } from '../utils/ownership';
import { localizeRecipe } from '../utils/recipeTranslation';
import { isDeleted } from '../utils/recipeTrash';
import { isSeasonPreference, SeasonPreference } from '../utils/season';
import { DEFAULT_SORT, formatVaultSort, parseVaultSort, sortEntries } from '../utils/vault';

const RECIPES_KEY = 'wandas_recipes';
// The Makes page's makes, which the app starts from before the cloud answers.
const MAKES_KEY = 'family_kitchen_makes';
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
// Translations the model got wrong on this device, so they wait before being asked for again.
const TRANSLATION_FAILURES_KEY = 'family_kitchen_translation_failures';

/** A translation request that came back unusable: how many times, and when last. */
export interface TranslationFailure {
  count: number;
  at: number;
}

export function getTranslationFailures(): Record<string, TranslationFailure> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TRANSLATION_FAILURES_KEY) || '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const failures: Record<string, TranslationFailure> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const f = value as Partial<TranslationFailure> | null;
      if (typeof f?.count === 'number' && typeof f.at === 'number') {
        failures[key] = { count: f.count, at: f.at };
      }
    }
    return failures;
  } catch {
    return {};
  }
}

/** Records a failure of this request (by its key), dropping records older than a week. */
export function recordTranslationFailure(key: string, now: number): void {
  const week = 7 * 24 * 60 * 60 * 1000;
  const kept = Object.fromEntries(
    Object.entries(getTranslationFailures()).filter(([, f]) => now - f.at < week),
  );
  kept[key] = { count: (kept[key]?.count ?? 0) + 1, at: now };
  try {
    localStorage.setItem(TRANSLATION_FAILURES_KEY, JSON.stringify(kept));
  } catch (e) {
    console.warn('Could not note a failed recipe translation on this device (storage full?):', e);
  }
}

// Until when Gemini said the family's translation allowance is used up (see TranslationQuotaError).
const TRANSLATION_PAUSE_KEY = 'family_kitchen_translation_paused_until';

/** When this device may ask for translations again; 0 when it may now. */
export function getTranslationPause(): number {
  try {
    const until = Number(localStorage.getItem(TRANSLATION_PAUSE_KEY));
    return Number.isFinite(until) ? until : 0;
  } catch {
    return 0;
  }
}

export function setTranslationPause(until: number): void {
  try {
    localStorage.setItem(TRANSLATION_PAUSE_KEY, String(until));
  } catch (e) {
    console.warn('Could not note the translation pause on this device (storage full?):', e);
  }
}

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

/** Ids of the vault's recipes in the order this device shows them, top first. */
function shownOrder(recipes: Recipe[]): string[] {
  const lang = getStoredLanguage();
  const entries = recipes
    .filter((recipe) => !isDeleted(recipe))
    .map((recipe) => ({ recipe, shown: localizeRecipe(recipe, lang) }));
  return sortEntries(entries, getStoredVaultSort(), lang).map((e) => e.recipe.id);
}

/**
 * Keeps this device's copy of the vault, which the app starts from before the cloud answers.
 * `photosInCloud`: the cloud keeps every photo, so photos that don't fit may be left out of this
 * copy (marked, see utils/deviceCopy), the ones the vault shows first kept. Without it this copy
 * is the only one, and is kept whole or not at all.
 */
export function saveRecipes(recipes: Recipe[], { photosInCloud = false } = {}): void {
  if (typeof window === 'undefined') return;
  if (!photosInCloud) {
    try {
      localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
    } catch (e) {
      console.warn('Could not keep the vault on this device (storage full?):', e);
    }
    return;
  }

  const attempts = [
    () => deviceCopyJson(recipes, shownOrder(recipes), DEVICE_COPY_BUDGET),
    // Something else took the room: just the words.
    () => deviceCopyJson(recipes, [], 0),
  ];
  for (const json of attempts) {
    try {
      localStorage.setItem(RECIPES_KEY, json());
      return;
    } catch (e) {
      console.warn('Could not keep the vault on this device, trying it smaller:', e);
    }
  }
  // An out-of-date copy would hide the newest recipes, and could be edited over newer ones.
  try {
    localStorage.removeItem(RECIPES_KEY);
  } catch {
    // Storage unavailable: nothing kept to go stale.
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
  if (typeof window === 'undefined') return 'list';
  return readSetting(VAULT_VIEW_KEY) === 'cards' ? 'cards' : 'list';
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

// The recipes each person has opened on this device, for the vault's Unseen filter:
// lowercase email ('' signed out) → recipe ids.
const SEEN_RECIPES_KEY = 'family_kitchen_seen_recipes';

function readSeenRecipes(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_RECIPES_KEY) || '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function getSeenRecipes(email: string): string[] {
  if (typeof window === 'undefined') return [];
  const ids = readSeenRecipes()[email.toLowerCase()];
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

export function setSeenRecipes(email: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const all = readSeenRecipes();
    all[email.toLowerCase()] = ids;
    localStorage.setItem(SEEN_RECIPES_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Could not remember which recipes were opened on this device:', e);
  }
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

/** This device's copy of the makes; any entry that isn't a usable make is dropped. */
export function getStoredMakes(): Make[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MAKES_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseMake).filter((m): m is Make => m !== null);
  } catch (e) {
    console.warn('Failed to read the makes kept on this device, starting without them:', e);
    return [];
  }
}

/**
 * Keeps this device's copy of the makes. With the cloud keeping every photo (`photosInCloud`),
 * only the newest makes keep theirs here (utils/makes makesDeviceJson); without it, this copy
 * is the only one, kept whole.
 */
export function saveMakes(makes: Make[], { photosInCloud = false } = {}): void {
  if (typeof window === 'undefined') return;
  const attempts = [
    () => makesDeviceJson(makes, MAKES_DEVICE_BUDGET, photosInCloud),
    // Something else took the room: just the words (only when the cloud has the photos).
    ...(photosInCloud ? [() => makesDeviceJson(makes, 0, true)] : []),
  ];
  for (const json of attempts) {
    try {
      localStorage.setItem(MAKES_KEY, json());
      return;
    } catch (e) {
      console.warn('Could not keep the makes on this device, trying it smaller:', e);
    }
  }
}
