import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translateRecipeToPolish } from '../services/gemini';
import { Recipe } from '../types/recipe';

// Mock storage
vi.mock('../services/storage', () => ({
  getStoredApiKey: vi.fn(),
}));

// Mock @google/genai
vi.mock('@google/genai', () => {
  return {
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      ARRAY: 'ARRAY',
    },
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            name: 'Szarlotka Babci',
            cardDescription: 'Klasyczna domowa szarlotka z jabłkami.',
            yieldHeader: 'Dla 8 porcji:',
            ingredients: [
              {
                name: 'Jabłka',
                text: 'Jabłka - 6 dużych',
                prefix: 'Jabłka - ',
                qty: 6,
                unit: 'dużych',
              },
            ],
            steps: [
              {
                num: 1,
                text: 'Pokrój jabłka i piecz.',
              },
            ],
          }),
        }),
      },
    })),
  };
});

describe('translateRecipeToPolish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testRecipe: Recipe = {
    id: 'test-recipe-1',
    name: "Grandma's Apple Pie",
    author: 'Grandma',
    category: 'family',
    heroImage: '',
    yieldHeader: 'Serves 8:',
    ingredients: [{ text: 'Apples - 6 large', qty: 6, unit: 'large' }],
    steps: [{ num: 1, text: 'Slice apples and bake.' }],
  };

  it('throws a helpful error if no API key is configured', async () => {
    const { getStoredApiKey } = await import('../services/storage');
    vi.mocked(getStoredApiKey).mockReturnValue('');

    await expect(translateRecipeToPolish(testRecipe)).rejects.toThrow(
      /No Gemini API Key found/
    );
  });

  it('calls Gemini API and parses Polish translation when API key is present', async () => {
    const { getStoredApiKey } = await import('../services/storage');
    vi.mocked(getStoredApiKey).mockReturnValue('AIzaSyDummyKeyForTesting');

    const result = await translateRecipeToPolish(testRecipe);
    expect(result.name).toBe('Szarlotka Babci');
    expect(result.cardDescription).toBe('Klasyczna domowa szarlotka z jabłkami.');
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients?.[0].name).toBe('Jabłka');
    expect(result.ingredients?.[0].text).toBe('Jabłka - 6 dużych');
  });
});
