import { Recipe } from '../types/recipe';
import { PathChoices, chosenPath, firstStepNumber, numberSteps, pathSteps } from './recipeMethod';

// Recipes are read in English and Polish, so every word list here has both. The same recipe
// should estimate the same time in either language, including in the editor, which shows the
// viewer's translation.

// No letter follows, Polish ones included (`\b` counts ą, ę, ł... as word breaks).
const NOT_LETTER = '(?![a-ząćęłńóśźż])';
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
// Polish counts and cases ("minutę, minuty, minut, po 30 minutach") next to the English units.
const UNIT = `(days?|dnia|dni|dob[aęy]|dób|hours?|hrs?|h|godzin(?:ach|ami|a|ę|y)?|godz|minutes?|mins?|minut(?:ach|ami|a|ę|y)?|m)${NOT_LETTER}`;
const RANGE_JOIN = '(?:-|–|to|do)';

// "1,5 godziny" is Polish for 1.5 hours.
const parseNumber = (text: string) => parseFloat(text.replace(',', '.'));
const unitMinutes = (value: number, unit: string) =>
  /^d/.test(unit) ? value * 24 * 60 : /^[hg]/.test(unit) ? value * 60 : value;

// Durations said in words. Each counts once per text.
const PHRASE_MINUTES: [RegExp, number][] = [
  [new RegExp(String.raw`overnight|(?:przez|na|całą)\s+noc${NOT_LETTER}`), 480],
  [/half an hour|half-hour|half hour|pół godziny/, 30],
  [/hour and a half|półtorej godziny/, 90],
  // "an hour", "co najmniej godzinę", "po godzinie", but not "1 godzinę" (counted below)
  [
    new RegExp(
      String.raw`(?<!half )an hour(?! and a half)|(?<![\d.,]\s*)godzin(?:a|ę|ie)${NOT_LETTER}`,
    ),
    60,
  ],
  [/couple of hours|couple hours|(?:parę|kilka) godzin/, 120],
];

export function extractTimeFromText(text: string): number {
  if (!text) return 0;
  let total = 0;
  const lower = text.toLowerCase();

  // Natural language duration phrases
  for (const [phrase, minutes] of PHRASE_MINUTES) if (phrase.test(lower)) total += minutes;

  // Range match: e.g. "25-30 minutes", "1 to 2 hours", "od 20 do 25 minut"
  const rangeRegex = new RegExp(String.raw`${NUMBER}\s*${RANGE_JOIN}\s*${NUMBER}\s*${UNIT}`, 'g');
  let rangeMatch;
  while ((rangeMatch = rangeRegex.exec(lower)) !== null) {
    const avg = (parseNumber(rangeMatch[1]) + parseNumber(rangeMatch[2])) / 2;
    total += unitMinutes(avg, rangeMatch[3]);
  }

  // Single time matches: e.g. "25 minutes", "2 hours", "1,5 godziny"
  const singleRegex = new RegExp(String.raw`${NUMBER}\s*${UNIT}`, 'g');
  const rangeStart = new RegExp(String.raw`\d+\s*${RANGE_JOIN}\s*$`);
  let singleMatch;
  while ((singleMatch = singleRegex.exec(lower)) !== null) {
    const idx = singleMatch.index;
    const preceding = lower.slice(Math.max(0, idx - 8), idx);
    // Ignore if part of an already-processed range like "10 to " or "10 - "
    if (rangeStart.test(preceding)) continue;
    total += unitMinutes(parseNumber(singleMatch[1]), singleMatch[2]);
  }

  return total;
}

// What a step without a stated time asks for, and its minutes. The first match wins, so the
// order matters. Polish words are stems, to catch the verb's forms ("wymieszaj, mieszaj").
const ACTIONS = [
  { minutes: 8, en: 'knead', pl: 'zagni wyrab wyrób' },
  {
    minutes: 3,
    en: 'chop dice slice mince grate crush',
    pl: 'siek kroj krój szatk zetrz ściera rozgni miażdż',
  },
  { minutes: 2, en: 'mix whisk stir beat blend', pl: 'miesz miks ubij trzep' },
  {
    minutes: 1.5,
    en: 'roll shape spread flatten fold',
    pl: 'wałk zwiń zwij formuj smaruj rozłóż rozprowadź rozciąg spłaszcz złóż zawiń',
  },
  {
    minutes: 1,
    en: 'drop place transfer line divide sprinkle cover',
    pl: 'wyłóż włóż połóż ułóż przełóż umieść dziel posyp oprósz kryj',
  },
  { minutes: 10, en: 'cool rest', pl: 'studź studz styg odpocz' },
  { minutes: 15, en: 'preheat', pl: 'rozgrz nagrz' },
].map(({ minutes, en, pl }) => ({ minutes, words: `${en} ${pl}`.split(' ') }));

export function estimateActionDuration(text: string): number {
  if (!text) return 2;
  const lower = text.toLowerCase();
  const action = ACTIONS.find(({ words }) => words.some((word) => lower.includes(word)));
  return action ? action.minutes : 2;
}

// A step's time: what it says, else a guess from what it asks for.
const stepMinutes = (text: string, extra: string[] = []) => {
  const explicit = [text, ...extra].reduce((sum, t) => sum + extractTimeFromText(t), 0);
  return explicit > 0 ? explicit : estimateActionDuration(text);
};

