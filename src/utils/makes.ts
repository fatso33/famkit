import { Language, RecipeCategory } from '../types/recipe';
import { Make, MakeTranslation, MakesFilter, MakesSort, MakesSortKey } from '../types/make';
import type { CurrentUser } from '../hooks/useCurrentUser';
import { memberName } from './ownership';
import { RECIPE_CATEGORIES, findMatch } from './vault';

/**
 * Makes: what family members made from the Recipe Box's recipes, each with a photo, shared on
 * the Makes page. A make points at its recipe by id; the recipe is never written to, so a
 * recipe's makes are counted from the makes themselves (like remixes).
 */

/** Document id for a new make: when it was made, readable in the console, plus a random part. */
export function newMakeId(): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `make-${Date.now()}-${random}`;
}

export const isMakeDeleted = (make: Pick<Make, 'deletedAt'>) => make.deletedAt !== undefined;

/** The make marked deleted at `deletedAt`, or restored when that's undefined. */
export function makeWithDeletedAt(make: Make, deletedAt: number | undefined): Make {
  const { deletedAt: _previous, ...rest } = make;
  return deletedAt === undefined ? rest : { ...rest, deletedAt };
}

/** The makes the Makes page shows: not deleted, the newest first. */
export function shownMakes(makes: readonly Make[]): Make[] {
  return makes.filter((m) => !isMakeDeleted(m)).sort((a, b) => b.createdAt - a.createdAt);
}

/** A recipe's makes, the newest first. */
export function makesOf(makes: readonly Make[], recipeId: string): Make[] {
  return shownMakes(makes).filter((m) => m.recipeId === recipeId);
}

/** How many makes each recipe has, by id (recipes without any are left out). */
export function makeCounts(makes: readonly Make[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const make of makes) {
    if (isMakeDeleted(make)) continue;
    counts.set(make.recipeId, (counts.get(make.recipeId) ?? 0) + 1);
  }
  return counts;
}

const sameEmail = (a?: string, b?: string) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** Whether this person added the make. */
export function isOwnMake(make: Pick<Make, 'ownerEmail'>, user: CurrentUser | null): boolean {
  return sameEmail(make.ownerEmail, user?.email);
}

/**
 * Whether this person may edit or delete the make: only its maker. Without cloud access control
 * (local dev) everything on the device is. firestore.rules is what actually enforces it.
 */
export function canEditMake(
  make: Pick<Make, 'ownerEmail'>,
  user: CurrentUser | null,
  accessControlled: boolean,
): boolean {
  return !accessControlled || isOwnMake(make, user);
}

/** The maker's name, as the family's names are shown everywhere (memberName). */
export function makerName(make: Pick<Make, 'ownerName' | 'ownerNameAsTyped'>): string {
  return make.ownerName ? memberName(make.ownerName, make.ownerNameAsTyped) : '';
}

/** A make as a list shows it: its title (or its recipe's name) in the viewer's language. */
export interface MakeEntry {
  make: Make;
  title: string;
  recipeName: string;
}

/**
 * The makes whose title, recipe or maker has the search text in it, ignoring case and accents
 * (as the Recipe Box's search does). Every one of them while there's no search.
 */
export function searchMakes<T extends MakeEntry>(entries: readonly T[], query: string): T[] {
  if (!query.trim()) return [...entries];
  return entries.filter(({ make, title, recipeName }) =>
    [title, recipeName, makerName(make)].some((text) => text && findMatch(text, query)),
  );
}

// --- The Makes page's filter and sort -------------------------------------------------------

export const MAKES_SORT_KEYS: readonly MakesSortKey[] = ['newest', 'hearts', 'recipe', 'maker'];

export const DEFAULT_MAKES_SORT: MakesSort = { by: 'newest', reversed: false };

export const NO_MAKES_FILTER: MakesFilter = {
  maker: '',
  category: 'all',
  recipeId: '',
  hearted: false,
};

