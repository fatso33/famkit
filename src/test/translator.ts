import { Language, LocalizedRecipeContent, Recipe } from '../types/recipe';
import {
  PieceTranslation,
  pairedMemory,
  sourceLanguageOf,
  translatableContent,
} from '../utils/recipeTranslation';
import { DocReply, TranslationDoc } from '../utils/translationRequest';
import { IngredientWords, pieceHash } from '../utils/translationPieces';

/** The translator's answer for `recipe`: its pieces found at the same place in `content`. */
export function answerFrom(
  recipe: Recipe,
  content: LocalizedRecipeContent,
  detectedLanguage: Language = sourceLanguageOf(recipe),
): PieceTranslation {
  return { detectedLanguage, values: pairedMemory(translatableContent(recipe), content) };
}

/** The same answer as the translation service gives it, for a request of one recipe. */
export function replyFrom(
  recipe: Recipe,
  content: LocalizedRecipeContent,
  detectedLanguage?: Language,
): (docs: TranslationDoc[]) => Promise<DocReply[]> {
  const { values } = answerFrom(recipe, content);
  return (docs) =>
    Promise.resolve(
      docs.map((doc) => ({
        ref: doc.ref,
        detectedLanguage: doc.language ?? detectedLanguage,
        values: new Map(
          doc.pieces.flatMap((p) =>
            values.has(pieceHash(p)) ? [[pieceHash(p), values.get(pieceHash(p))!]] : [],
          ),
        ),
      })),
    );
}

/**
 * A stand-in translator that knows some words: each asked-for piece it has an entry for comes
 * back translated (text by text; an ingredient by its line). A new document's language is
 * `detectedLanguage` (or its recipe's).
 */
export function dictionaryTranslator(
  dictionary: Record<string, string | IngredientWords>,
  detectedLanguage?: Language,
) {
  return (docs: TranslationDoc[]): Promise<DocReply[]> =>
    Promise.resolve(
      docs.map((doc) => {
        const values: DocReply['values'] = new Map();
        for (const piece of doc.pieces) {
          const found =
            dictionary[piece.kind === 'ingredient' ? piece.ingredient.text : piece.text];
          if (found !== undefined) values.set(pieceHash(piece), found);
        }
        return { ref: doc.ref, detectedLanguage: doc.language ?? detectedLanguage ?? 'en', values };
      }),
    );
}
