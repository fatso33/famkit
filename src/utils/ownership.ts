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
  return isOwnRecipe(recipe, user);
}

/** Whether this person added the recipe. */
export function isOwnRecipe(recipe: Recipe, user: CurrentUser | null): boolean {
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

const MAX_MEMBER_NAME = 60;

/**
 * The `name` a family_members entry gives someone, tidied, or null when it has none usable.
 * The entry comes from Firestore, so anything that isn't a sensible short text is ignored.
 */
export function familyMemberName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_MEMBER_NAME).trim();
  return name || null;
}

/** Who a signed-in person is credited as: the family list's name, then Google's, then email. */
export function memberDisplayName(
  listName: string | null,
  googleName: string | null | undefined,
  email: string,
): string {
  return listName || googleName?.trim() || email;
}

/** The author to store for a save from the form. */
export function resolveAuthor(mode: AuthorMode, typedAuthor: string, user: CurrentUser | null) {
  return mode === 'auto' && user ? user.name : typedAuthor.trim();
}
