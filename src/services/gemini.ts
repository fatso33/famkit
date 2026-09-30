import { app, isFirebaseConfigured } from './firebase';
import { TranslationQuotaError, TranslationRejectedError } from '../utils/recipeTranslation';
import { nextDailyReset } from '../utils/translationQueue';
import {
  DocReply,
  ReplyShape,
  TranslationDoc,
  buildRequest,
  parseReply,
} from '../utils/translationRequest';

// Flash for natural, contextual wording, thinking a little: thinking is billed as output, and
// translation needs little. Only Flash: when it's busy the recipe waits rather than getting a
// lighter model's weaker Polish.
const MODEL = 'gemini-3.8-flash';

/** Translation runs through Firebase AI Logic, so it needs the Firebase project. */
export const isTranslationAvailable = isFirebaseConfigured;

function buildPrompt(payload: object): string {
  return `You translate a family's recipes, and their notes on what they cooked, between English and Polish for their private cookbook. Write the way a skilled home cook writes in the target language: natural, warm and idiomatic, never word for word.

Each document below is translated on its own, into its other language: English into Polish, Polish into English. Its "from" names the language it's written in. Where "from" is "unknown", decide whether it's written in English or Polish, put "en" or "pl" in its "detectedLanguage", and translate it into the other one.

Rules:
1. Translate cooking terms the way cooks say them, e.g. "sloppy dough" = "luźne, klejące ciasto" (not "niechlujne ciasto"), "Dutch oven" = "garnek żeliwny" (not "holenderski piec").
2. Keep every number, temperature and time exactly as written (450g, 1.5, 450°F, 30 minutes), and never convert one measure into another (cups stay cups, ounces stay ounces). Unit words are words like any other and are translated: "2 cups" = "2 szklanki", "1 tsp" = "1 łyżeczka", "3 Tbsp" = "3 łyżki", "4 oz" = "4 uncje", "a pinch" = "szczypta", "2 łyżki" = "2 tablespoons". Symbols stay as they are (g, kg, ml, l, °C, °F).
3. Don't add, drop, merge or explain anything. Each piece says exactly what its original says.
4. Keep people's names; a possessive takes the natural form ("Wanda's Cheese Bread" = "Chleb serowy Wandy").
5. Instructions: in Polish, the informal imperative ("Dodaj", "Wymieszaj"); in English, the imperative ("Add", "Mix").
6. Polish needs correct grammar and number agreement ("2 łyżeczki", "5 łyżeczek").
7. Each text has a "kind" saying what it is; word it to fit (a switch name stays very short, a heading is a heading).
8. Ingredients: translate every field given and return the same fields. "name" is the ingredient, "amount" how much of it, "text" a whole ingredient line. Keep the spacing and dashes of "prefix" and "suffix". When translating into Polish and a row has "unit", also give "renderUnit" (the unit's form for amounts up to 1 and for 2-4, e.g. "łyżeczki") and "renderUnitPlural" (for 5 and more, e.g. "łyżeczek").
9. A document with "context" is partly translated already: "whole" is all of its text, and "current" its present translation. Translate only its "texts" and "ingredients", consistent with the wording of "current" (the parts of "current" still in the original language are the ones being translated now).
10. Return every piece under its document and id, as valid JSON matching the schema.

Documents:
${JSON.stringify(payload)}
`;
}

type Detail = { retryDelay?: unknown };

/**
 * Google's "too many requests" as a pause: the daily allowance until it resets (midnight
 * Pacific), a per-minute one for as long as Google says. Anything else is passed on as it is.
 */
function asQuotaError(err: unknown): unknown {
  const data = (err as { customErrorData?: { status?: number; errorDetails?: unknown } })
    .customErrorData;
  if (data?.status !== 429) return err;
  const details: Detail[] = Array.isArray(data.errorDetails) ? data.errorDetails : [];
  const now = Date.now();
  if (/PerDay/i.test(JSON.stringify(details))) {
    return new TranslationQuotaError('Gemini’s daily allowance is used up', nextDailyReset(now), {
      cause: err,
    });
  }
  const seconds = details
    .map((d) => parseFloat(String(d.retryDelay ?? '')))
    .find((s) => Number.isFinite(s) && s > 0);
  return new TranslationQuotaError(
    'Gemini asked to wait before the next request',
    now + Math.max(5, seconds ?? 60) * 1000,
    { cause: err },
  );
}

/**
 * Translates the documents' pieces in one request (see utils/translationRequest), each into its
 * other language. What comes back is read against what was asked; checking each piece's words
 * is the caller's (reviewReply). Throws TranslationRejectedError when the answer is unusable
 * (blocked, not JSON, nothing translated), TranslationQuotaError when the allowance is used up.
 */
export async function translateDocuments(docs: TranslationDoc[]): Promise<DocReply[]> {
  if (!isTranslationAvailable || !app) {
    throw new Error('Translation is unavailable: Firebase is not configured.');
  }

  // Dynamic import keeps the AI SDK out of the initial bundle.
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema, ThinkingLevel } =
    await import('firebase/ai');
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  // Every piece asked for is a required field of its own list, so none can be left out or
  // answered in the wrong place.
  const text = Schema.string();
  const fields = (names: string[]) => Object.fromEntries(names.map((name) => [name, text]));
  const documentSchema = (doc: ReplyShape['documents'][number]) =>
    Schema.object({
      properties: {
        ...(doc.detect ? { detectedLanguage: Schema.enumString({ enum: ['en', 'pl'] }) } : {}),
        ...(doc.texts.length > 0
          ? { texts: Schema.object({ properties: fields(doc.texts) }) }
          : {}),
        ...(doc.ingredients.length > 0
          ? {
              ingredients: Schema.object({
                properties: Object.fromEntries(
                  doc.ingredients.map((row) => [
                    row.id,
                    Schema.object({
                      properties: fields([...row.required, ...row.optional]),
                      optionalProperties: row.optional,
                    }),
                  ]),
                ),
              }),
            }
          : {}),
      },
    });

  const request = buildRequest(docs);
  const schema = Schema.object({
    properties: {
      documents: Schema.object({
        properties: Object.fromEntries(
          request.shape.documents.map((doc) => [doc.key, documentSchema(doc)]),
        ),
      }),
    },
  });

  let answer: string;
  try {
    const result = await getGenerativeModel(ai, {
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }).generateContent(buildPrompt(request.payload));
    answer = result.response.text();
  } catch (err) {
    // A reply Gemini blocked (e.g. for "recitation") is an answer, just an unusable one.
    if ((err as { code?: string }).code === 'response-error') {
      throw new TranslationRejectedError('Translation response was blocked', { cause: err });
    }
    throw asQuotaError(err);
  }

  let replies: DocReply[];
  try {
    replies = parseReply(JSON.parse(answer), docs, request);
  } catch (err) {
    throw new TranslationRejectedError('Translation response is not usable JSON', { cause: err });
  }
  // A document whose language the reply got wrong has nothing usable either.
  if (replies.every((reply) => reply.values.size === 0 || !reply.detectedLanguage)) {
    throw new TranslationRejectedError('Translation response translated nothing');
  }
  return replies;
}
