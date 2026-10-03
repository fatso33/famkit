import { Recipe, RecipeVersion, Language, Theme, VaultSort, VaultView } from '../types/recipe';
import { Make, MakesSort } from '../types/make';
import {
  DEFAULT_MAKES_SORT,
  formatMakesSort,
  leaveMakePhotoOut,
  parseMakesSort,
  parseMake,
} from '../utils/makes';
import {
  leavePhotosOut,
  makePhotoKey,
  makePhotoSet,
  recipePhotoKey,
  recipePhotoSet,
  withMakePhoto,
  withRecipePhotos,
} from '../utils/deviceCopy';
import { devicePhotos, keepDevicePhotos, loadDevicePhotos, loadPhotosFirst } from './photoStore';
import { photoIdOf } from '../utils/photoRefs';
import { recipePhoto } from '../utils/vault';
import { latestMakes, latestRecipes } from '../utils/counter';
import { familyMemberName } from '../utils/ownership';
import { isSeasonPreference, SeasonPreference } from '../utils/season';
import { DEFAULT_SORT, formatVaultSort, parseVaultSort } from '../utils/vault';

const RECIPES_KEY = 'wandas_recipes';
// The Makes page's makes, which the app starts from before the cloud answers.
const MAKES_KEY = 'family_kitchen_makes';
const THEME_KEY = 'wandas_theme';
const LANG_KEY = 'wandas_language';
const FONT_SCALE_KEY = 'wandas_font_scale';
const SEASON_KEY = 'wandas_season';
const LEGACY_API_KEY_STORAGE = 'wandas_gemini_api_key';
const INSTALL_DISMISSED_KEY = 'family_kitchen_install_dismissed';
// How this person likes the vault (and Makes) laid out and ordered, kept per device.
const VAULT_VIEW_KEY = 'family_kitchen_vault_view';
const VAULT_SORT_KEY = 'family_kitchen_vault_sort';
const MAKES_SORT_KEY = 'family_kitchen_makes_sort';
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

// How many times in a row Gemini was overloaded on this device, and when last (busyPauseMs).
const TRANSLATION_BUSY_KEY = 'family_kitchen_translation_busy';

/**
 * Notes that Gemini was overloaded, and returns how many times in a row it has been. A run more
 * than a day old starts again.
 */
export function noteTranslationBusy(now: number): number {
  const day = 24 * 60 * 60 * 1000;
  let times = 1;
  try {
    const last = JSON.parse(localStorage.getItem(TRANSLATION_BUSY_KEY) || 'null') as {
      count?: unknown;
      at?: unknown;
    } | null;
    if (typeof last?.count === 'number' && typeof last.at === 'number' && now - last.at < day) {
      times = last.count + 1;
    }
  } catch {
    // Unreadable: start a new run.
  }
  try {
    localStorage.setItem(TRANSLATION_BUSY_KEY, JSON.stringify({ count: times, at: now }));
  } catch (e) {
    console.warn('Could not note that Gemini was overloaded on this device (storage full?):', e);
  }
  return times;
}

