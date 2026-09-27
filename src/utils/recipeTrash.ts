import { Language, Recipe } from '../types/recipe';
import type { CurrentUser } from '../hooks/useCurrentUser';
import { canEditRecipe } from './ownership';

export const isDeleted = (recipe: Recipe) => recipe.deletedAt !== undefined;

/** The recipe marked deleted at `deletedAt`, or restored when that's undefined. */
export function withDeletedAt(recipe: Recipe, deletedAt: number | undefined): Recipe {
  const { deletedAt: _previous, ...rest } = recipe;
  return deletedAt === undefined ? rest : { ...rest, deletedAt };
}

/** Deleted recipes this person can bring back (only their own), most recently deleted first. */
export function restorableRecipes(
  recipes: Recipe[],
  user: CurrentUser | null,
  accessControlled: boolean,
): Recipe[] {
  return recipes
    .filter((r) => isDeleted(r) && canEditRecipe(r, user, accessControlled))
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600_000],
  ['month', 30 * 24 * 3600_000],
  ['week', 7 * 24 * 3600_000],
  ['day', 24 * 3600_000],
  ['hour', 3600_000],
  ['minute', 60_000],
];

/** "3 days ago", "yesterday" / "3 dni temu", "wczoraj". */
export function timeAgo(timestamp: number, now: number, language: Language): string {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const elapsed = Math.max(0, now - timestamp);
  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms) return format.format(-Math.floor(elapsed / ms), unit);
  }
  return format.format(0, 'minute');
}
