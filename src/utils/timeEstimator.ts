import { Recipe } from '../types/recipe';

export function extractTimeFromText(text: string): number {
  if (!text) return 0;
  let total = 0;
  const lower = text.toLowerCase();

  // Natural language duration phrases
  if (lower.includes('overnight')) total += 480;
  if (
    lower.includes('half an hour') ||
    lower.includes('half-hour') ||
    lower.includes('half hour')
  )
    total += 30;
  if (lower.includes('an hour') && !lower.includes('half an hour')) total += 60;
  if (lower.includes('couple of hours') || lower.includes('couple hours'))
    total += 120;

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
  const singleRegex =
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|m\b)/gi;
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

export function calculateRecipeTime(recipe: Partial<Recipe> | null | undefined): string {
  if (!recipe) return '~30 mins';
  let totalMinutes = 0;

  // 1. Analyze each step
  const stepAnalysis: { num: number; duration: number; text: string }[] = [];
  if (recipe.steps && recipe.steps.length > 0) {
    recipe.steps.forEach((step, index) => {
      const stepText = typeof step === 'string' ? step : step.text || '';
      const explicitTime = extractTimeFromText(stepText);
      const actionTime = estimateActionDuration(stepText);
      const duration = explicitTime > 0 ? explicitTime : actionTime;
      const stepNum =
        typeof step === 'object' && step.num !== undefined ? step.num : index;
      stepAnalysis.push({ num: stepNum, duration, text: stepText });
      totalMinutes += duration;
    });
  }

  // 2. Analyze lamination directive or repetitive steps
  const directive = recipe.laminationDirective || '';
  if (directive) {
    const lowerDir = directive.toLowerCase();
    const repeatMatch = lowerDir.match(
      /repeat\s+steps?\s+(\d+)\s*(?:to|-)\s*(\d+)\s*(one|two|three|\d+)?/i
    );
    if (repeatMatch) {
      const startStep = parseInt(repeatMatch[1], 10);
      const endStep = parseInt(repeatMatch[2], 10);
      let times = 1;
      const word = (repeatMatch[3] || '').toLowerCase();
      if (word === 'two' || word === '2') times = 2;
      else if (word === 'three' || word === '3') times = 3;
      else if (parseInt(word, 10)) times = parseInt(word, 10);

      const repeatedSteps = stepAnalysis.filter(
        (s) => s.num >= startStep && s.num <= endStep
      );
      const cycleTime = repeatedSteps.reduce((sum, s) => sum + s.duration, 0);
      totalMinutes += cycleTime * times;
    } else {
      const dirExplicit = extractTimeFromText(directive);
      totalMinutes +=
        dirExplicit > 0 ? dirExplicit : estimateActionDuration(directive);
    }
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
      } else if (
        !optLower.includes('fridge') &&
        !optLower.includes('preheat')
      ) {
        bakeTime += extractTimeFromText(opt);
      }
    });

    totalMinutes += bakeTime;
  }

  // 4. Format to human-readable string rounded to nearest 5 minutes
  if (totalMinutes <= 0) totalMinutes = 25;
  const rounded = Math.round(totalMinutes / 5) * 5;

  if (rounded < 60) {
    return `~${rounded} mins`;
  }

  const hours = Math.floor(rounded / 60);
  const remMinutes = rounded % 60;

  if (remMinutes === 0) {
    return `~${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  }
  return `~${hours} ${hours === 1 ? 'hr' : 'hrs'} ${remMinutes} mins`;
}

export function capitalizeFirstLetter(text: string): string {
  if (!text) return '';
  return text.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_m, prefix, letter) => `${prefix}${letter.toUpperCase()}`
  );
}