/** Whether the sort is the page's own (the newest shared first), so its key shows no dot. */
export const isDefaultMakesSort = (sort: MakesSort) =>
  sort.by === DEFAULT_MAKES_SORT.by && sort.reversed === DEFAULT_MAKES_SORT.reversed;

/** Whether anything narrows the makes shown. */
export const isMakesFiltered = (filter: MakesFilter) =>
  filter.maker !== '' || filter.category !== 'all' || filter.recipeId !== '' || filter.hearted;

const isMakesSortKey = (key: string): key is MakesSortKey =>
  (MAKES_SORT_KEYS as readonly string[]).includes(key);

/** A sort as this device keeps it: its key, with ":reversed" when turned round. */
export function formatMakesSort(sort: MakesSort): string {
  return sort.reversed ? `${sort.by}:reversed` : sort.by;
}

/** A kept sort, or null when it isn't one. */
export function parseMakesSort(value: string | null): MakesSort | null {
  if (!value) return null;
  const [by, direction] = value.split(':');
  if (!isMakesSortKey(by) || (direction !== undefined && direction !== 'reversed')) return null;
  return { by, reversed: direction === 'reversed' };
}

/** A make on the Makes page, with the category of its recipe (null once the recipe has gone). */
export interface MakesEntry extends MakeEntry {
  category: RecipeCategory | null;
}

/** Who made it, as the filter tells makers apart: their email, or their name without one. */
export function makerKey(make: Pick<Make, 'ownerEmail' | 'ownerName' | 'ownerNameAsTyped'>) {
  return make.ownerEmail?.trim().toLowerCase() || makerName(make).toLowerCase();
}

type MakesFilterPart = 'maker' | 'category' | 'recipe' | 'hearted';

/** Whether a make passes the filter, leaving out one part of it (for that part's counts). */
function passes(
  entry: MakesEntry,
  filter: MakesFilter,
  hearted: (make: Make) => boolean,
  skip?: MakesFilterPart,
) {
  const { make } = entry;
  if (skip !== 'maker' && filter.maker && makerKey(make) !== filter.maker) return false;
  if (skip !== 'category' && filter.category !== 'all' && entry.category !== filter.category) {
    return false;
  }
  if (skip !== 'recipe' && filter.recipeId && make.recipeId !== filter.recipeId) return false;
  if (skip !== 'hearted' && filter.hearted && !hearted(make)) return false;
  return true;
}

/** The makes the filter leaves; `hearted` says which this person has hearted. */
export function filterMakes<T extends MakesEntry>(
  entries: readonly T[],
  filter: MakesFilter,
  hearted: (make: Make) => boolean,
): T[] {
  return entries.filter((entry) => passes(entry, filter, hearted));
}

export interface MakesFilterCounts {
  categories: Record<RecipeCategory | 'all', number>;
  /** Everyone who has made something, A to Z, including those the rest leaves at 0. */
  makers: { key: string; name: string; count: number }[];
  allMakers: number;
  /** Every recipe something was made from (and still in the box), A to Z. */
  recipes: { id: string; name: string; count: number }[];
  allRecipes: number;
  /** The makes this person has hearted, with the rest of the filter. */
  hearted: number;
}

