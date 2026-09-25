import { Ingredient, Language, ParsedIngredientRow } from '../types/recipe';

/**
 * Formats a decimal number into an authentic culinary fraction.
 * e.g., 0.5 -> "½", 1.5 -> "1 ½", 0.75 -> "¾", 2 -> "2"
 */
export function formatFraction(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '';

  const intPart = Math.floor(num);
  const decPart = Number((num - intPart).toFixed(3));

  let fracStr = '';
  if (Math.abs(decPart - 0.5) < 0.04) {
    fracStr = '½';
  } else if (Math.abs(decPart - 0.25) < 0.04) {
    fracStr = '¼';
  } else if (Math.abs(decPart - 0.75) < 0.04) {
    fracStr = '¾';
  } else if (Math.abs(decPart - 0.333) < 0.04) {
    fracStr = '⅓';
  } else if (Math.abs(decPart - 0.667) < 0.04) {
    fracStr = '⅔';
  } else if (Math.abs(decPart - 0.125) < 0.04) {
    fracStr = '⅛';
  } else if (Math.abs(decPart - 0.375) < 0.04) {
    fracStr = '⅜';
  } else if (Math.abs(decPart - 0.625) < 0.04) {
    fracStr = '⅝';
  } else if (Math.abs(decPart - 0.875) < 0.04) {
    fracStr = '⅞';
  } else if (decPart > 0.05) {
    fracStr = decPart.toString().replace(/^0/, '');
  }

  if (intPart > 0 && fracStr) {
    return `${intPart} ${fracStr}`;
  } else if (fracStr) {
    return fracStr;
  } else {
    return intPart.toString();
  }
}

/**
 * Parses an ingredient row, extracting the display name, bracketed notes,
 * and scaled amount with proper units and pluralization.
 */
export function parseIngredientRow(
  ing: Ingredient,
  scaleRatio: number = 1,
  lang: Language = 'en'
): ParsedIngredientRow {
  const rawText = ing.text || '';
  const bracketNotes: string[] = [];

  const extractBrackets = (str: string): string => {
    if (!str) return '';
    return str.replace(/\(([^)]+)\)|\[([^\]]+)\]/g, (_match, p1, p2) => {
      const inner = (p1 || p2 || '').trim();
      if (inner && !bracketNotes.includes(inner)) {
        bracketNotes.push(inner);
      }
      return '';
    });
  };

  let name = '';
  let amount = '';

  if (ing.qty !== undefined && ing.qty !== null && !isNaN(Number(ing.qty))) {
    let cleanPrefix = extractBrackets(ing.prefix || '');
    cleanPrefix = cleanPrefix.replace(/[-–—:]\s*$/, '').trim();

    const cleanSuffix = extractBrackets(ing.suffix || '');

    name = cleanPrefix || ing.name || 'Ingredient';

    const currentQty = Number(ing.qty) * scaleRatio;
    const formattedQty = formatFraction(currentQty);

    let unitText = ing.unit || '';
    if (lang === 'pl') {
      if (currentQty > 1 && ing.renderUnitPlural) {
        unitText = ing.renderUnitPlural;
      } else if (ing.renderUnit) {
        unitText = ing.renderUnit;
      }
    } else {
      if (ing.renderUnit) {
        unitText = currentQty <= 1 ? ing.unit || '' : ing.renderUnit;
      } else if (ing.unit && ing.unit.endsWith('s') && currentQty <= 1) {
        unitText = ing.unit.slice(0, -1);
      } else if (
        ing.unit &&
        !ing.unit.endsWith('s') &&
        currentQty > 1 &&
        !['g', 'ml', 'kg', 'oz', 'lb'].includes(ing.unit)
      ) {
        unitText = ing.unit + 's';
      }
    }

    let altString = '';
    if (ing.altQty) {
      const currentAlt = Math.round(Number(ing.altQty) * scaleRatio);
      altString =
        lang === 'pl'
          ? ` lub ${currentAlt}${ing.altUnit || 'ml'}`
          : ` or ${currentAlt}${ing.altUnit || 'ml'}`;
    }

    const separator =
      unitText && !['g', 'ml', 'kg', 'oz', 'lb'].includes(unitText) ? ' ' : '';
    amount = `${formattedQty}${separator}${unitText}${altString}${cleanSuffix}`.trim();
  } else {
    const cleanText = extractBrackets(rawText);
    if (cleanText.includes(' - ')) {
      const parts = cleanText.split(' - ');
      name = parts[0].trim();
      amount = parts.slice(1).join(' - ').trim();
    } else if (cleanText.includes('-') && !cleanText.match(/^[0-9]/)) {
      const parts = cleanText.split('-');
      name = parts[0].trim();
      amount = parts.slice(1).join('-').trim();
    } else {
      const match = cleanText.match(
        /^([\d\s\/\.\u00BC-\u00BE\u2150-\u215E]+(?:\s*(?:cups?|tsp|teaspoons?|tbsp|tablespoons?|g|ml|kg|oz|lbs?|cloves?|slices?|pinch|handful))?)\s+(.*)$/i
      );
      if (match) {
        amount = match[1].trim();
        name = match[2].trim();
      } else {
        name = cleanText.trim();
        amount = '';
      }
    }
  }

  name = extractBrackets(name).replace(/[-–—:]\s*$/, '').trim();
  amount = extractBrackets(amount).trim();

  return {
    name,
    notes: bracketNotes,
    amount,
    originalText: rawText,
  };
}
