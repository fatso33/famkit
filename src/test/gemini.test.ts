import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Recipe } from '../types/recipe';
import {
  pendingPieces,
  recipeTranslationDoc,
  resolveEdit,
  sourceHash,
} from '../utils/recipeTranslation';
import { pieceHash } from '../utils/translationPieces';
import { TranslationDoc } from '../utils/translationRequest';

const { generateContent, getGenerativeModel, firebaseState } = vi.hoisted(() => {
  const generateContent = vi.fn();
  return {
    generateContent,
    getGenerativeModel: vi.fn(() => ({ generateContent })),
    firebaseState: { configured: true },
  };
});

vi.mock('../services/firebase', () => ({
  get app() {
    return firebaseState.configured ? { name: 'test-app' } : null;
  },
  get isFirebaseConfigured() {
    return firebaseState.configured;
  },
}));

// Minimal stand-in for Firebase AI Logic: records the prompt and schema, returns a canned reply.
vi.mock('firebase/ai', () => {
  const schema = (kind: string) => (params?: object) => ({ kind, ...params });
  return {
    getAI: vi.fn(() => ({})),
    GoogleAIBackend: vi.fn(),
    getGenerativeModel,
    ThinkingLevel: { MINIMAL: 'MINIMAL', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
    Schema: {
      object: schema('object'),
      array: schema('array'),
      string: schema('string'),
      number: schema('number'),
      enumString: schema('enum'),
    },
  };
});

const reply = (json: unknown) => ({ response: { text: () => JSON.stringify(json) } });
const promptSent = () => generateContent.mock.calls[0][0] as string;
type SchemaNode = {
  kind: string;
  properties: Record<string, SchemaNode>;
  optionalProperties?: string[];
};
const schemaSent = () =>
  (getGenerativeModel.mock.calls[0] as unknown as [unknown, { generationConfig: object }])[1]
    .generationConfig as { responseSchema: SchemaNode };
const documentSchema = (key = 'd1') =>
  schemaSent().responseSchema.properties.documents.properties[key];

const testRecipe: Recipe = {
  id: 'test-recipe-1',
  name: 'Szarlotka Babci',
  author: 'Babcia',
  category: 'family',
  heroImage: 'data:image/jpeg;base64,HERO',
  yieldHeader: 'Dla 8 osób:',
  ingredients: [{ text: 'Jabłka - 6 dużych', qty: 6, unit: 'dużych' }],
  steps: [{ num: 1, text: 'Pokrój jabłka.', hasImage: true, imageSrc: 'data:image/jpeg;base64,S' }],
};

// Simple Turkey Chili as the website import saved it: editor rows, "name - amount".
const chili: Recipe = {
  id: 'chili',
  name: 'Simple Turkey Chili',
  author: 'Allrecipes',
  category: 'mains',
  heroImage: '',
  yieldHeader: 'For 8 servings:',
  sourceLanguage: 'en',
  ingredients: [
    { text: 'olive oil - 1.5 teaspoons', name: 'olive oil', note: '' },
    { text: 'onion, chopped - 1', name: 'onion, chopped', note: '' },
    {
      text: 'can canned kidney beans - drained, rinsed, and mashed - 1 (16 ounce)',
      name: 'can canned kidney beans - drained, rinsed, and mashed',
      note: '',
    },
  ],
  steps: [{ num: 1, text: 'Gather all ingredients.' }],
};

const docOf = (recipe: Recipe): TranslationDoc =>
  recipeTranslationDoc(recipe, pendingPieces(recipe));

const load = async () => {
  vi.resetModules();
  return import('../services/gemini');
};

describe('translateDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseState.configured = true;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails clearly when Firebase is not configured', async () => {
    firebaseState.configured = false;
    const { translateDocuments } = await load();
    await expect(translateDocuments([docOf(testRecipe)])).rejects.toThrow(
      /Firebase is not configured/,
    );
  });

  it('requires every ingredient it asks for, in the ingredients list (Simple Turkey Chili)', async () => {
    // Its Polish came back with every text but no ingredient: the old reply shape let the model
    // leave the list out, or answer the rows under "texts", and both were silently dropped.
    const { translateDocuments } = await load();
    generateContent.mockResolvedValue(reply({ documents: { d1: { texts: {} } } }));
    const doc = docOf(chili);
    await translateDocuments([doc]).catch(() => {});

    const d1 = documentSchema();
    const texts = d1.properties.texts;
    const ingredients = d1.properties.ingredients;
    // Named, required fields: no list or piece can be left out, nor answered in the wrong list.
    expect(d1.optionalProperties ?? []).toEqual([]);
    expect(texts.optionalProperties ?? []).toEqual([]);
    expect(ingredients.optionalProperties ?? []).toEqual([]);
    expect(Object.keys(texts.properties)).toEqual(['p1', 'p2', 'p6']);
    expect(Object.keys(ingredients.properties)).toEqual(['p3', 'p4', 'p5']);
    // Into Polish: each row's name and amount, and nothing it doesn't have.
    expect(ingredients.properties.p3).toMatchObject({
      properties: { name: { kind: 'string' }, amount: { kind: 'string' } },
    });
    expect(Object.keys(ingredients.properties.p3.properties)).toEqual(['name', 'amount']);
  });

  it('sends an editor row as its name and amount, and rebuilds the line from them', async () => {
    const { translateDocuments } = await load();
    generateContent.mockResolvedValue(
      reply({
        documents: {
          d1: {
            detectedLanguage: 'en',
            texts: {
              p1: 'Proste chili z indykiem',
              p2: 'Na 8 porcji:',
              p6: 'Przygotuj składniki.',
            },
            ingredients: {
              p3: { name: 'oliwa z oliwek', amount: '1.5 łyżeczki' },
              p4: { name: 'cebula, posiekana', amount: '1' },
              p5: {
                name: 'czerwona fasola z puszki - odsączona, opłukana i rozgnieciona',
                amount: '1 puszka (16 uncji)',
              },
            },
          },
        },
      }),
    );
    const doc = docOf(chili);
    const [result] = await translateDocuments([doc]);

    // Each word once: no whole line repeating the name, no empty note.
    expect(promptSent()).toContain('{"id":"p3","name":"olive oil","amount":"1.5 teaspoons"}');
    expect(promptSent()).not.toContain('"note"');
    const oil = doc.pieces.find((p) => p.key === 'ingredients:0')!;
    expect(result.values.get(pieceHash(oil))).toEqual({
      text: 'oliwa z oliwek - 1.5 łyżeczki',
      name: 'oliwa z oliwek',
      note: '',
    });
    const beans = doc.pieces.find((p) => p.key === 'ingredients:2')!;
    expect(result.values.get(pieceHash(beans))).toMatchObject({
      text: 'czerwona fasola z puszki - odsączona, opłukana i rozgnieciona - 1 puszka (16 uncji)',
    });
  });

  it('keeps nothing answered in the wrong list or without all its fields', async () => {
    const { translateDocuments } = await load();
    generateContent.mockResolvedValue(
      reply({
        documents: {
          d1: {
            detectedLanguage: 'en',
            // The rows as texts, one row missing its amount: none of it is taken.
            texts: { p1: 'Proste chili z indykiem', p3: 'oliwa z oliwek - 1.5 łyżeczki' },
            ingredients: { p4: { name: 'cebula, posiekana' } },
          },
        },
      }),
    );
    const doc = docOf(chili);
    const [result] = await translateDocuments([doc]);

    expect([...result.values.values()]).toEqual(['Proste chili z indykiem']);
  });

  it('detects a new recipe’s language, and never sends photos', async () => {
    const { translateDocuments } = await load();
    generateContent.mockResolvedValue(
      reply({
        documents: {
          d1: {
            detectedLanguage: 'pl',
            texts: { p1: "Grandma's Apple Pie", p2: 'Serves 8:', p4: 'Slice the apples.' },
            ingredients: { p3: { text: 'Apples - 6 large', unit: 'large', renderUnit: 'x' } },
          },
        },
      }),
    );
    const doc = docOf(testRecipe);
    const [result] = await translateDocuments([doc]);

    expect(result.detectedLanguage).toBe('pl');
    expect(result.values.get(pieceHash(doc.pieces[0]))).toBe("Grandma's Apple Pie");
    // Into English: the Polish-only unit forms are dropped (English reads renderUnit as a plural).
    expect(result.values.get(pieceHash(doc.pieces[2]))).toEqual({
      text: 'Apples - 6 large',
      unit: 'large',
    });
    expect(documentSchema().properties.detectedLanguage).toMatchObject({ kind: 'enum' });
    // A row with a unit may give its Polish forms, in case the recipe is English.
    expect(documentSchema().properties.ingredients.properties.p3.optionalProperties).toEqual([
      'renderUnit',
      'renderUnitPlural',
    ]);
    expect(promptSent()).toContain('"from":"unknown"');
    expect(promptSent()).toContain('Szarlotka Babci');
    expect(promptSent()).not.toContain('data:image');
    // Every piece is asked for, so the recipe isn't sent twice as context.
    expect(promptSent()).not.toContain('"context":');
  });

  it('asks for unit words translated, and the numbers and measures kept', async () => {
    const { translateDocuments } = await load();
    generateContent.mockResolvedValue(
      reply({ documents: { d1: { texts: { p1: "Grandma's Apple Pie" } } } }),
    );
    await translateDocuments([{ ...docOf(testRecipe), language: 'pl' }]);

    // "Keep every amount exactly as written" left "Mąka - 2 cups" in Polish.
    expect(promptSent()).not.toMatch(/amount[^.]*exactly as written/);
    expect(promptSent()).toContain('Unit words are words like any other and are translated');
    expect(promptSent()).toContain('"2 cups" = "2 szklanki"');
    expect(promptSent()).toContain('never convert one measure into another');
  });

  it('asks for only the changed pieces, with the recipe and its current translation as context', async () => {
    const { translateDocuments } = await load();
    const translated: Recipe = {
      ...testRecipe,
      sourceLanguage: 'pl',
      translations: {
        en: {
          name: "Grandma's Apple Pie",
          yieldHeader: 'Serves 8:',
          ingredients: [{ text: 'Apples - 6 large' }],
          steps: [{ num: 1, text: 'Slice the apples.' }],
          sourceHash: sourceHash(testRecipe),
        },
      },
    };
    // Saved from the editor, which keeps the translation of every piece it didn't change.
    const edited = resolveEdit(
      translated,
      { ...translated, name: 'Szarlotka Babci Zosi' },
      'pl',
      true,
    );
    const doc = docOf(edited);
    expect(doc.pieces.map((p) => p.key)).toEqual(['name']);
    generateContent.mockResolvedValue(
      reply({
        documents: { d1: { detectedLanguage: 'en', texts: { p1: "Grandma Zosia's Apple Pie" } } },
      }),
    );

    const [result] = await translateDocuments([doc]);

    // The recipe's settled language wins over anything the model says.
    expect(result.detectedLanguage).toBe('pl');
    expect([...result.values.values()]).toEqual(["Grandma Zosia's Apple Pie"]);
    const prompt = promptSent();
    expect(prompt).toContain('"from":"Polish"');
    expect(prompt).toContain('"context":');
    expect(prompt).toContain('Pokrój jabłka.');
    expect(prompt).toContain('Slice the apples.');
    expect(prompt).toContain('"id":"p1"');
    expect(prompt).not.toContain('"id":"p2"');
    expect(documentSchema().properties.detectedLanguage).toBeUndefined();
  });

  it('sends several documents in one request, each with its own ids', async () => {
    const { translateDocuments } = await load();
    generateContent.mockResolvedValue(
      reply({
        documents: {
          d1: { detectedLanguage: 'en', texts: { p1: 'Proste chili z indykiem' } },
          d2: { detectedLanguage: 'pl', texts: { p5: "Grandma's Apple Pie" } },
        },
      }),
    );
    const chiliTitle = { ...docOf(chili), pieces: docOf(chili).pieces.slice(0, 1) };
    const [first, second] = await translateDocuments([chiliTitle, docOf(testRecipe)]);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ ref: 'chili', detectedLanguage: 'en' });
    expect([...first.values.values()]).toEqual(['Proste chili z indykiem']);
    expect(second).toMatchObject({ ref: 'test-recipe-1', detectedLanguage: 'pl' });
    expect([...second.values.values()]).toEqual(["Grandma's Apple Pie"]);
    expect(Object.keys(schemaSent().responseSchema.properties.documents.properties)).toEqual([
      'd1',
      'd2',
    ]);
  });

  it('uses Gemini 3.8 Flash thinking lightly', async () => {
    const { translateDocuments } = await load();
    generateContent.mockResolvedValue(
      reply({ documents: { d1: { detectedLanguage: 'pl', texts: { p1: 'Pie' } } } }),
    );

    await translateDocuments([docOf(testRecipe)]);
    const models = getGenerativeModel.mock.calls.map((call) => (call as unknown[])[1]);
    expect(models).toMatchObject([
      {
        model: 'gemini-3.8-flash',
        generationConfig: { thinkingConfig: { thinkingLevel: 'LOW' } },
      },
    ]);
  });

  it('never hands a busy Flash’s work to a lighter model (the recipe waits for Flash)', async () => {
    const { translateDocuments } = await load();
    generateContent.mockRejectedValue(new Error('overloaded'));

    await expect(translateDocuments([docOf(testRecipe)])).rejects.toThrow('overloaded');
    const models = getGenerativeModel.mock.calls.map((call) => (call as unknown[])[1]);
    expect(models).toMatchObject([{ model: 'gemini-3.8-flash' }]);
  });

  it('pauses until midnight Pacific when the day’s allowance is used up', async () => {
    vi.useFakeTimers();
    // 11:29 in Los Angeles (14:29 in Peter's Eastern time zone).
    vi.setSystemTime(new Date('2026-09-30T18:29:47Z'));
    const { translateDocuments } = await load();
    generateContent.mockRejectedValue(
      Object.assign(new Error('[429 ] You exceeded your current quota'), {
        code: 'fetch-error',
        customErrorData: {
          status: 429,
          errorDetails: [
            { quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' },
            { retryDelay: '45s' },
          ],
        },
      }),
    );

    const failure = await translateDocuments([docOf(testRecipe)]).catch((e: unknown) => e);
    expect(failure).toMatchObject({ name: 'TranslationQuotaError' });
    // Midnight Pacific (07:00 UTC in daylight time), and a minute to be sure.
    expect(new Date((failure as { retryAt: number }).retryAt).toISOString()).toBe(
      '2026-10-01T07:01:00.000Z',
    );
  });

  it('waits as long as Google says when only the per-minute allowance is used up', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T18:00:00Z'));
    const { translateDocuments } = await load();
    generateContent.mockRejectedValue(
      Object.assign(new Error('[429 ]'), {
        customErrorData: {
          status: 429,
          errorDetails: [{ quotaId: 'GenerateRequestsPerMinutePerProject' }, { retryDelay: '12s' }],
        },
      }),
    );

    const failure = await translateDocuments([docOf(testRecipe)]).catch((e: unknown) => e);
    expect(failure).toMatchObject({
      name: 'TranslationQuotaError',
      retryAt: new Date('2026-09-30T18:00:12Z').getTime(),
    });
  });

  it.each([
    [
      'a blocked reply',
      () => {
        throw Object.assign(new Error('Response error: RECITATION'), { code: 'response-error' });
      },
    ],
    [
      'an unknown language',
      () => reply({ documents: { d1: { detectedLanguage: 'de', texts: { p1: 'X' } } } }),
    ],
    ['nothing translated', () => reply({ documents: { d1: { texts: { p9: 'X' } } } })],
    ['no documents', () => reply({ texts: { p1: 'X' } })],
    ['not JSON', () => ({ response: { text: () => 'Sorry, I cannot help' } })],
  ])('rejects %s instead of storing it', async (_label, answer) => {
    const { translateDocuments } = await load();
    generateContent.mockImplementation(() => Promise.resolve().then(answer));
    await expect(translateDocuments([docOf(testRecipe)])).rejects.toMatchObject({
      // By name: the service is re-imported fresh, with its own copy of the class.
      name: 'TranslationRejectedError',
    });
  });
});
