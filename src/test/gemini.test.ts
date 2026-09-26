import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Recipe } from '../types/recipe';

const { generateContent, firebaseState } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  firebaseState: { configured: true },
}));

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
    getGenerativeModel: vi.fn(() => ({ generateContent })),
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

describe('translateRecipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseState.configured = true;
  });

  it('fails clearly when Firebase is not configured', async () => {
    firebaseState.configured = false;
    vi.resetModules();
    const { translateRecipe } = await import('../services/gemini');
    await expect(translateRecipe(testRecipe)).rejects.toThrow(/Firebase is not configured/);
  });

  it('detects the language, translates, and never sends photos', async () => {
    vi.resetModules();
    const { translateRecipe } = await import('../services/gemini');
    generateContent.mockResolvedValue(
      reply({
        detectedLanguage: 'pl',
        name: "Grandma's Apple Pie",
        ingredients: [{ text: 'Apples - 6 large' }],
        steps: [{ num: 1, text: 'Slice the apples.' }],
      }),
    );

    const result = await translateRecipe(testRecipe);

    expect(result.detectedLanguage).toBe('pl');
    expect(result.content.name).toBe("Grandma's Apple Pie");
    const prompt = generateContent.mock.calls[0][0] as string;
    expect(prompt).toContain('Szarlotka Babci');
    expect(prompt).not.toContain('data:image');
  });

  it('falls back to the second model when the first fails', async () => {
    vi.resetModules();
    const { translateRecipe } = await import('../services/gemini');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    generateContent
      .mockRejectedValueOnce(new Error('overloaded'))
      .mockResolvedValueOnce(reply({ detectedLanguage: 'en', name: 'Szarlotka' }));

    await expect(translateRecipe(testRecipe)).resolves.toMatchObject({ detectedLanguage: 'en' });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('rejects a malformed response instead of storing it', async () => {
    vi.resetModules();
    const { translateRecipe } = await import('../services/gemini');
    generateContent.mockResolvedValue(reply({ detectedLanguage: 'de', name: 'Apfelkuchen' }));

    await expect(translateRecipe(testRecipe)).rejects.toThrow(/detectedLanguage/);
  });
});
