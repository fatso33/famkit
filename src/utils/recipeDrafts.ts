import { Ingredient, Recipe, RecipeDraft, Step } from '../types/recipe';

/**
 * Drafts: recipes and edits a family member is still writing, kept for them alone (see
 * RecipeDraft). There's one draft per recipe, so an edit's draft has an id made from the recipe's.
 */

/** The id of the draft editing this recipe. */
export const editDraftId = (recipeId: string) => `edit-${recipeId}`;

/** An id for a new recipe's draft. */
export const newDraftId = (now = Date.now()) =>
  `draft-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** The version a draft becomes in the vault: the recipe's next, or 1 for a new recipe. */
export const draftVersion = (recipe?: Pick<Recipe, 'version'> | null): number =>
  recipe ? (recipe.version ?? 1) + 1 : 1;

/** The draft editing this recipe, if there is one. */
export const draftFor = (drafts: readonly RecipeDraft[], recipeId: string): RecipeDraft | null =>
  drafts.find((draft) => draft.recipeId === recipeId) ?? null;

/** Drafts of new recipes, the latest first. */
export const newRecipeDrafts = (drafts: readonly RecipeDraft[]): RecipeDraft[] =>
  drafts.filter((draft) => !draft.recipeId).sort((a, b) => b.savedAt - a.savedAt);

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * A stored draft, or null when it isn't one. Read field by field, since it comes back from the
 * cloud or this device's storage; the editor then reads its content as it reads any recipe.
 */
export function parseDraft(raw: unknown): RecipeDraft | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id || !isObject(raw.recipe)) {
    return null;
  }
  const content = raw.recipe;
  const recipeId = typeof raw.recipeId === 'string' && raw.recipeId ? raw.recipeId : undefined;
  const draft: RecipeDraft = {
    id: raw.id,
    recipe: {
      ...content,
      id: recipeId ?? raw.id,
      name: str(content.name),
      author: str(content.author),
      category: str(content.category),
      heroImage: str(content.heroImage),
      yieldHeader: str(content.yieldHeader),
      ingredients: (Array.isArray(content.ingredients) ? content.ingredients : []).filter(
        isObject,
      ) as unknown as Ingredient[],
      steps: (Array.isArray(content.steps) ? content.steps : []).filter(
        isObject,
      ) as unknown as Step[],
    },
    language: raw.language === 'pl' ? 'pl' : 'en',
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0,
  };
  // A remix's draft names its original by id; anything else there is dropped.
  delete draft.recipe.remixOf;
  if (!recipeId && typeof content.remixOf === 'string' && content.remixOf) {
    draft.recipe.remixOf = content.remixOf;
  }
  if (recipeId) draft.recipeId = recipeId;
  if (typeof raw.baseVersion === 'number') draft.baseVersion = raw.baseVersion;
  if (typeof raw.changeNote === 'string' && raw.changeNote) draft.changeNote = raw.changeNote;
  return draft;
}
