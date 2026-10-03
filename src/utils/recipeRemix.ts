import { Language, Recipe } from '../types/recipe';
import { editingLanguage, recipeForEditing } from './recipeTranslation';

/**
 * Remixes: a family member's own take on a recipe (theirs or someone else's), saved as a new
 * recipe they own, starting again at version 1. A remix records its original by id (`remixOf`);
 * the original is never written to, so its remixes are counted from the remixes themselves.
 */

/** The original's id, when the recipe is a remix. Read with care: it comes from the cloud. */
export function remixOriginalId(recipe: Pick<Recipe, 'remixOf'>): string | null {
  return typeof recipe.remixOf === 'string' && recipe.remixOf ? recipe.remixOf : null;
}

/**
 * Where a remix came from: the original recipe, or null when the original is no longer in the
 * Recipe Box (deleted). Undefined when the recipe isn't a remix.
 */
export function remixOriginal(
  recipes: readonly Recipe[],
  recipe: Pick<Recipe, 'remixOf'>,
): Recipe | null | undefined {
  const id = remixOriginalId(recipe);
  if (!id) return undefined;
  return recipes.find((r) => r.id === id) ?? null;
}

/** The remixes made of a recipe, the first made first. */
export function remixesOf(recipes: readonly Recipe[], id: string): Recipe[] {
  return recipes
    .filter((r) => remixOriginalId(r) === id)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/** How many remixes each recipe has, by id (recipes without any are left out). */
export function remixCounts(recipes: readonly Recipe[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    const id = remixOriginalId(recipe);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * What the editor opens a remix on: the original's content, in the language the editor shows
 * it in, as a new recipe. It keeps none of the original's bookkeeping (id, owner, versions,
 * translations, dates), so saving it makes a new recipe owned by whoever remixed it, at
 * version 1, credited to them. Photos come along; the remixer can change them.
 */
export function remixStart(original: Recipe, viewerLanguage: Language): Recipe {
  const {
    id: _id,
    ownerEmail: _ownerEmail,
    ownerName: _ownerName,
    ownerNameAsTyped: _ownerNameAsTyped,
    version: _version,
    changeNote: _changeNote,
    versionIndex: _versionIndex,
    history: _history,
    translations: _translations,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    deletedAt: _deletedAt,
    sourceUrl: _sourceUrl,
    sourceText: _sourceText,
    photosOmitted: _photosOmitted,
    ...content
  } = recipeForEditing(original, viewerLanguage);
  return {
    ...content,
    id: '',
    author: '',
    authorMode: 'auto',
    sourceLanguage: remixLanguage(original, viewerLanguage),
    remixOf: original.id,
  };
}

/** The language a remix is written in: the one the editor shows the original in. */
export function remixLanguage(original: Recipe, viewerLanguage: Language): Language {
  return editingLanguage(original, viewerLanguage);
}
