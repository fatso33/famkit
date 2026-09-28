import { AuthorMode, Recipe } from '../types/recipe';
import type { CurrentUser } from '../hooks/useCurrentUser';

const sameEmail = (a?: string, b?: string) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/**
 * Whether this person may edit or delete the recipe: only the family member who added it.
 * Without cloud access control (local dev, Firebase off) everything on the device is editable.
 * This only shapes the UI; firestore.rules is what actually enforces it.
 */
export function canEditRecipe(
  recipe: Recipe,
  user: CurrentUser | null,
  accessControlled: boolean,
): boolean {
  if (!accessControlled) return true;
  return sameEmail(recipe.ownerEmail, user?.email);
}

/** How the edit form should open the author choice for a recipe. */
export function authorModeOf(recipe: Recipe): AuthorMode {
  if (recipe.authorMode) return recipe.authorMode;
  // Older records only have the typed author: treat it as someone else's name.
  return 'custom';
}

/** The owner's name to show as "added by", when the recipe is credited to someone else. */
export function addedByName(recipe: Recipe): string | null {
  if (authorModeOf(recipe) !== 'custom' || !recipe.ownerName) return null;
  return recipe.ownerName.trim() === recipe.author.trim() ? null : recipe.ownerName;
}

/**
 * A name as the author choice shows it: first name and last initial ("Peter G."). A single
 * name, or an email standing in for one, stays as it is.
 */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return name.trim();
  return `${words[0]} ${words.at(-1)!.charAt(0).toUpperCase()}.`;
}

/** The author to store for a save from the form. */
export function resolveAuthor(mode: AuthorMode, typedAuthor: string, user: CurrentUser | null) {
  return mode === 'auto' && user ? user.name : typedAuthor.trim();
}

/** A recipe credited to someone outside the app, e.g. passed down from a grandparent. */
export function isHeirloom(recipe: Recipe): boolean {
  return addedByName(recipe) !== null;
}
