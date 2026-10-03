import { Recipe, RecipeTimes, TimeValue } from '../types/recipe';
import { UiTranslations } from '../i18n/translations';
import { PathChoices } from './recipeMethod';
import { extractTimeFromText, recipeTime, typedMinutes, usableMinutes } from './timeEstimator';

/** The three times an author can type, in the order they're shown. */
export const TIME_KINDS = ['prep', 'cook', 'rest'] as const;
export type TimeKind = (typeof TIME_KINDS)[number];

/** What the author typed for each time, before it's read. */
export type TimeTexts = Record<TimeKind, string>;

/**
 * Minutes from a time as people type it, in English or Polish: "20 min", "45", "1 h 10", "1:10",
 * "1½ h", "pół godziny", "overnight", "2 dni". A range counts its middle. Null when it says no
 * time ("until golden").
 */
export function parseDuration(text: string): number | null {
  let typed = text.trim().toLowerCase();
  if (!typed) return null;
  // "1:10" is an hour and ten minutes.
  const clock = typed.match(/^(\d+):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  // A bare number is minutes.
  if (/^\d+(?:[.,]\d+)?$/.test(typed)) return Math.round(parseFloat(typed.replace(',', '.')));
  typed = typed
    .replace(/(\d+)\s*½/g, '$1.5')
    .replace(/½/g, '0.5')
    // The app's own Polish "1g 20m": in a time, g is godziny (in a step it would be grams).
    .replace(/(\d)\s*g(?![a-ząćęłńóśźż])/g, '$1 h')
    // "1 h 10", "1h10": the number after the hours is minutes.
    .replace(
      /(\d+(?:[.,]\d+)?)\s*(h|hrs?|hours?|godz\.?|godzin[a-zęy]*)\s*(\d{1,2})(?![\d\s]*[a-ząćęłńóśźż])/g,
      '$1 $2 $3 min',
    );
  const minutes = extractTimeFromText(typed);
  return minutes > 0 ? Math.round(minutes) : null;
}

/**
 * A typed time as the recipe shows it: a number of minutes in the app's own way ("1h 10m",
 * "2 dni"), but words and ranges as they were typed ("overnight", "20–30 min").
 */
export function shownTime(time: TimeValue, t: UiTranslations): string {
  const text = typeof time.text === 'string' ? time.text.trim() : '';
  const minutes = usableMinutes(time.minutes);
  return shownAsTyped(text, minutes) ? text : t.totalTime(minutes);
}

// Words ("overnight"), a range ("20–30 min") or no number at all are shown as typed.
const shownAsTyped = (text: string, minutes: number) =>
  !minutes || !/\d/.test(text) || /\d\s*(?:-|–|to|do)\s*\d/i.test(text);

/**
 * Whether a typed time is shown in its own words, so it's translated. A plain number of minutes
 * is shown the app's way in either language, so it never needs a translation.
 */
export function timeInWords(text: string): boolean {
  return shownAsTyped(text.trim(), parseDuration(text) ?? 0);
}

/** Whether any time was typed, checked as an untrusted record (its words must be words). */
export function hasTypedTimes(times: unknown): times is RecipeTimes {
  if (typeof times !== 'object' || times === null) return false;
  return TIME_KINDS.some((kind) => {
    const text = (times as Record<string, { text?: unknown } | undefined>)[kind]?.text;
    return typeof text === 'string' && text.trim() !== '';
  });
}

/** The times as stored: each typed one with its minutes, read once; undefined when none is. */
export function timesFromText(texts: TimeTexts): RecipeTimes | undefined {
  const times: RecipeTimes = {};
  for (const kind of TIME_KINDS) {
    const text = texts[kind].trim();
    if (text) times[kind] = { text, minutes: parseDuration(text) };
  }
  return Object.keys(times).length > 0 ? times : undefined;
}

/**
 * The whole recipe's time: prep and cook added up, then the rest after a plus ("1h 20m +
 * overnight"). `minutes` counts all three, for sorting. A time that says no number is left out.
 */
export function timesTotal(
  times: RecipeTimes,
  t: UiTranslations,
): { minutes: number; label: string } {
  const working = usableMinutes(times.prep?.minutes) + usableMinutes(times.cook?.minutes);
  const rest = usableMinutes(times.rest?.minutes) ? times.rest : undefined;
  const label = [working > 0 ? t.totalTime(working) : '', rest ? shownTime(rest, t) : '']
    .filter(Boolean)
    .join(' + ');
  return { minutes: working + usableMinutes(rest?.minutes), label };
}

/**
 * The recipe's time as cards, rows, the page and the PDF show it: the typed times' total ("1h 20m
 * + overnight"), the time the author set, or "~" an estimate; '' when there's nothing to go on.
 */
export function recipeTimeLabel(
  recipe: Partial<Recipe>,
  t: UiTranslations,
  choices: PathChoices = {},
): string {
  if (recipe.times && typedMinutes(recipe) !== null) return timesTotal(recipe.times, t).label;
  const time = recipeTime(recipe, choices);
  if (time.minutes <= 0) return '';
  return time.manual ? t.totalTime(time.minutes) : t.estimatedTime(time.minutes);
}
