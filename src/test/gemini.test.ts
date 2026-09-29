import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Recipe } from '../types/recipe';
import { pendingPieces, resolveEdit, sourceHash } from '../utils/recipeTranslation';
import { pieceHash } from '../utils/translationPieces';

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

// Minimal stand-in for Firebase AI Logic: records the prompt, returns a canned response.
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

const load = async () => {
  vi.resetModules();
  return import('../services/gemini');
};

describe('translatePieces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseState.configured = true;
  });

  it('fails clearly when Firebase is not configured', async () => {
    firebaseState.configured = false;
    const { translatePieces } = await load();
    await expect(translatePieces(testRecipe, pendingPieces(testRecipe))).rejects.toThrow(
      /Firebase is not configured/,
    );
  });

  it('detects a new recipe’s language, translates every piece, and never sends photos', async () => {
    const { translatePieces } = await load();
    const pieces = pendingPieces(testRecipe);
    generateContent.mockResolvedValue(
      reply({
        detectedLanguage: 'pl',
        texts: [
          { id: 'p1', text: "Grandma's Apple Pie" },
          { id: 'p2', text: 'Serves 8:' },
          { id: 'p4', text: 'Slice the apples.' },
        ],
        ingredients: [{ id: 'p3', text: 'Apples - 6 large', unit: 'large', renderUnit: 'x' }],
      }),
    );

    const result = await translatePieces(testRecipe, pieces);

    expect(result.detectedLanguage).toBe('pl');
    expect(result.values.get(pieceHash(pieces[0]))).toBe("Grandma's Apple Pie");
    // Into English: the Polish-only unit forms are dropped (English reads renderUnit as a plural).
    expect(result.values.get(pieceHash(pieces[2]))).toEqual({
      text: 'Apples - 6 large',
      unit: 'large',
    });
    expect(promptSent()).toContain('Put the language it is written in');
    expect(promptSent()).toContain('Szarlotka Babci');
    expect(promptSent()).not.toContain('data:image');
    // Every piece is asked for, so the recipe isn't sent twice as context.
    expect(promptSent()).not.toContain('for context');
  });

  it('asks for unit words translated, and the numbers and measures kept', async () => {
    const { translatePieces } = await load();
    generateContent.mockResolvedValue(
      reply({ detectedLanguage: 'pl', texts: [{ id: 'p1', text: "Grandma's Apple Pie" }] }),
    );
    await translatePieces(testRecipe, pendingPieces(testRecipe), 'pl');

    // "Keep every amount exactly as written" left "Mąka - 2 cups" in Polish.
    expect(promptSent()).not.toMatch(/amount[^.]*exactly as written/);
    expect(promptSent()).toContain('Unit words are words like any other and are translated');
    expect(promptSent()).toContain('"2 cups" = "2 szklanki"');
    expect(promptSent()).toContain('never convert one measure into another');
  });

  it('asks for only the changed pieces, with the recipe and its current translation as context', async () => {
    const { translatePieces } = await load();
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
    const pieces = pendingPieces(edited);
    expect(pieces.map((p) => p.key)).toEqual(['name']);
    generateContent.mockResolvedValue(
      reply({ detectedLanguage: 'en', texts: [{ id: 'p1', text: "Grandma Zosia's Apple Pie" }] }),
    );

    const result = await translatePieces(edited, pieces, 'pl');

    // The recipe's settled language wins over the model's guess.
    expect(result.detectedLanguage).toBe('pl');
    expect([...result.values.values()]).toEqual(["Grandma Zosia's Apple Pie"]);
    const prompt = promptSent();
    expect(prompt).toContain('written in Polish. Translate the pieces into English');
    expect(prompt).toContain('for context');
    expect(prompt).toContain('Pokrój jabłka.');
    expect(prompt).toContain('Slice the apples.');
    expect(prompt).toContain('"id":"p1"');
    expect(prompt).not.toContain('"id":"p2"');
  });

  it('uses Gemini 3.8 Flash thinking lightly', async () => {
    const { translatePieces } = await load();
    generateContent.mockResolvedValue(
      reply({ detectedLanguage: 'en', texts: [{ id: 'p1', text: 'Pie' }] }),
    );

    await translatePieces(testRecipe, pendingPieces(testRecipe));
    const models = getGenerativeModel.mock.calls.map((call) => (call as unknown[])[1]);
    expect(models).toMatchObject([
      {
        model: 'gemini-3.8-flash',
        generationConfig: { thinkingConfig: { thinkingLevel: 'LOW' } },
      },
    ]);
  });

  it('never hands a busy Flash’s work to a lighter model (the recipe waits for Flash)', async () => {
    const { translatePieces } = await load();
    generateContent.mockRejectedValue(new Error('overloaded'));

    await expect(translatePieces(testRecipe, pendingPieces(testRecipe))).rejects.toThrow(
      'overloaded',
    );
    const models = getGenerativeModel.mock.calls.map((call) => (call as unknown[])[1]);
    expect(models).toMatchObject([{ model: 'gemini-3.8-flash' }]);
  });

  it.each([
    ['an unknown language', reply({ detectedLanguage: 'de', texts: [{ id: 'p1', text: 'X' }] })],
    ['nothing translated', reply({ detectedLanguage: 'pl', texts: [{ id: 'p9', text: 'X' }] })],
    ['not JSON', { response: { text: () => 'Sorry, I cannot help' } }],
  ])('rejects %s instead of storing it', async (_label, response) => {
    const { translatePieces } = await load();
    generateContent.mockResolvedValue(response);
    await expect(translatePieces(testRecipe, pendingPieces(testRecipe))).rejects.toMatchObject({
      // By name: the service is re-imported fresh, with its own copy of the class.
      name: 'TranslationRejectedError',
    });
  });
});
