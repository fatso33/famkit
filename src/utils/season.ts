import type { Theme } from '../types/recipe';

/**
 * The app's colours follow the seasons. Each season is a full palette in index.css
 * (`[data-season]`), built so every text colour keeps the same contrast all year.
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** What a phone chose in Settings: follow the calendar, or keep one season all year. */
export type SeasonPreference = 'auto' | Season;

/** In calendar order, starting from spring. */
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function isSeasonPreference(value: unknown): value is SeasonPreference {
  return value === 'auto' || SEASONS.includes(value as Season);
}

/**
 * The meteorological season on a date's local calendar: spring from 1 March, summer from
 * 1 June, autumn from 1 September, winter from 1 December. Mirrored in index.html's
 * pre-paint script, so keep the two in step.
 */
export function seasonOn(date: Date): Season {
  const month = date.getMonth(); // 0 = January
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export function resolveSeason(preference: SeasonPreference, date: Date): Season {
  return preference === 'auto' ? seasonOn(date) : preference;
}

/**
 * Each season's page background (`--bg-main`), used for the browser's `theme-color` so the
 * phone's status bar blends into the page. index.html's pre-paint script and the build's
 * manifest use the same values; seasonPalette.test.ts keeps all of them in step with index.css.
 */
export const PAGE_BACKGROUND: Record<Season, Record<Theme, string>> = {
  spring: { light: '#faf9f6', dark: '#121412' },
  summer: { light: '#f7fafa', dark: '#101416' },
  autumn: { light: '#fbf9f5', dark: '#161311' },
  winter: { light: '#f8f9fb', dark: '#121417' },
};
