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

/**
 * The owner's name to show as "added by", when the recipe is credited to someone else. It's a
 * family member's name, so it's shown like theirs are everywhere (memberName).
 */
export function addedByName(recipe: Recipe): string | null {
  if (authorModeOf(recipe) !== 'custom' || !recipe.ownerName) return null;
  const owner = memberName(recipe.ownerName, recipe.ownerNameAsTyped);
  const author = recipe.author.trim();
  return author === recipe.ownerName.trim() || author === owner ? null : owner;
}

/**
 * The author as a recipe shows them. A family member credited as themselves is shown as
 * memberName has it; a name typed for someone else shows as it was typed. The full name stays
 * stored, so this is only how it's shown.
 */
export function creditName(
  recipe: Pick<Recipe, 'author' | 'authorMode' | 'ownerNameAsTyped'>,
): string {
  const author = (recipe.author ?? '').trim();
  return recipe.authorMode === 'auto' ? memberName(author, recipe.ownerNameAsTyped) : author;
}

/**
 * A family member's name as the app shows it. A Google name is shortened to save room
 * ("Peter G."); a name the family list gives them is shown as written ("Ciocia Zosia").
 */
export function memberName(name: string, asTyped?: boolean): string {
  return asTyped ? name.trim() : shortName(name);
}

/**
 * The owner's name fields a save by `user` writes. A new recipe, or one of their own, takes
 * their name as it's credited now (the family list may have named them since); anyone else's
 * keeps its owner's.
 */
export function ownerCredit(
  existing: Pick<Recipe, 'ownerEmail' | 'ownerName' | 'ownerNameAsTyped'> | null | undefined,
  user: CurrentUser | null,
): Pick<Recipe, 'ownerName' | 'ownerNameAsTyped'> {
  if (existing && !sameEmail(existing.ownerEmail, user?.email)) {
    return { ownerName: existing.ownerName, ownerNameAsTyped: existing.ownerNameAsTyped };
  }
  return { ownerName: user?.name, ownerNameAsTyped: user?.nameAsTyped || undefined };
}

/** A name shortened to first name and last initial. A single name, or an email, stays as is. */
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
