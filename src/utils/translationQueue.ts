import { Recipe } from '../types/recipe';
import {
  TRANSLATION_GRACE_MS,
  otherLanguage,
  sourceLanguageOf,
  translationStatus,
} from './recipeTranslation';

/**
 * When translations are asked for. The family shares a small daily allowance of requests (20 on
 * Gemini's free tier), so each one counts:
 * - A new recipe is translated at once by the phone that added it; other phones give that phone
 *   a head start (TRANSLATION_GRACE_MS) before they step in.
 * - An edited recipe waits until it has had no saves for EDIT_SETTLE_MS, so a cook fixing things
 *   as they go costs one request, not one per save. Meanwhile readers see the unchanged pieces in
 *   their language (localizeRecipe).
 * - A translation missing some pieces (a reply that left them out) is finished at once by the
 *   phone that made it, and by others after the head start.
 * Whenever a request goes out, everything else waiting rides along in it, up to a size that
 * keeps the reply reliable.
 */

export const EDIT_SETTLE_MS = 30 * 60 * 1000;

// The most one request carries: the reply grows with it, and a long reply is slower and more
// likely to go wrong. A recipe larger than this still goes, alone.
export const MAX_BATCH_PIECES = 150;
export const MAX_BATCH_CHARS = 24_000;

/** What this phone knows about a recipe that the recipe itself doesn't say. */
export interface LocalTranslationState {
  /** Its current text was saved on this phone. */
  savedHere: boolean;
  /** Its current translation was made on this phone. */
  translatedHere: boolean;
}

/** When the recipe's translation is due on this phone. */
export function translationDueAt(recipe: Recipe, here: LocalTranslationState): number {
  const other = otherLanguage(sourceLanguageOf(recipe));
  const status = translationStatus(recipe, other);
  const changedAt = recipe.updatedAt ?? recipe.createdAt ?? 0;
  const headStart = (mine: boolean) => (mine ? 0 : TRANSLATION_GRACE_MS);
  if (status === 'missing') return changedAt + headStart(here.savedHere);
  if (status === 'stale') return changedAt + EDIT_SETTLE_MS + headStart(here.savedHere);
  const translatedAt = recipe.translations?.[other]?.translatedAt ?? 0;
  return here.translatedHere ? 0 : translatedAt + headStart(false);
}

/**
 * Whether the recipe may go early, with a request that's going anyway: anything but another
 * phone's new recipe, which that phone is translating.
 */
export function mayRideAlong(recipe: Recipe, here: LocalTranslationState): boolean {
  const status = translationStatus(recipe, otherLanguage(sourceLanguageOf(recipe)));
  return status !== 'missing' || here.savedHere;
}

export interface QueueItem<T> {
  item: T;
  dueAt: number;
  rideAlong: boolean;
  pieces: number;
  chars: number;
}

/**
 * The next request's contents: nothing until something is due; then everything due, soonest
 * first, and then whatever may ride along, while it fits.
 */
export function pickBatch<T>(queue: QueueItem<T>[], now: number): T[] {
  const byDue = [...queue].sort((a, b) => a.dueAt - b.dueAt);
  const due = byDue.filter((q) => q.dueAt <= now);
  if (due.length === 0) return [];
  const early = byDue.filter((q) => q.dueAt > now && q.rideAlong);
  const batch: T[] = [];
  let pieces = 0;
  let chars = 0;
  for (const q of [...due, ...early]) {
    const fits = pieces + q.pieces <= MAX_BATCH_PIECES && chars + q.chars <= MAX_BATCH_CHARS;
    if (batch.length > 0 && !fits) continue;
    batch.push(q.item);
    pieces += q.pieces;
    chars += q.chars;
  }
  return batch;
}

const PACIFIC = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hourCycle: 'h23',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Pacific time's hours, minutes and seconds at `at`. */
function pacificClock(at: number) {
  const parts = Object.fromEntries(
    PACIFIC.formatToParts(new Date(at)).map((p) => [p.type, Number(p.value)]),
  );
  return { hour: parts.hour % 24, minute: parts.minute, second: parts.second };
}

/**
 * When Gemini's daily allowance next resets: midnight Pacific time (a minute after, to be sure).
 * A day across a clock change is 23 or 25 hours long, which the result is corrected for.
 */
export function nextDailyReset(now: number): number {
  const { hour, minute, second } = pacificClock(now);
  const sinceMidnight = ((hour * 60 + minute) * 60 + second) * 1000 + (now % 1000);
  let reset = now - sinceMidnight + 24 * 60 * 60 * 1000;
  const off = pacificClock(reset).hour;
  if (off === 23) reset += 60 * 60 * 1000;
  else if (off === 1) reset -= 60 * 60 * 1000;
  return reset + 60 * 1000;
}
