import { UI_TEXT, UiTranslations } from '../i18n/translations';
import { ImportedRecipe, readImportedPage, recipeFromPage } from '../utils/recipeImport';
import { ImportError, fetchRecipePage } from './recipeImport';

/** What can go wrong reading a recipe off a website, as the paste sheets word it. */
export type ImportProblem = keyof UiTranslations['importErrors'];

/**
 * A recipe read off a web page through the import worker, or why not. A number of servings is
 * worded in the page's language when it's one of the family's, else in the app's.
 */
export async function importRecipe(
  url: string,
  t: UiTranslations,
): Promise<{ recipe: ImportedRecipe } | { problem: ImportProblem }> {
  let page: ReturnType<typeof readImportedPage>;
  try {
    // What the worker sends is read inside the try too: an odd reply is a failed import.
    page = readImportedPage(await fetchRecipePage(url));
  } catch (error) {
    return { problem: error instanceof ImportError ? error.reason : 'failed' };
  }
  const pageLanguage = page?.lang.slice(0, 2).toLowerCase();
  const words = pageLanguage === 'en' || pageLanguage === 'pl' ? UI_TEXT[pageLanguage] : t;
  const recipe =
    page && recipeFromPage(page, { servings: words.importServings, time: words.totalTime });
  return recipe ? { recipe } : { problem: 'noRecipe' };
}
