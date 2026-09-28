// One-time repair. Remove it (with src/data/wandasCheeseBread.ts and its call in useRecipes)
// once it has run. When Peter moved Wanda's Cheese Bread to the new editor, her lamination and
// baking blocks became steps and a Baking fork, and the background translation replaced her
// hand-written Polish with machine Polish that left the fork in English. This gives back her
// hand-written words for every piece whose English is unchanged; the fork's labels and heading
// get the app's own Polish for them. Only the translation changes, so it's no new version.
import { Language, Recipe } from '../types/recipe';
import type { CurrentUser } from '../hooks/useCurrentUser';
import { WANDAS_CHEESE_BREAD_SEED } from '../data/wandasCheeseBread';
import { UI_TEXT } from '../i18n/translations';
import { canEditRecipe } from './ownership';
import {
  TranslationMemory,
  otherLanguage,
  pairedMemory,
  sourceLanguageOf,
  translatableContent,
  translationMemory,
  withTranslation,
} from './recipeTranslation';
import { PieceValue, ingredientWords, pieceHash, recipePieces } from './translationPieces';

export const WANDAS_RECIPE_ID = WANDAS_CHEESE_BREAD_SEED.id;

/** Wanda's hand-written pairs, and the editor's labels for her fork, into `target`. */
function handWritten(target: Language): TranslationMemory {
  const { translations, ...seed } = WANDAS_CHEESE_BREAD_SEED;
  const english = translatableContent(seed);
  const polish = translations!.pl!;
  const memory = target === 'pl' ? pairedMemory(english, polish) : pairedMemory(polish, english);

  const labels: [string, string][] = [
    [UI_TEXT.en.bakingOptions, UI_TEXT.pl.bakingOptions],
    [UI_TEXT.en.legacyBakingPaths[0], UI_TEXT.pl.legacyBakingPaths[0]],
    [UI_TEXT.en.legacyBakingPaths[1], UI_TEXT.pl.legacyBakingPaths[1]],
  ];
  for (const [en, pl] of labels) {
    const [from, to] = target === 'pl' ? [en, pl] : [pl, en];
    memory.set(pieceHash({ key: '', kind: 'heading', text: from }), to);
  }
  return memory;
}

const same = (a: PieceValue, b: PieceValue) =>
  typeof a === 'string' || typeof b === 'string'
    ? a === b
    : JSON.stringify(ingredientWords(a)) === JSON.stringify(ingredientWords(b));

/**
 * Wanda's recipe with her hand-written words back in its translation, on its owner's device
 * only (one phone writes it). Null when there's nothing to restore, so it runs once.
 */
export function restoreWandasPolish(recipe: Recipe, user: CurrentUser | null): Recipe | null {
  if (recipe.id !== WANDAS_RECIPE_ID || !canEditRecipe(recipe, user, true)) return null;
  const seeded = handWritten(otherLanguage(sourceLanguageOf(recipe)));
  const current = translationMemory(recipe);
  const missing = recipePieces(translatableContent(recipe)).some((piece) => {
    const want = seeded.get(pieceHash(piece));
    const have = current.get(pieceHash(piece));
    return want !== undefined && (have === undefined || !same(have, want));
  });
  if (!missing) return null;
  return withTranslation(recipe, new Map([...current, ...seeded]));
}
