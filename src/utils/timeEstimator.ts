import { Recipe } from '../types/recipe';
import { PathChoices, chosenPath, firstStepNumber, numberSteps, pathSteps } from './recipeMethod';

export function extractTimeFromText(text: string): number {
  if (!text) return 0;
  let total = 0;
  const lower = text.toLowerCase();

  // Natural language duration phrases
  if (lower.includes('overnight')) total += 480;
  if (lower.includes('half an hour') || lower.includes('half-hour') || lower.includes('half hour'))
    total += 30;
  if (lower.includes('an hour') && !lower.includes('half an hour')) total += 60;
  if (lower.includes('couple of hours') || lower.includes('couple hours')) total += 120;

  // Range match: e.g. "25-30 minutes", "1 to 2 hours", "10-15 mins"
  const rangeRegex =
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|m\b)/gi;
  let rangeMatch;
  while ((rangeMatch = rangeRegex.exec(lower)) !== null) {
    const v1 = parseFloat(rangeMatch[1]);
    const v2 = parseFloat(rangeMatch[2]);
    const avg = (v1 + v2) / 2;
    const unit = rangeMatch[3].toLowerCase();
    if (unit.startsWith('h')) {
      total += avg * 60;
    } else {
      total += avg;
    }
  }

  // Single time matches: e.g. "25 minutes", "10 minutes", "2 hours"
  const singleRegex = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|m\b)/gi;
  let singleMatch;
  while ((singleMatch = singleRegex.exec(lower)) !== null) {
    const idx = singleMatch.index;
    const preceding = lower.slice(Math.max(0, idx - 8), idx);
    // Ignore if part of an already-processed range like "10 to " or "10 - "
    if (/\d+\s*(?:-|to)\s*$/i.test(preceding)) continue;

    const val = parseFloat(singleMatch[1]);
    const unit = singleMatch[2].toLowerCase();
    if (unit.startsWith('h')) {
      total += val * 60;
    } else {
      total += val;
    }
  }

  return total;
}

export function estimateActionDuration(text: string): number {
  if (!text) return 2;
  const lower = text.toLowerCase();
  if (lower.includes('knead')) return 8;
  if (
    lower.includes('chop') ||
    lower.includes('dice') ||
    lower.includes('slice') ||
    lower.includes('mince') ||
    lower.includes('grate') ||
    lower.includes('crush')
  )
    return 3;
  if (
    lower.includes('mix') ||
    lower.includes('whisk') ||
    lower.includes('stir') ||
    lower.includes('beat') ||
    lower.includes('blend')
  )
    return 2;
  if (
    lower.includes('roll') ||
    lower.includes('shape') ||
    lower.includes('spread') ||
    lower.includes('flatten') ||
    lower.includes('fold')
  )
    return 1.5;
  if (
    lower.includes('drop') ||
    lower.includes('place') ||
    lower.includes('transfer') ||
    lower.includes('line') ||
    lower.includes('divide') ||
    lower.includes('sprinkle') ||
    lower.includes('cover')
  )
    return 1;
  if (lower.includes('cool') || lower.includes('rest')) return 10;
  if (lower.includes('preheat')) return 15;
  return 2;
}

// A step's time: what it says, else a guess from what it asks for.
const stepMinutes = (text: string, extra: string[] = []) => {
  const explicit = [text, ...extra].reduce((sum, t) => sum + extractTimeFromText(t), 0);
  return explicit > 0 ? explicit : estimateActionDuration(text);
};

/** Extra time for "repeat steps 3 to 8 two more times", or null when the text says no such thing. */
function repeatMinutes(text: string, steps: { num: number; duration: number }[]): number | null {
  const repeatMatch = text
    .toLowerCase()
    .match(/repeat\s+steps?\s+(\d+)\s*(?:to|-)\s*(\d+)\s*(one|two|three|\d+)?/i);
  if (!repeatMatch) return null;
  const startStep = parseInt(repeatMatch[1], 10);
  const endStep = parseInt(repeatMatch[2], 10);
  let times = 1;
  const word = (repeatMatch[3] || '').toLowerCase();
  if (word === 'two' || word === '2') times = 2;
  else if (word === 'three' || word === '3') times = 3;
  else if (parseInt(word, 10)) times = parseInt(word, 10);

  const repeated = steps.filter((s) => s.num >= startStep && s.num <= endStep);
  return repeated.reduce((sum, s) => sum + s.duration, 0) * times;
}

/**
 * Estimated total time in minutes, rounded to the nearest 5. Format it with `t.estimatedTime`.
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
      if (optLower.includes('bake for') || optLower.includes('bake')) {
        bakeTime += extractTimeFromText(opt);
      } else if (!optLower.includes('fridge') && !optLower.includes('preheat')) {
        bakeTime += extractTimeFromText(opt);
      }
    });

    totalMinutes += bakeTime;
  }

  // 4. Round to the nearest 5 minutes
  if (totalMinutes <= 0) totalMinutes = 25;
  return Math.round(totalMinutes / 5) * 5;
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
