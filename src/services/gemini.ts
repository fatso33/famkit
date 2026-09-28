import { Language, Recipe } from '../types/recipe';
import { app, isFirebaseConfigured } from './firebase';
import {
  PieceRequest,
  PieceTranslation,
  TranslationRejectedError,
  parsePieceResponse,
  translatableContent,
  translationMemory,
} from '../utils/recipeTranslation';
import {
  Piece,
  TextKind,
  buildTranslation,
  pieceHash,
  recipePieces,
} from '../utils/translationPieces';

// Flash for natural, contextual wording; Flash-Lite (its own free quota) when Flash is busy or
// over its limit. Both think a little: thinking is billed as output, and translation needs little.
const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

/** Translation runs through Firebase AI Logic, so it needs the Firebase project. */
export const isTranslationAvailable = isFirebaseConfigured;

const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', pl: 'Polish' };

const KIND_NAMES: Record<TextKind, string> = {
  title: 'recipe title',
  description: 'short description for the recipe card',
  yield: 'yield line, like "For 1 loaf:"',
  tips: 'tips',
  notes: 'notes',
  step: 'step',
  stepTip: 'tip for the step',
  caption: 'photo caption',
  heading: 'section heading (a few words)',
  substep: 'part of a step',
  pathLabel: 'name on a switch between ways of doing a step (1-3 words)',
  pathText: 'step, done this way',
  pathStep: 'step, done this way',
};

/** What's sent: each piece with a short id, the ids mapped back to the pieces. */
function requestPieces(pieces: Piece[]) {
  const requested: PieceRequest = new Map();
  const texts: { id: string; kind: string; text: string }[] = [];
  const ingredients: ({ id: string } & Record<string, string>)[] = [];
  pieces.forEach((piece, i) => {
    const id = `p${i + 1}`;
    requested.set(id, piece);
    if (piece.kind === 'ingredient') {
      ingredients.push({ id, ...(piece.ingredient as Record<string, string>) });
    } else {
      texts.push({ id, kind: KIND_NAMES[piece.kind], text: piece.text });
    }
  });
  return { requested, texts, ingredients };
}

// Translating only some pieces: the whole recipe is context, with its current translation so
// new wording matches. Translating all of them: the pieces are the recipe.
function promptContext(recipe: Recipe, pieces: Piece[], from?: string, to?: string): string {
  const all = new Set(recipePieces(translatableContent(recipe)).map(pieceHash));
  if (pieces.length >= all.size) return '';
  let context = `\nThe whole recipe, for context:\n${JSON.stringify(translatableContent(recipe))}\n`;
  const memory = translationMemory(recipe);
  if (memory.size > 0 && from && to) {
    const current = buildTranslation(translatableContent(recipe), (p) => memory.get(pieceHash(p)));
    context +=
      `\nIts current ${to} version. Keep the new pieces consistent with its wording (parts still in ${from} are the ones being translated now):\n` +
      `${JSON.stringify(current.content)}\n`;
  }
  return context;
}

function buildPrompt(
  recipe: Recipe,
  pieces: Piece[],
  texts: object[],
  ingredients: object[],
  language?: Language,
): string {
  const from = language && LANGUAGE_NAMES[language];
  const to = language && LANGUAGE_NAMES[language === 'en' ? 'pl' : 'en'];
  const languageRule = language
    ? `The recipe is written in ${from}. Translate the pieces into ${to}, and put "${language}" in "detectedLanguage".`
    : 'The recipe is written in English or Polish. Put the language it is written in ("en" or "pl") in "detectedLanguage", and translate the pieces into the other one.';
  // The recipe page picks the Polish unit form by amount; English adds its own plural "s".
  const unitRule =
    language === 'pl'
      ? ''
      : ' When translating into Polish and a row has "unit", also give "renderUnit" (the form for amounts up to 1 and for 2-4, e.g. "łyżeczki") and "renderUnitPlural" (for 5 and more, e.g. "łyżeczek").';

  return `You translate a family's recipes between English and Polish for their private cookbook. Write the way a skilled home cook writes in the target language: natural, warm and idiomatic, never word for word.

${languageRule}

Rules:
1. Translate cooking terms the way cooks say them, e.g. "sloppy dough" = "luźne, klejące ciasto" (not "niechlujne ciasto"), "Dutch oven" = "garnek żeliwny" (not "holenderski piec").
2. Keep every number, amount, temperature and time exactly as written (450g, 1.5, 450°F, 30 minutes). Don't convert units or add anything.
3. Don't add, drop, merge or explain anything. Each piece says exactly what its original says.
4. Keep people's names; a possessive takes the natural form ("Wanda's Cheese Bread" = "Chleb serowy Wandy").
5. Instructions: in Polish, the informal imperative ("Dodaj", "Wymieszaj"); in English, the imperative ("Add", "Mix").
6. Polish needs correct grammar and number agreement ("2 łyżeczki", "5 łyżeczek").
7. Each piece has a "kind" saying what it is; word it to fit (a switch name stays very short, a heading is a heading).
8. Ingredients: translate "text" (the whole line) and each other field given, returning the same fields. Keep the spacing and dashes of "prefix" and "suffix".${unitRule}
9. Return every piece, with its id, and only valid JSON matching the schema.
${promptContext(recipe, pieces, from, to)}
Pieces to translate:
${JSON.stringify({ texts, ingredients })}
`;
}

/**
 * Translates the given pieces of the recipe (see utils/translationPieces). `language` is the
 * recipe's language when it's settled; otherwise the model detects it. The response is
 * validated before it's returned; the caller decides what to do on failure.
 */
export async function translatePieces(
  recipe: Recipe,
  pieces: Piece[],
  language?: Language,
): Promise<PieceTranslation> {
  if (!isTranslationAvailable || !app) {
    throw new Error('Translation is unavailable: Firebase is not configured.');
  }

  // Dynamic import keeps the AI SDK out of the initial bundle.
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema, ThinkingLevel } =
    await import('firebase/ai');
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const text = Schema.string();
  const ingredientFields = [
    'name',
    'prefix',
    'unit',
    'renderUnit',
    'renderUnitPlural',
    'altUnit',
    'suffix',
    'note',
    'substitute',
    'substituteAmount',
  ];
  const schema = Schema.object({
    properties: {
      detectedLanguage: Schema.enumString({ enum: ['en', 'pl'] }),
      texts: Schema.array({
        items: Schema.object({ properties: { id: text, text } }),
      }),
      ingredients: Schema.array({
        items: Schema.object({
          properties: {
            id: text,
            text,
            ...Object.fromEntries(ingredientFields.map((field) => [field, text])),
          },
          optionalProperties: ingredientFields,
        }),
      }),
    },
    optionalProperties: ['texts', 'ingredients'],
  });

  const { requested, texts, ingredients } = requestPieces(pieces);
  const prompt = buildPrompt(recipe, pieces, texts, ingredients, language);
  const generate = (model: string) =>
    getGenerativeModel(ai, {
      model,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }).generateContent(prompt);

  let result;
  try {
    result = await generate(PRIMARY_MODEL);
  } catch (err) {
    console.warn(`${PRIMARY_MODEL} failed, trying ${FALLBACK_MODEL}:`, err);
    result = await generate(FALLBACK_MODEL);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(result.response.text());
  } catch (err) {
    throw new TranslationRejectedError('Translation response is not JSON', { cause: err });
  }
  return parsePieceResponse(raw, requested, language);
}