/** What each choice in the filter menu would show, with the rest of the filter as it is. */
export function makesFilterCounts(
  entries: readonly MakesEntry[],
  filter: MakesFilter,
  hearted: (make: Make) => boolean,
  lang: Language,
): MakesFilterCounts {
  const categories = { all: 0 } as Record<RecipeCategory | 'all', number>;
  for (const category of RECIPE_CATEGORIES) categories[category] = 0;
  const makers = new Map<string, { key: string; name: string; count: number }>();
  const recipes = new Map<string, { id: string; name: string; count: number }>();
  let allMakers = 0;
  let allRecipes = 0;
  let heartedCount = 0;
  for (const entry of entries) {
    const { make } = entry;
    if (passes(entry, filter, hearted, 'category')) {
      categories.all++;
      if (entry.category) categories[entry.category]++;
    }
    const key = makerKey(make);
    let maker = makers.get(key);
    if (!maker && key) makers.set(key, (maker = { key, name: makerName(make) || key, count: 0 }));
    if (passes(entry, filter, hearted, 'maker')) {
      allMakers++;
      if (maker) maker.count++;
    }
    let recipe = recipes.get(make.recipeId);
    if (!recipe && entry.recipeName && entry.category) {
      recipe = { id: make.recipeId, name: entry.recipeName, count: 0 };
      recipes.set(make.recipeId, recipe);
    }
    if (passes(entry, filter, hearted, 'recipe')) {
      allRecipes++;
      if (recipe) recipe.count++;
    }
    if (hearted(make) && passes(entry, filter, hearted, 'hearted')) heartedCount++;
  }
  const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  const byName = (a: { name: string }, b: { name: string }) => collator.compare(a.name, b.name);
  return {
    categories,
    makers: [...makers.values()].sort(byName),
    allMakers,
    recipes: [...recipes.values()].sort(byName),
    allRecipes,
    hearted: heartedCount,
  };
}

/**
 * The makes in the chosen order, turned round if asked. Ties go the newest shared first either
 * way. By recipe or maker, makes with none to go by (a recipe that has gone) come last.
 */
export function sortMakes<T extends MakesEntry>(
  entries: readonly T[],
  sort: MakesSort,
  lang: Language,
): T[] {
  const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  const newest = (a: T, b: T) => b.make.createdAt - a.make.createdAt;
  const text: Partial<Record<MakesSortKey, (entry: T) => string>> = {
    recipe: (entry) => entry.recipeName,
    maker: (entry) => makerName(entry.make),
  };
  const natural: Record<MakesSortKey, (a: T, b: T) => number> = {
    newest,
    hearts: (a, b) => heartCount(b.make) - heartCount(a.make),
    recipe: (a, b) => collator.compare(a.recipeName, b.recipeName),
    maker: (a, b) => collator.compare(makerName(a.make), makerName(b.make)),
  };
  const textOf = text[sort.by];
  const compare = natural[sort.by];
  return [...entries].sort((a, b) => {
    if (textOf && !textOf(a) !== !textOf(b)) return textOf(a) ? -1 : 1;
    const order = sort.reversed ? compare(b, a) : compare(a, b);
    return order || (sort.by === 'newest' ? 0 : newest(a, b));
  });
}

// --- Hearts --------------------------------------------------------------------------------

/** The key a person's heart is stored under: their email, in lowercase (as the rules check). */
export const heartKey = (email: string) => email.trim().toLowerCase();

export function heartCount(make: Pick<Make, 'hearts'>): number {
  return Object.values(make.hearts ?? {}).filter((v) => v === true).length;
}

export function hasHearted(make: Pick<Make, 'hearts'>, email: string | undefined): boolean {
  return Boolean(email && make.hearts?.[heartKey(email)] === true);
}

/** The make with this person's heart given (`on`) or taken back. */
export function withHeart(make: Make, email: string, on: boolean): Make {
  const hearts = { ...make.hearts };
  if (on) hearts[heartKey(email)] = true;
  else delete hearts[heartKey(email)];
  const { hearts: _old, ...rest } = make;
  return Object.keys(hearts).length > 0 ? { ...rest, hearts } : rest;
}

// --- The day it was made --------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** A day on this phone's calendar as YYYY-MM-DD. */
export function isoDay(at: number | Date = Date.now()): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A YYYY-MM-DD day as a local date, or null when it isn't one. */
export function parseIsoDay(day: string | undefined): Date | null {
  const m = day ? ISO_DAY.exec(day) : null;
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isoDay(date) === day ? date : null;
}

/**
 * The day a make was made, as its card shows it: "Today", "Yesterday", or the date ("30 Sept",
 * "30 wrz"), with the year when it isn't this one. Falls back to when it was added.
 */
