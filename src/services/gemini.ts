import { Recipe } from '../types/recipe';
import { app, isFirebaseConfigured } from './firebase';
import {
  ParsedTranslation,
  parseTranslationResponse,
  translatableContent,
} from '../utils/recipeTranslation';

const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-3.8-flash';

/** Translation runs through Firebase AI Logic, so it needs the Firebase project. */
export const isTranslationAvailable = isFirebaseConfigured;

function buildPrompt(recipe: Recipe): string {
  return `You are an expert bilingual culinary chef and baking translator for English and Polish.
The recipe below is written in either English or Polish.
First decide which one, and put "en" or "pl" in "detectedLanguage".
Then translate the recipe into the OTHER language: English → authentic, idiomatic Polish, or Polish → natural, idiomatic English.

Crucial Culinary Guidelines:
1. "name": Recipe title in the target language.
2. "cardDescription": A warm, appetizing 1-2 sentence summary for the recipe card, in the target language. If the recipe has none, write one.
3. Translate culinary techniques naturally, never word for word:
   - "sloppy dough" ↔ "luźne / rzadkie, klejące ciasto" (NOT "niechlujne ciasto")
   - "Dutch oven" ↔ "garnek żeliwny" (NOT "holenderski piec")
   - "lamination directive" ↔ "instrukcja składania ciasta"
4. Keep exact numbers, measurements (e.g. 450g, 2 teaspoons / łyżeczki, 1.5 cups / szklanki or 375ml) and temperatures (450°F / 230°C).
5. For each ingredient, in the same order:
   - "name": ingredient name (e.g. "Mąka pszenna" / "All-purpose flour")
   - "prefix": leading name before the quantity if formatted like "Mąka pszenna - "
   - "text": the complete translated line
   - "unit": translated unit (e.g. "g", "łyżeczki" / "teaspoons")
   - "renderUnit": the form used for amounts up to and including 1 unit, and for Polish 2-4 (e.g. "łyżeczki" / "teaspoon")
   - "renderUnitPlural": the form used for larger amounts; for Polish the genitive plural (e.g. "łyżeczek" / "teaspoons")
   - "altUnit": translated alternative unit (e.g. "ml")
   - "suffix": translated suffix (e.g. " posiekanych" / " chopped")
6. For each step, in the same order: "text", plus "notes" and "imageCaption" when present.
7. Return ONLY valid JSON matching the schema.

Recipe:
${JSON.stringify(translatableContent(recipe), null, 2)}
`;
}

/**
 * Detects whether the recipe is English or Polish and translates it into the other language.
 * The response is validated before it's returned; the caller decides what to do on failure.
 */
export async function translateRecipe(recipe: Recipe): Promise<ParsedTranslation> {
  if (!isTranslationAvailable || !app) {
    throw new Error('Translation is unavailable: Firebase is not configured.');
  }

  // Dynamic import keeps the AI SDK out of the initial bundle.
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai');
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const text = Schema.string();
  const schema = Schema.object({
    properties: {
      detectedLanguage: Schema.enumString({ enum: ['en', 'pl'] }),
      name: text,
      cardDescription: text,
      yieldHeader: text,
      tips: text,
      notes: text,
      laminationDirective: text,
      ingredients: Schema.array({
        items: Schema.object({
          properties: {
            name: text,
            prefix: text,
            text,
            unit: text,
            renderUnit: text,
            renderUnitPlural: text,
            altUnit: text,
            suffix: text,
          },
          optionalProperties: [
            'name',
            'prefix',
            'unit',
            'renderUnit',
            'renderUnitPlural',
            'altUnit',
            'suffix',
          ],
        }),
      }),
      steps: Schema.array({
        items: Schema.object({
          properties: {
            num: Schema.number(),
            text,
            notes: text,
            imageCaption: text,
          },
          optionalProperties: ['notes', 'imageCaption'],
        }),
      }),
      bakingOptions: Schema.object({
        properties: {
          option1: text,
          option2: Schema.array({ items: text }),
        },
        optionalProperties: ['option1', 'option2'],
      }),
    },
    optionalProperties: ['yieldHeader', 'tips', 'notes', 'laminationDirective', 'bakingOptions'],
  });

  const generate = (model: string) =>
    getGenerativeModel(ai, {
      model,
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    }).generateContent(buildPrompt(recipe));

  let result;
  try {
    result = await generate(PRIMARY_MODEL);
  } catch (err) {
    console.warn(`${PRIMARY_MODEL} failed, trying ${FALLBACK_MODEL}:`, err);
    result = await generate(FALLBACK_MODEL);
  }

  return parseTranslationResponse(JSON.parse(result.response.text()));
}