/** Gemini answered: the next overload starts the pauses from the shortest again. */
export function clearTranslationBusy(): void {
  try {
    localStorage.removeItem(TRANSLATION_BUSY_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * This device's copy of the vault. Every recipe was added by a family member; none is built in.
 * With the cloud, the copy holds the words and the photos are kept apart (services/photoStore):
 * each recipe is made whole again from them once they're read, and waits for the cloud if not.
 */
export function getStoredRecipes(): Recipe[] {
  if (typeof window === 'undefined') return [];

  const raw = localStorage.getItem(RECIPES_KEY);
  if (!raw) return [];

  try {
    const recipes: unknown = JSON.parse(raw);
    return Array.isArray(recipes) ? withDeviceRecipePhotos(recipes as Recipe[]) : [];
  } catch (e) {
    console.warn('Failed to parse stored recipes, starting with an empty vault:', e);
    return [];
  }
}

/** The recipes with the photos kept on this device filled in (the same list if none were). */
export function withDeviceRecipePhotos(recipes: Recipe[]): Recipe[] {
  const filled = recipes.map((r) => withRecipePhotos(r, devicePhotos(recipePhotoKey(r.id))));
  return filled.some((r, i) => r !== recipes[i]) ? filled : recipes;
}

/** The makes with the photos kept on this device filled in (the same list if none were). */
export function withDeviceMakePhotos(makes: Make[]): Make[] {
  const filled = makes.map((m) => withMakePhoto(m, devicePhotos(makePhotoKey(m.id))));
  return filled.some((m, i) => m !== makes[i]) ? filled : makes;
}

/**
 * Reads the photos kept on this device before the app first draws, so it starts with them
 * rather than filling them in a moment later. Only those My Counter shows (the latest recipes
 * and makes) are waited for, read ahead of the rest, which follow straight after for the pages
 * behind it. Waits at most `maxWait` ms, and only when a copy here is waiting for photos. (The
 * photos kept on their own are read beside this, from recipeHeroIds.)
 */
export function loadDevicePhotosForLaunch(maxWait: number): Promise<void> {
  const raw = (key: string) => {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  };
  const recipesRaw = raw(RECIPES_KEY);
  const makesRaw = raw(MAKES_KEY);
  const waiting = recipesRaw.includes('"photosOmitted"') || makesRaw.includes('"photoOmitted"');
  if (!waiting) {
    void loadDevicePhotos();
    return Promise.resolve();
  }
  const read = loadPhotosFirst(counterPhotoKeys(recipesRaw, makesRaw));
  return Promise.race([read, new Promise<void>((resolve) => setTimeout(resolve, maxWait))]);
}

/**
 * The ids of the recipes' own photos kept on their own, from this device's copy: those My
 * Counter shows (`first`), then the rest, newest first.
 */
export function recipeHeroIds(): { first: string[]; rest: string[] } {
  let parsed: unknown;
  try {
    const recipesRaw = localStorage.getItem(RECIPES_KEY) ?? '';
    if (!recipesRaw.includes('"photo:')) return { first: [], rest: [] };
    parsed = JSON.parse(recipesRaw);
  } catch {
    return { first: [], rest: [] };
  }
  const recipes = (Array.isArray(parsed) ? parsed : []).filter(
    (r): r is Recipe => typeof (r as Recipe | null)?.id === 'string',
  );
  const heroOf = (r: Recipe) => photoIdOf(recipePhoto(r));
  const first = latestRecipes(recipes).map(heroOf);
  const shown = new Set(first);
  const rest = recipes.map(heroOf).filter((id) => !shown.has(id));
  const ids = (list: (string | null)[]) => [...new Set(list.filter((id) => id !== null))];
  return { first: ids(first), rest: ids(rest) };
}

/** The photo store's keys for what My Counter shows first, from this device's copy. */
export function counterPhotoKeys(recipesRaw: string, makesRaw: string): string[] {
  const parse = (text: string): unknown[] => {
    try {
      const parsed: unknown = JSON.parse(text || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const recipes = parse(recipesRaw).filter(
    (r): r is Recipe => typeof (r as Recipe | null)?.id === 'string',
  );
  const makes = parse(makesRaw)
    .map(parseMake)
    .filter((m): m is Make => m !== null);
  return [
    ...latestRecipes(recipes).map((r) => recipePhotoKey(r.id)),
    ...latestMakes(makes).map((m) => makePhotoKey(m.id)),
  ];
}

/**
 * Keeps this device's copy of the vault, which the app starts from before the cloud answers.
 * `photosInCloud`: the cloud keeps every photo, so this copy keeps the words, small and quick
 * to write, and the photos go to the photo store. Without it this copy is the only one, and is
 * kept whole or not at all.
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

  keepDevicePhotos(recipePhotoSet(recipes));
  try {
    localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes.map(leavePhotosOut)));
  } catch (e) {
    console.warn('Could not keep the vault on this device:', e);
    // An out-of-date copy would hide the newest recipes, and could be edited over newer ones.
    try {
      localStorage.removeItem(RECIPES_KEY);
    } catch {
      // Storage unavailable: nothing kept to go stale.
    }
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

export function getStoredMakesSort(): MakesSort {
  if (typeof window === 'undefined') return DEFAULT_MAKES_SORT;
  return parseMakesSort(readSetting(MAKES_SORT_KEY)) ?? DEFAULT_MAKES_SORT;
}

export function setStoredMakesSort(sort: MakesSort): void {
  if (typeof window === 'undefined') return;
  writeSetting(MAKES_SORT_KEY, formatMakesSort(sort));
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

// What My Counter remembers for each person on this device (lowercase email → CounterMemory):
// the greeting it showed last, when they last came, and the hearts on their makes already shown.
const COUNTER_KEY = 'family_kitchen_counter';

export interface CounterMemory {
  lastGreeting?: string;
  lastVisit?: number;
  /** Each of their makes' hearts as last shown to them: make id → hearts' keys. */
  heartsShown: Record<string, string[]>;
}

function readCounterMemories(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COUNTER_KEY) || '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function getCounterMemory(email: string): CounterMemory {
  if (typeof window === 'undefined') return { heartsShown: {} };
  const raw = readCounterMemories()[email.toLowerCase()];
  const memory: CounterMemory = { heartsShown: {} };
  if (typeof raw !== 'object' || raw === null) return memory;
  const { lastGreeting, lastVisit, heartsShown } = raw as Record<string, unknown>;
  if (typeof lastGreeting === 'string') memory.lastGreeting = lastGreeting;
  if (typeof lastVisit === 'number' && Number.isFinite(lastVisit)) memory.lastVisit = lastVisit;
  if (typeof heartsShown === 'object' && heartsShown !== null && !Array.isArray(heartsShown)) {
    for (const [id, keys] of Object.entries(heartsShown)) {
      if (Array.isArray(keys)) {
        memory.heartsShown[id] = keys.filter((k): k is string => typeof k === 'string');
      }
    }
  }
  return memory;
}

export function setCounterMemory(email: string, memory: CounterMemory): void {
  if (typeof window === 'undefined') return;
  try {
    const all = readCounterMemories();
    all[email.toLowerCase()] = memory;
    localStorage.setItem(COUNTER_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Could not remember the counter greeting and hearts on this device:', e);
  }
}

// Unsaved edits kept on this phone as they're typed, so closing the app by accident loses
// nothing: by what's open (an edit, a draft, a remix), the newest first, a few at most.
const KEPT_EDITS_KEY = 'family_kitchen_kept_edits';
const MAX_KEPT_EDITS = 3;

/** An unsaved edit kept on this phone, and what it was made from (see keepEdit). */
export interface KeptEdit {
  /**
   * What it edits, as it was when the copy was made (see the editor's keptStamp): a copy of an
   * edit to a recipe that has changed since is out of date.
   */
  base: string;
  /** The content as written so far, shaped as a stored draft (read back with parseDraft). */
  draft: unknown;
}

function readKeptEdits(): [string, KeptEdit][] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEPT_EDITS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is [string, KeptEdit] =>
        Array.isArray(entry) &&
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'object' &&
        entry[1] !== null &&
        typeof (entry[1] as KeptEdit).base === 'string',
    );
  } catch {
    return [];
  }
}

/** The unsaved edit kept for what's open (e.g. "edit:<recipe id>"), if there is one. */
export function getKeptEdit(scope: string): KeptEdit | null {
  if (typeof window === 'undefined') return null;
  return readKeptEdits().find(([key]) => key === scope)?.[1] ?? null;
}

/** Keeps an unsaved edit, dropping the oldest kept ones when the phone's storage is full. */
export function keepEdit(scope: string, edit: KeptEdit): void {
  if (typeof window === 'undefined') return;
  let entries: [string, KeptEdit][] = [
    [scope, edit] as [string, KeptEdit],
    ...readKeptEdits().filter(([key]) => key !== scope),
  ].slice(0, MAX_KEPT_EDITS);
  while (entries.length > 0) {
    try {
      localStorage.setItem(KEPT_EDITS_KEY, JSON.stringify(entries));
      return;
    } catch (e) {
      if (entries.length === 1) console.warn('Could not keep the unsaved edit (storage full?):', e);
      entries = entries.slice(0, -1);
    }
  }
  // Not even this one fits: an older copy of it mustn't come back in its place.
  forgetKeptEdit(scope);
}

/** Lets go of the edit kept for what's open: it was saved, or discarded. */
export function forgetKeptEdit(scope: string): void {
  if (typeof window === 'undefined') return;
  const entries = readKeptEdits();
  const rest = entries.filter(([key]) => key !== scope);
  if (rest.length === entries.length) return;
  try {
    if (rest.length > 0) localStorage.setItem(KEPT_EDITS_KEY, JSON.stringify(rest));
    else localStorage.removeItem(KEPT_EDITS_KEY);
  } catch (e) {
    console.warn('Could not let go of the kept edit:', e);
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
    return withDeviceMakePhotos(parsed.map(parseMake).filter((m): m is Make => m !== null));
  } catch (e) {
    console.warn('Failed to read the makes kept on this device, starting without them:', e);
    return [];
  }
}

/**
 * Keeps this device's copy of the makes. With the cloud keeping every photo (`photosInCloud`),
 * this copy keeps the words and the photos go to the photo store; without it, this copy is the
 * only one, kept whole.
 */
export function saveMakes(makes: Make[], { photosInCloud = false } = {}): void {
  if (typeof window === 'undefined') return;
  if (photosInCloud) keepDevicePhotos(makePhotoSet(makes));
  try {
    localStorage.setItem(
      MAKES_KEY,
      JSON.stringify(photosInCloud ? makes.map(leaveMakePhotoOut) : makes),
    );
  } catch (e) {
    console.warn('Could not keep the makes on this device:', e);
  }
}
