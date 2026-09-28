import {
  Language,
  Recipe,
  RecipeCategory,
  VaultFilter,
  VaultSort,
  VaultSortKey,
} from '../types/recipe';
import { isHeirloom } from './ownership';
import { recipeTime } from './timeEstimator';

/** Every category, in the order the filter lists them. */
export const RECIPE_CATEGORIES: readonly RecipeCategory[] = [
  'breakfast',
  'soups',
  'mains',
  'sides',
  'breads',
  'cakes',
  'preserves',
  'drinks',
  'other',
];

/** Everything the vault can sort by, in the order the sort menu lists them. */
export const VAULT_SORT_KEYS: readonly VaultSortKey[] = [
  'added',
  'time',
  'name',
  'changed',
  'cook',
  'category',
];

/** Newest first. */
export const DEFAULT_SORT: VaultSort = { by: 'added', reversed: false };

export const NO_FILTER: VaultFilter = { category: 'all', heirloomsOnly: false, query: '' };

export function isRecipeCategory(value: unknown): value is RecipeCategory {
  return (RECIPE_CATEGORIES as readonly unknown[]).includes(value);
}

export function isVaultSortKey(value: unknown): value is VaultSortKey {
  return (VAULT_SORT_KEYS as readonly unknown[]).includes(value);
}

export function isDefaultSort(sort: VaultSort): boolean {
  return sort.by === DEFAULT_SORT.by && sort.reversed === DEFAULT_SORT.reversed;
}

// The sorts the first version of the vault stored, each one direction of a key now.
const LEGACY_SORTS: Record<string, VaultSortKey> = {
  newest: 'added',
  az: 'name',
  quickest: 'time',
  updated: 'changed',
};

/** A sort as it's kept on the device: its key, then ":reversed" when turned round. */
export function formatVaultSort(sort: VaultSort): string {
  return sort.reversed ? `${sort.by}:reversed` : sort.by;
}

/** A kept sort (including the first version's), or null when it isn't one. */
export function parseVaultSort(value: string | null): VaultSort | null {
  if (!value) return null;
  const [key, direction] = value.split(':');
  const by = LEGACY_SORTS[key] ?? key;
  if (!isVaultSortKey(by) || (direction !== undefined && direction !== 'reversed')) return null;
  return { by, reversed: direction === 'reversed' };
}

/** A recipe's category. Older records ('family', 'heirloom' or none) count as 'other'. */
export function categoryOf(recipe: Pick<Recipe, 'category'>): RecipeCategory {
  return isRecipeCategory(recipe.category) ? recipe.category : 'other';
}

/** One recipe in the vault: as stored, and as shown in the viewer's language. */
export interface VaultEntry {
  recipe: Recipe;
  shown: Recipe;
}

/**
 * Text folded for searching: lower case, accents dropped (ż → z, ł → l). One character out for
 * each character in, so a match's position in the folded text is its position in the original.
 */
export function foldText(text: string): string {
  let folded = '';
  for (let i = 0; i < text.length; i++) {
    const lower = text[i].toLowerCase();
    folded += lower === 'ł' ? 'l' : (lower.normalize('NFD')[0] ?? text[i]);
  }
  return folded;
}

/** Where the search text first appears in `text`, ignoring case and accents. */
export function findMatch(text: string, query: string): { start: number; end: number } | null {
  const needle = foldText(query.trim());
  if (!needle) return null;
  const start = foldText(text).indexOf(needle);
  return start < 0 ? null : { start, end: start + needle.length };
}

function matchesQuery({ shown }: VaultEntry, query: string): boolean {
  const texts = [shown.name, shown.author, ...(shown.ingredients ?? []).map((i) => i.text)];
  return texts.some((text) => text && findMatch(text, query));
}

/** Whether a recipe passes the heirloom switch and the search (everything but the category). */
function passesRest(entry: VaultEntry, filter: VaultFilter): boolean {
  if (filter.heirloomsOnly && !isHeirloom(entry.recipe)) return false;
  return !filter.query.trim() || matchesQuery(entry, filter.query);
}

/** The recipes the filter lets through. */
export function filterEntries(entries: VaultEntry[], filter: VaultFilter): VaultEntry[] {
  return entries.filter(
    (entry) =>
      (filter.category === 'all' || categoryOf(entry.recipe) === filter.category) &&
      passesRest(entry, filter),
  );
}

