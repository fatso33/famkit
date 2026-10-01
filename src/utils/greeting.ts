import type { Season } from './season';

/**
 * My Counter's greeting: one line a launch, picked from what's true right now (the time of day,
 * the weekend, the season, new recipes in the box, a holiday) so it reads like someone noticed,
 * never the same line twice in a row. The words live in translations (`greetings`), each with a
 * `{name}` where the first name goes.
 */

export type HolidayId =
  'wigilia' | 'christmas' | 'newYear' | 'easter' | 'fatThursday' | 'thanksgiving';

export type GreetingId =
  | 'goodMorning'
  | 'coffeeFirst'
  | 'breakfast'
  | 'goodAfternoon'
  | 'whatsCooking'
  | 'somethingSweet'
  | 'goodEvening'
  | 'dinner'
  | 'tonight'
  | 'midnightSnack'
  | 'stillUp'
  | 'weekendBaking'
  | 'sundayDinner'
  | 'seasonSpring'
  | 'seasonSummer'
  | 'seasonAutumn'
  | 'seasonWinter'
  | 'newInBox'
  | 'welcomeBack'
  | HolidayId;

/** Every greeting, so translations and tests can check each has its words. */
export const GREETING_IDS: readonly GreetingId[] = [
  'goodMorning',
  'coffeeFirst',
  'breakfast',
  'goodAfternoon',
  'whatsCooking',
  'somethingSweet',
  'goodEvening',
  'dinner',
  'tonight',
  'midnightSnack',
  'stillUp',
  'weekendBaking',
  'sundayDinner',
  'seasonSpring',
  'seasonSummer',
  'seasonAutumn',
  'seasonWinter',
  'newInBox',
  'welcomeBack',
  'wigilia',
  'christmas',
  'newYear',
  'easter',
  'fatThursday',
  'thanksgiving',
];

/** Days away after which "Welcome back" is the greeting. */
export const AWAY_DAYS = 4;

/** Easter Sunday in the Gregorian calendar (the anonymous Gregorian computus). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const daysFrom = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** The holiday a day is, on the family's calendar (Polish and American), if any. */
export function holidayOn(date: Date): HolidayId | null {
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 11 && day === 24) return 'wigilia';
  if (month === 11 && (day === 25 || day === 26)) return 'christmas';
  if (month === 0 && day === 1) return 'newYear';
  const easter = easterSunday(date.getFullYear());
  // Easter Sunday and Monday (Śmigus-dyngus).
  if (sameDay(date, easter) || sameDay(date, daysFrom(easter, 1))) return 'easter';
  // The Thursday before Ash Wednesday, 46 days before Easter: pączki day.
  if (sameDay(date, daysFrom(easter, -52))) return 'fatThursday';
  // The fourth Thursday of November.
  if (month === 10 && date.getDay() === 4 && day >= 22 && day <= 28) return 'thanksgiving';
  return null;
}

/**
 * The first name to greet someone by: the first word of their name. An email (when that's all
 * there is) gives its first part, capitalised.
 */
export function firstName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.includes('@')) {
    const local = trimmed.split('@')[0].split(/[._+-]/)[0] ?? '';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return trimmed.split(/\s+/)[0] ?? '';
}

export interface GreetingContext {
  now: Date;
  season: Season;
  /** Recipes in the box this person hasn't opened yet. */
  unseenRecipes: number;
  /** Days since their last visit, or null on a first visit. */
  daysAway: number | null;
  /** The greeting shown last time, which isn't shown again straight away. */
  lastId?: GreetingId | null;
}

/** The greetings that fit the moment, before one is picked. */
export function greetingCandidates({
  now,
  season,
  unseenRecipes,
  daysAway,
}: GreetingContext): GreetingId[] {
  const holiday = holidayOn(now);
  // A holiday is the day's greeting, every launch.
  if (holiday) return [holiday];
  // Back after a while: that comes first.
  if (daysAway !== null && daysAway >= AWAY_DAYS) return ['welcomeBack'];

  const hour = now.getHours();
  const weekday = now.getDay();
  const weekend = weekday === 0 || weekday === 6;
  const ids: GreetingId[] = [];
  if (hour >= 5 && hour < 11) ids.push('goodMorning', 'coffeeFirst', 'breakfast');
  else if (hour >= 11 && hour < 17) {
    ids.push('whatsCooking');
    if (hour >= 12) ids.push('goodAfternoon');
    if (hour >= 14) ids.push('somethingSweet');
    if (weekday === 0) ids.push('sundayDinner');
  } else if (hour >= 17 && hour < 22) ids.push('goodEvening', 'dinner', 'tonight');
  else ids.push('midnightSnack', 'stillUp');

  // The season's own line, and weekend baking, by day only.
  if (hour >= 9 && hour < 21) {
    const seasonal: Record<Season, GreetingId> = {
      spring: 'seasonSpring',
      summer: 'seasonSummer',
      autumn: 'seasonAutumn',
      winter: 'seasonWinter',
    };
    ids.push(seasonal[season]);
    if (weekend) ids.push('weekendBaking');
  }
  if (unseenRecipes > 0) ids.push('newInBox');
  return ids;
}

/**
 * Picks this launch's greeting. New recipes waiting are worth saying more often than not, so
 * "Something new in the box" counts twice. The last greeting isn't repeated where there's another.
 * `random` is in [0, 1).
 */
export function pickGreeting(context: GreetingContext, random: number): GreetingId {
  const candidates = greetingCandidates(context);
  const weighted = candidates.flatMap((id) => (id === 'newInBox' ? [id, id] : [id]));
  const fresh = weighted.filter((id) => id !== context.lastId);
  const pool = fresh.length > 0 ? fresh : weighted;
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
}

/** A greeting's words split around the name, so the name can be set apart. */
export function splitGreeting(
  template: string,
  name: string,
): { before: string; name: string; after: string } {
  // Without a name, the greeting reads without one: "Good evening", "Still up?".
  if (!name) return { before: template.replace(/,?\s*\{name\}/, ''), name: '', after: '' };
  const at = template.indexOf('{name}');
  if (at < 0) return { before: template, name: '', after: '' };
  return { before: template.slice(0, at), name, after: template.slice(at + '{name}'.length) };
}