export function madeOnLabel(
  make: Pick<Make, 'madeOn' | 'createdAt'>,
  language: Language,
  words: { today: string; yesterday: string },
  now = Date.now(),
): string {
  const date = parseIsoDay(make.madeOn) ?? new Date(make.createdAt);
  const day = isoDay(date);
  if (day === isoDay(now)) return words.today;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === isoDay(yesterday)) return words.yesterday;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

// --- Reading makes from the cloud (untrusted) -----------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

// The longest words a make keeps: anything longer was never typed in the form.
const MAX_TITLE = 200;
const MAX_NOTE = 4000;

function parseTranslation(raw: unknown): MakeTranslation | undefined {
  if (!isObject(raw)) return undefined;
  const strings = (v: unknown) =>
    isObject(v)
      ? Object.fromEntries(
          Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'),
        )
      : undefined;
  const tr: MakeTranslation = {};
  const title = text(raw.title)?.slice(0, MAX_TITLE);
  const note = text(raw.note)?.slice(0, MAX_NOTE);
  if (title !== undefined) tr.title = title;
  if (note !== undefined) tr.note = note;
  if (text(raw.sourceHash) !== undefined) tr.sourceHash = text(raw.sourceHash);
  const pieceSources = strings(raw.pieceSources);
  if (pieceSources) tr.pieceSources = pieceSources;
  if (num(raw.translatedAt) !== undefined) tr.translatedAt = num(raw.translatedAt);
  const untranslated = strings(raw.untranslated);
  if (untranslated) tr.untranslated = untranslated;
  return tr;
}

/**
 * A make as stored, if it has what the page needs (an id, its recipe, a photo or a device copy
 * waiting for one); otherwise null. Only the fields a make has are kept, each checked.
 */
export function parseMake(raw: unknown): Make | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id);
  const recipeId = text(raw.recipeId);
  const photo = text(raw.photo) ?? '';
  const photoOmitted = raw.photoOmitted === true;
  if (!id || !recipeId || (!photo && !photoOmitted)) return null;
  const createdAt = num(raw.createdAt) ?? 0;
  const make: Make = {
    id,
    recipeId,
    photo,
    createdAt,
    updatedAt: num(raw.updatedAt) ?? createdAt,
  };
  const title = text(raw.title)?.slice(0, MAX_TITLE);
  const note = text(raw.note)?.slice(0, MAX_NOTE);
  if (title) make.title = title;
  if (note) make.note = note;
  if (parseIsoDay(text(raw.madeOn))) make.madeOn = text(raw.madeOn);
  if (text(raw.ownerEmail)) make.ownerEmail = text(raw.ownerEmail);
  if (text(raw.ownerName)) make.ownerName = text(raw.ownerName);
  if (raw.ownerNameAsTyped === true) make.ownerNameAsTyped = true;
  if (isObject(raw.hearts)) {
    const hearts = Object.fromEntries(
      Object.entries(raw.hearts)
        .filter(([, v]) => v === true)
        .map(([k]) => [k, true as const]),
    );
    if (Object.keys(hearts).length > 0) make.hearts = hearts;
  }
  if (raw.sourceLanguage === 'en' || raw.sourceLanguage === 'pl') {
    make.sourceLanguage = raw.sourceLanguage;
  }
  if (isObject(raw.translations)) {
    const en = parseTranslation(raw.translations.en);
    const pl = parseTranslation(raw.translations.pl);
    if (en || pl) make.translations = { ...(en && { en }), ...(pl && { pl }) };
  }
  if (num(raw.deletedAt) !== undefined) make.deletedAt = num(raw.deletedAt);
  if (photoOmitted) make.photoOmitted = true;
  return make;
}

// --- This device's copy ---------------------------------------------------------------------

/** The make without its photo, marked so it's never saved from (see `photoOmitted`). */
export function leaveMakePhotoOut(make: Make): Make {
  return make.photo ? { ...make, photo: '', photoOmitted: true } : make;
}