// "Repeat steps 3 to 8 two more times", "Powtórz kroki od 3 do 8 jeszcze dwa razy"
const REPEAT_PATTERNS = [
  /repeat\s+steps?\s+(\d+)\s*(?:to|-|–)\s*(\d+)\s*(one|two|three|\d+)?/,
  /powtórz\s+(?:od\s+)?(?:krok|punkt|etap)[a-ząćęłńóśźż]*\s+(?:od\s+)?(\d+)\s*(?:do|-|–)\s*(\d+)\s*(?:jeszcze\s+)?(raz|jeden|dwa|dwukrotnie|trzy|trzykrotnie|\d+)?/,
];
const REPEAT_TIMES: Record<string, number> = {
  two: 2,
  three: 3,
  dwa: 2,
  dwukrotnie: 2,
  trzy: 3,
  trzykrotnie: 3,
};

/** Extra time for "repeat steps 3 to 8 two more times", or null when the text says no such thing. */
function repeatMinutes(text: string, steps: { num: number; duration: number }[]): number | null {
  const lower = text.toLowerCase();
  const repeatMatch = REPEAT_PATTERNS.map((pattern) => lower.match(pattern)).find(Boolean);
  if (!repeatMatch) return null;
  const startStep = parseInt(repeatMatch[1], 10);
  const endStep = parseInt(repeatMatch[2], 10);
  const word = repeatMatch[3] || '';
  const times = REPEAT_TIMES[word] ?? (parseInt(word, 10) || 1);

  const repeated = steps.filter((s) => s.num >= startStep && s.num <= endStep);
  return repeated.reduce((sum, s) => sum + s.duration, 0) * times;
}

/**
 * Estimated total time in minutes, rounded to the nearest 5; 0 when there is nothing to go on
 * (no steps), which is shown as no time at all. Format it with `t.estimatedTime`.
 * A fork counts the path in `choices` (its first path by default).
 */
export function estimateRecipeMinutes(
  recipe: Partial<Recipe> | null | undefined,
  choices: PathChoices = {},
): number {
  if (!recipe) return 30;
  let totalMinutes = 0;

  // 1. Each numbered step, and the steps of the path each fork is on
  const steps = recipe.steps ?? [];
  const numbers = numberSteps(steps, firstStepNumber(steps), choices);
  const stepAnalysis: { num: number; duration: number }[] = [];
  const plainTexts: string[] = [];
  steps.forEach((step, index) => {
    const stepText = typeof step === 'string' ? step : step.text || '';
    const num = numbers[index];
    if (num === null) {
      plainTexts.push(stepText);
      return;
    }
    if (step.fork) {
      const path = chosenPath(step.fork, choices[index]);
      stepAnalysis.push({ num, duration: stepMinutes(step.fork.paths[path]?.text ?? stepText) });
      pathSteps(step.fork, path).forEach((text, k) => {
        stepAnalysis.push({ num: num + 1 + k, duration: stepMinutes(text) });
      });
      return;
    }
    stepAnalysis.push({ num, duration: stepMinutes(stepText, step.substeps) });
  });
  totalMinutes += stepAnalysis.reduce((sum, s) => sum + s.duration, 0);

  // 2. Unnumbered text only adds what it says: a repeat of earlier steps, or a stated time
  for (const text of plainTexts) {
    totalMinutes += repeatMinutes(text, stepAnalysis) ?? extractTimeFromText(text);
  }

  // Legacy: the lamination directive
  const directive = recipe.laminationDirective || '';
  if (directive) {
    totalMinutes +=
      repeatMinutes(directive, stepAnalysis) ??
      (extractTimeFromText(directive) || estimateActionDuration(directive));
  }

  // 3. Analyze baking options / cook directions
  if (recipe.bakingOptions) {
    let bakeTime = 0;
    const options: string[] = [];
    if (typeof recipe.bakingOptions.option1 === 'string') {
      options.push(recipe.bakingOptions.option1);
    } else if (Array.isArray(recipe.bakingOptions.option1)) {
      options.push(...recipe.bakingOptions.option1);
    }

    if (Array.isArray(recipe.bakingOptions.option2)) {
      options.push(...recipe.bakingOptions.option2);
    } else if (typeof recipe.bakingOptions.option2 === 'string') {
      options.push(recipe.bakingOptions.option2);
    }

    options.forEach((opt) => {
      const optLower = opt.toLowerCase();
      if (/bake|piecz|upiec/.test(optLower)) {
        bakeTime += extractTimeFromText(opt);
      } else if (!/fridge|lodów|preheat|rozgrz|nagrz/.test(optLower)) {
        bakeTime += extractTimeFromText(opt);
      }
    });

    totalMinutes += bakeTime;
  }

  // 4. Round to the nearest 5 minutes. Nothing to go on is no estimate (0), never a made-up
  //    one; a recipe with steps never rounds down to nothing.
  if (totalMinutes <= 0) return 0;
  return Math.max(5, Math.round(totalMinutes / 5) * 5);
}

/** The time the author set, when it's a usable number of minutes. */
export function manualMinutesOf(recipe: Partial<Recipe> | null | undefined): number | null {
  const minutes = recipe?.manualMinutes;
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
    ? Math.round(minutes)
    : null;
}

/**
 * The recipe's total time: the author's, or estimated from the steps (a fork counts the path in
 * `choices`). `manual` tells which, so an estimate can be shown as approximate.
 */
export function recipeTime(
  recipe: Partial<Recipe> | null | undefined,
  choices: PathChoices = {},
): { minutes: number; manual: boolean } {
  const manual = manualMinutesOf(recipe);
  return manual !== null
    ? { minutes: manual, manual: true }
    : { minutes: estimateRecipeMinutes(recipe, choices), manual: false };
}

export function capitalizeFirstLetter(text: string): string {
  if (!text) return '';
  return text.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_m, prefix, letter) => `${prefix}${letter.toUpperCase()}`,
  );
}
