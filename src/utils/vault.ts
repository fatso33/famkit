import { Language, Recipe, RecipeCategory, VaultFilter, VaultSort } from '../types/recipe';
import { isHeirloom } from './ownership';
import { estimateRecipeMinutes } from './timeEstimator';

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

/** Every way to sort the vault, in the order the sort menu lists them. The first is the default. */
export const VAULT_SORTS: readonly VaultSort[] = [
  'newest',
  'az',
  'quickest',
  'updated',
  'cook',
  'category',
];

export const NO_FILTER: VaultFilter = { category: 'all', heirloomsOnly: false, query: '' };

export function isRecipeCategory(value: unknown): value is RecipeCategory {
  return (RECIPE_CATEGORIES as readonly unknown[]).includes(value);
}

export function isVaultSort(value: unknown): value is VaultSort {
  return (VAULT_SORTS as readonly unknown[]).includes(value);
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

/** The recipes in the chosen order. Ties keep their order, then go alphabetically. */
export function sortEntries(entries: VaultEntry[], sort: VaultSort, lang: Language): VaultEntry[] {
  const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  const byName = (a: VaultEntry, b: VaultEntry) => collator.compare(a.shown.name, b.shown.name);
  const minutes = new Map<VaultEntry, number>();
  if (sort === 'quickest') {
    for (const entry of entries) minutes.set(entry, estimateRecipeMinutes(entry.shown));
  }
  const compare: Record<VaultSort, (a: VaultEntry, b: VaultEntry) => number> = {
    newest: (a, b) => (b.recipe.createdAt ?? 0) - (a.recipe.createdAt ?? 0),
    az: byName,
    quickest: (a, b) => minutes.get(a)! - minutes.get(b)! || byName(a, b),
    updated: (a, b) => changedAt(b.recipe) - changedAt(a.recipe),
    cook: (a, b) => collator.compare(cookOf(a.shown), cookOf(b.shown)) || byName(a, b),
    category: (a, b) =>
      RECIPE_CATEGORIES.indexOf(categoryOf(a.recipe)) -
        RECIPE_CATEGORIES.indexOf(categoryOf(b.recipe)) || byName(a, b),
  };
  return [...entries].sort(compare[sort]);
}

/** A run of recipes under one heading: a cook's name, or a category. */
export interface VaultGroup {
  /** The cook's name or the category; '' when the sort has no headings. */
  key: string;
  entries: VaultEntry[];
}

/** Sorted recipes split under headings, for the sorts that have them (by cook, by category). */
export function groupEntries(sorted: VaultEntry[], sort: VaultSort): VaultGroup[] {
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

/** Shown for a recipe saved without a photo (the recipe page shows the same one). */
export const FALLBACK_RECIPE_PHOTO =
  'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=1200&q=80';
