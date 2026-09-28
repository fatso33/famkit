import { Language, LocalizedRecipeContent, Recipe } from '../types/recipe';
import {
  PieceTranslation,
  pairedMemory,
  sourceLanguageOf,
  translatableContent,
} from '../utils/recipeTranslation';
import { IngredientWords, Piece, pieceHash } from '../utils/translationPieces';

/** The translator's answer for `recipe`: its pieces found at the same place in `content`. */
export function answerFrom(
  recipe: Recipe,
  content: LocalizedRecipeContent,
  detectedLanguage: Language = sourceLanguageOf(recipe),
): PieceTranslation {
  return { detectedLanguage, values: pairedMemory(translatableContent(recipe), content) };
}

/**
 * A stand-in translator that knows some words: each asked-for piece it has an entry for comes
 * back translated (text by text; an ingredient by its line).
 */
export function dictionaryTranslator(
  dictionary: Record<string, string | IngredientWords>,
  detectedLanguage?: Language,
) {
  return (recipe: Recipe, pieces: Piece[], language?: Language): Promise<PieceTranslation> => {
    const values: PieceTranslation['values'] = new Map();
    for (const piece of pieces) {
      const found = dictionary[piece.kind === 'ingredient' ? piece.ingredient.text : piece.text];
      if (found !== undefined) values.set(pieceHash(piece), found);
    }
    return Promise.resolve({
      detectedLanguage: language ?? detectedLanguage ?? sourceLanguageOf(recipe),
      values,
    });
  };
}
