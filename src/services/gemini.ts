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
1. "name": Recipe title translated to Polish.
2. "cardDescription": A warm, appetizing 1-2 sentence Polish summary of the recipe for the recipe card preview on the main vault page. Always provide this in Polish!
3. Translate culinary techniques naturally into Polish:
   - "sloppy dough" -> "luźne / rzadkie, klejące ciasto" (NOT "niechlujne ciasto")
   - "Dutch oven" -> "garnek żeliwny" (NOT "holenderski piec")
   - "lamination directive" -> "instrukcja składania ciasta"
4. Retain exact numerical values, measurements (e.g. 450g, 2 teaspoons / łyżeczki, 1.5 cups / szklanki or 375ml), and temperatures (450°F / 230°C).
5. For each ingredient:
   - "name": Polish name of the ingredient (e.g. "Mąka pszenna", "Jabłka", "Cukier", "Cynamon", "Drożdże suszone")
   - "prefix": leading name before quantity if formatted like "Mąka pszenna - " or "Jabłka - "
   - "text": the complete translated line in Polish
   - "qty": maintain exact original number or null if none
   - "unit": translated unit in Polish (e.g. "g", "łyżeczki", "szklanki", "sztuk")
   - "renderUnit": singular/few form (e.g. "łyżeczki", "szklanki")
   - "renderUnitPlural": genitive plural form (e.g. "łyżeczek", "szklanek")
   - "altQty": maintain exact altQty number or null
   - "altUnit": translated altUnit (e.g. "ml")
   - "suffix": translated suffix (e.g. " posiekanych", " (zważ to)")
6. Preserve the exact schema provided below. Return ONLY valid JSON matching this structure.

Recipe to translate:
${JSON.stringify(
  {
    name: recipe.name,
    cardDescription:
      recipe.cardDescription ||
      recipe.tips ||
      recipe.notes ||
      `A delicious homemade family recipe for ${recipe.name}.`,
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

  const schema = {
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
            name: { type: Type.STRING },
            prefix: { type: Type.STRING },
            text: { type: Type.STRING },
            qty: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            renderUnit: { type: Type.STRING },
            renderUnitPlural: { type: Type.STRING },
            altQty: { type: Type.NUMBER },
            altUnit: { type: Type.STRING },
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
    required: ['name', 'cardDescription', 'ingredients', 'steps'],
  };

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
  } catch (err) {
    console.warn('gemini-3.5-flash-lite failed, attempting gemini-3.8-flash fallback:', err);
    response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
  }

  const parsed = JSON.parse(response.text || '{}') as LocalizedRecipeContent;
  return parsed;
}
