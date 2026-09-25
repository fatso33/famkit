import { Recipe, LocalizedRecipeContent } from '../types/recipe';
import { getStoredApiKey } from './storage';

export async function translateRecipeToPolish(
  recipe: Recipe
): Promise<LocalizedRecipeContent> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error(
      'No Gemini API Key found. Add your restricted key in Settings or .env.local to enable custom recipe translation.'
    );
  }

  // Dynamic import keeps initial app bundle tiny and fast
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert bilingual culinary chef and Polish baking translator.
Translate the following recipe from English to authentic, idiomatic Polish.

Crucial Culinary Guidelines:
1. Translate culinary techniques naturally into Polish:
   - "sloppy dough" -> "luźne / rzadkie, klejące ciasto" (NOT "niechlujne ciasto")
   - "Dutch oven" -> "garnek żeliwny" (NOT "holenderski piec")
   - "lamination directive" -> "instrukcja składania ciasta"
2. Retain exact numerical values, measurements (e.g. 450g, 2 teaspoons / łyżeczki, 1.5 cups / szklanki or 375ml), and temperatures (450°F / 230°C).
3. For each ingredient:
   - "text": the complete translated line in Polish
   - "prefix": any leading text before the quantity, translated
   - "qty": maintain exact original number or null if none
   - "unit": translated unit in Polish (e.g. "g", "łyżeczki", "szklanki", "szklanka")
   - "renderUnit": singular/few form (e.g. "łyżeczki", "szklanki")
   - "renderUnitPlural": genitive plural form (e.g. "łyżeczek", "szklanek")
   - "altQty": maintain exact altQty number or null
   - "altUnit": translated altUnit (e.g. "ml")
   - "suffix": translated suffix (e.g. " posiekanych", " (zważ to)")
4. Preserve the exact schema provided below. Return ONLY valid JSON matching this structure.

Recipe to translate:
${JSON.stringify(
  {
    name: recipe.name,
    cardDescription: recipe.cardDescription,
    yieldHeader: recipe.yieldHeader,
    tips: recipe.tips,
    notes: recipe.notes,
    laminationDirective: recipe.laminationDirective,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    bakingOptions: recipe.bakingOptions,
  },
  null,
  2
)}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          cardDescription: { type: Type.STRING },
          yieldHeader: { type: Type.STRING },
          tips: { type: Type.STRING },
          notes: { type: Type.STRING },
          laminationDirective: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                qty: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                renderUnit: { type: Type.STRING },
                renderUnitPlural: { type: Type.STRING },
                altQty: { type: Type.NUMBER },
                altUnit: { type: Type.STRING },
                prefix: { type: Type.STRING },
                suffix: { type: Type.STRING },
              },
              required: ['text'],
            },
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                num: { type: Type.NUMBER },
                text: { type: Type.STRING },
              },
              required: ['num', 'text'],
            },
          },
          bakingOptions: {
            type: Type.OBJECT,
            properties: {
              option1: { type: Type.STRING },
              option2: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
        required: ['name', 'ingredients', 'steps'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}') as LocalizedRecipeContent;
  return parsed;
}
