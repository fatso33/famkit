import { Language, Recipe } from '../types/recipe';
import { Make } from '../types/make';
import { heartKey, isMakeDeleted, makerName, shownMakes } from './makes';
import { memberName } from './ownership';

/**
 * My Counter: the signed-in family member's home page. What its windows show is worked out here:
 * the box's latest recipes, the latest makes, and hearts given to this person's makes since they
 * last saw them.
 */

/** How many recipes and makes the counter's windows show. */
export const COUNTER_ITEMS = 3;

/** When a recipe last changed: edited, else added. */
export const changedAt = (r: Pick<Recipe, 'updatedAt' | 'createdAt'>) =>
  r.updatedAt ?? r.createdAt ?? 0;

/** The recipes added or edited most recently, the latest first. */
export function latestRecipes(recipes: readonly Recipe[], count = COUNTER_ITEMS): Recipe[] {
  return recipes
    .filter((r) => r.deletedAt === undefined)
    .sort((a, b) => changedAt(b) - changedAt(a))
    .slice(0, count);
}

/** Whether a recipe is new to the box or an edit of one already there. */
export const recipeChange = (r: Pick<Recipe, 'version'>): 'new' | 'updated' =>
  (r.version ?? 1) > 1 ? 'updated' : 'new';

/** The makes shared most recently, the latest first. */
export function latestMakes(makes: readonly Make[], count = COUNTER_ITEMS): Make[] {
  return shownMakes(makes).slice(0, count);
}

/**
 * The family's names by their lowercase email, as far as this device knows them: from who
 * added each make and each recipe. Hearts are kept by email, so this is how they get names.
 */
export function familyNames(
  recipes: readonly Recipe[],
  makes: readonly Make[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const recipe of recipes) {
    if (recipe.ownerEmail && recipe.ownerName) {
      names.set(heartKey(recipe.ownerEmail), memberName(recipe.ownerName, recipe.ownerNameAsTyped));
    }
  }
  // A make's name is newer than most recipes', so it wins.
  for (const make of makes) {
    const name = makerName(make);
    if (make.ownerEmail && name) names.set(heartKey(make.ownerEmail), name);
  }
  return names;
}

/** Hearts given to one of this person's makes that they haven't been told about. */
export interface HeartNews {
  make: Make;
  /** Whose hearts they are: names where known. */
  names: string[];
  /** How many new hearts, named or not. */
  count: number;
  /** Every heart the make has now, to remember as seen once this is shown. */
  hearts: string[];
}

/**
 * The news of new hearts on this person's makes, for the line under the greeting: the make with
 * the most hearts they haven't seen yet. `shown` is each make's hearts as last shown to them.
 */
export function heartNews(
  makes: readonly Make[],
  email: string,
  shown: Readonly<Record<string, readonly string[]>>,
  names: ReadonlyMap<string, string>,
): HeartNews | null {
  if (!email) return null;
  const me = heartKey(email);
  let best: HeartNews | null = null;
  for (const make of makes) {
    if (isMakeDeleted(make) || !make.ownerEmail || heartKey(make.ownerEmail) !== me) continue;
    const hearts = Object.keys(make.hearts ?? {}).filter((k) => make.hearts?.[k] === true);
    const seen = new Set(shown[make.id] ?? []);
    const fresh = hearts.filter((k) => k !== me && !seen.has(k));
    if (fresh.length === 0) continue;
    if (best && fresh.length <= best.count) continue;
    best = {
      make,
      names: fresh.map((k) => names.get(k)).filter((n): n is string => Boolean(n)),
      count: fresh.length,
      hearts,
    };
  }
  return best;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago something happened, in words ("2 hours ago", "yesterday", "3 dni temu"). The
 * platform's own formatter has each language's plural forms; a week or more is a date.
 */
export function timeAgo(at: number, now: number, language: Language): string {
  const locale = language === 'pl' ? 'pl' : 'en';
  const elapsed = Math.max(0, now - at);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (elapsed < MINUTE) return relative.format(0, 'second');
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
  // By the calendar from here, so last night at 11 is "yesterday" at breakfast.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const then = new Date(at);
  then.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - then.getTime()) / DAY);
  if (days === 0) return relative.format(-Math.floor(elapsed / HOUR), 'hour');
  if (days < 7) return relative.format(-days, 'day');
  return new Date(at).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(new Date(at).getFullYear() !== new Date(now).getFullYear() && { year: 'numeric' }),
  });
}

/** Whole days between two times, by the calendar. */
export function daysBetween(from: number, to: number): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY);
}