/** How many recipes each category would show, given the rest of the filter. */
export function categoryCounts(
  entries: VaultEntry[],
  filter: VaultFilter,
): Record<RecipeCategory | 'all', number> {
  const counts = { all: 0 } as Record<RecipeCategory | 'all', number>;
  for (const category of RECIPE_CATEGORIES) counts[category] = 0;
  for (const entry of entries) {
    if (!passesRest(entry, filter)) continue;
    counts.all++;
    counts[categoryOf(entry.recipe)]++;
  }
  return counts;
}

const changedAt = (r: Recipe) => r.updatedAt ?? r.createdAt ?? 0;

/** The cook's name, trimmed. Cloud records aren't checked, so one may have none. */
const cookOf = (r: Recipe) => (r.author ?? '').trim();

/**
 * The recipes in the chosen order, turned round if asked. Ties go alphabetically either way,
 * and Other stays last among the categories whichever way they run.
 */
export function sortEntries(entries: VaultEntry[], sort: VaultSort, lang: Language): VaultEntry[] {
  const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  const byName = (a: VaultEntry, b: VaultEntry) => collator.compare(a.shown.name, b.shown.name);
  const minutes = new Map<VaultEntry, number>();
  if (sort.by === 'time') {
    for (const entry of entries) minutes.set(entry, recipeTime(entry.shown).minutes);
  }
  const rank = (entry: VaultEntry) => RECIPE_CATEGORIES.indexOf(categoryOf(entry.recipe));
  const isOther = (entry: VaultEntry) => (categoryOf(entry.recipe) === 'other' ? 1 : 0);
  // Each key in its natural order.
  const natural: Record<VaultSortKey, (a: VaultEntry, b: VaultEntry) => number> = {
    added: (a, b) => (b.recipe.createdAt ?? 0) - (a.recipe.createdAt ?? 0),
    time: (a, b) => minutes.get(a)! - minutes.get(b)!,
    name: byName,
    changed: (a, b) => changedAt(b.recipe) - changedAt(a.recipe),
    cook: (a, b) => collator.compare(cookOf(a.shown), cookOf(b.shown)),
    category: (a, b) => rank(a) - rank(b),
  };
  const direction = sort.reversed ? -1 : 1;
  const pinned = (a: VaultEntry, b: VaultEntry) =>
    sort.by === 'category' ? isOther(a) - isOther(b) : 0;
  return [...entries].sort(
    (a, b) => pinned(a, b) || direction * natural[sort.by](a, b) || byName(a, b),
  );
}

/** A run of recipes under one heading: a cook's name, or a category. */
export interface VaultGroup {
  /** The cook's name or the category; '' when the sort has no headings. */
  key: string;
  entries: VaultEntry[];
}

/** Sorted recipes split under headings, for the sorts that have them (by cook, by category). */
export function groupEntries(sorted: VaultEntry[], sort: VaultSortKey): VaultGroup[] {
  const keyOf = (entry: VaultEntry) =>
    sort === 'cook' ? cookOf(entry.shown) : sort === 'category' ? categoryOf(entry.recipe) : '';
  const groups: VaultGroup[] = [];
  for (const entry of sorted) {
    const key = keyOf(entry);
    const last = groups[groups.length - 1];
    if (last && foldText(last.key) === foldText(key)) {
      last.entries.push(entry);
      // The same cook typed two ways heads the group with the capitalised spelling.
      if (startsLower(last.key) && !startsLower(key)) last.key = key;
    } else {
      groups.push({ key, entries: [entry] });
    }
  }
  return groups;
}

const startsLower = (text: string) => text.charAt(0) !== text.charAt(0).toUpperCase();

/** How many recipes the vault holds, and from how many different cooks. */
export function vaultCounts(recipes: Recipe[]): { recipes: number; cooks: number } {
  const cooks = new Set(recipes.map((r) => foldText(cookOf(r))).filter(Boolean));
  return { recipes: recipes.length, cooks: cooks.size };
}

// Stock photos that older versions saved, or showed, for a recipe without one of its own.
const STOCK_PHOTOS = [
  'https://images.unsplash.com/photo-1549931319-a545dcf3bc73',
  'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04',
];

/**
 * The recipe's own photo, or '' when it has none: a recipe without one shows its category's
 * tile (CategoryTile), including the older ones saved with a stock photo in its place.
 */
export function recipePhoto(recipe: Pick<Recipe, 'heroImage'>): string {
  // Cloud records aren't checked on the way in, so anything but text counts as no photo.
  const photo = typeof recipe.heroImage === 'string' ? recipe.heroImage : '';
  return STOCK_PHOTOS.some((stock) => photo.startsWith(stock)) ? '' : photo;
}
