import { Language } from '../types/recipe';
import { Make, MakeTranslation } from '../types/make';
import type { CurrentUser } from '../hooks/useCurrentUser';
import { memberName } from './ownership';
import { findMatch } from './vault';

/**
 * Makes: what family members made from the Recipe Box's recipes, each with a photo, shared on
 * the Makes page. A make points at its recipe by id; the recipe is never written to, so a
 * recipe's makes are counted from the makes themselves (like remixes).
 */

/** Document id for a new make: when it was made, readable in the console, plus a random part. */
export function newMakeId(): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `make-${Date.now()}-${random}`;
}

export const isMakeDeleted = (make: Pick<Make, 'deletedAt'>) => make.deletedAt !== undefined;

/** The make marked deleted at `deletedAt`, or restored when that's undefined. */
export function makeWithDeletedAt(make: Make, deletedAt: number | undefined): Make {
  const { deletedAt: _previous, ...rest } = make;
  return deletedAt === undefined ? rest : { ...rest, deletedAt };
}

/** The makes the Makes page shows: not deleted, the newest first. */
export function shownMakes(makes: readonly Make[]): Make[] {
  return makes.filter((m) => !isMakeDeleted(m)).sort((a, b) => b.createdAt - a.createdAt);
}

/** A recipe's makes, the newest first. */
export function makesOf(makes: readonly Make[], recipeId: string): Make[] {
  return shownMakes(makes).filter((m) => m.recipeId === recipeId);
}

/** How many makes each recipe has, by id (recipes without any are left out). */
export function makeCounts(makes: readonly Make[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const make of makes) {
    if (isMakeDeleted(make)) continue;
    counts.set(make.recipeId, (counts.get(make.recipeId) ?? 0) + 1);
  }
  return counts;
}

const sameEmail = (a?: string, b?: string) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** Whether this person added the make. */
export function isOwnMake(make: Pick<Make, 'ownerEmail'>, user: CurrentUser | null): boolean {
  return sameEmail(make.ownerEmail, user?.email);
}

/**
 * Whether this person may edit or delete the make: only its maker. Without cloud access control
 * (local dev) everything on the device is. firestore.rules is what actually enforces it.
 */
export function canEditMake(
  make: Pick<Make, 'ownerEmail'>,
  user: CurrentUser | null,
  accessControlled: boolean,
): boolean {
  return !accessControlled || isOwnMake(make, user);
}

/** The maker's name, as the family's names are shown everywhere (memberName). */
export function makerName(make: Pick<Make, 'ownerName' | 'ownerNameAsTyped'>): string {
  return make.ownerName ? memberName(make.ownerName, make.ownerNameAsTyped) : '';
}

/** A make as a list shows it: its title (or its recipe's name) in the viewer's language. */
export interface MakeEntry {
  make: Make;
  title: string;
  recipeName: string;
}

/**
 * The makes whose title, recipe or maker has the search text in it, ignoring case and accents
 * (as the Recipe Box's search does). Every one of them while there's no search.
 */
export function searchMakes<T extends MakeEntry>(entries: readonly T[], query: string): T[] {
  if (!query.trim()) return [...entries];
  return entries.filter(({ make, title, recipeName }) =>
    [title, recipeName, makerName(make)].some((text) => text && findMatch(text, query)),
  );
}

// --- Hearts --------------------------------------------------------------------------------

/** The key a person's heart is stored under: their email, in lowercase (as the rules check). */
export const heartKey = (email: string) => email.trim().toLowerCase();

export function heartCount(make: Pick<Make, 'hearts'>): number {
  return Object.values(make.hearts ?? {}).filter((v) => v === true).length;
}

export function hasHearted(make: Pick<Make, 'hearts'>, email: string | undefined): boolean {
  return Boolean(email && make.hearts?.[heartKey(email)] === true);
}

/** The make with this person's heart given (`on`) or taken back. */
export function withHeart(make: Make, email: string, on: boolean): Make {
  const hearts = { ...make.hearts };
  if (on) hearts[heartKey(email)] = true;
  else delete hearts[heartKey(email)];
  const { hearts: _old, ...rest } = make;
  return Object.keys(hearts).length > 0 ? { ...rest, hearts } : rest;
}

// --- The day it was made --------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** A day on this phone's calendar as YYYY-MM-DD. */
export function isoDay(at: number | Date = Date.now()): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A YYYY-MM-DD day as a local date, or null when it isn't one. */
export function parseIsoDay(day: string | undefined): Date | null {
  const m = day ? ISO_DAY.exec(day) : null;
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isoDay(date) === day ? date : null;
}

/**
 * The day a make was made, as its card shows it: "Today", "Yesterday", or the date ("30 Sept",
 * "30 wrz"), with the year when it isn't this one. Falls back to when it was added.
 */
export function madeOnLabel(
  make: Pick<Make, 'madeOn' | 'createdAt'>,
  language: Language,
  words: { today: string; yesterday: string },
  now = Date.now(),
): string {
  const date = parseIsoDay(make.madeOn) ?? new Date(make.createdAt);
  const day = isoDay(date);
  if (day === isoDay(now)) return words.today;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === isoDay(yesterday)) return words.yesterday;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

// --- Reading makes from the cloud (untrusted) -----------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

// The longest words a make keeps: anything longer was never typed in the form.
const MAX_TITLE = 200;
const MAX_NOTE = 4000;

function parseTranslation(raw: unknown): MakeTranslation | undefined {
  if (!isObject(raw)) return undefined;
  const strings = (v: unknown) =>
    isObject(v)
      ? Object.fromEntries(
          Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'),
        )
      : undefined;
  const tr: MakeTranslation = {};
  const title = text(raw.title)?.slice(0, MAX_TITLE);
  const note = text(raw.note)?.slice(0, MAX_NOTE);
  if (title !== undefined) tr.title = title;
  if (note !== undefined) tr.note = note;
  if (text(raw.sourceHash) !== undefined) tr.sourceHash = text(raw.sourceHash);
  const pieceSources = strings(raw.pieceSources);
  if (pieceSources) tr.pieceSources = pieceSources;
  if (num(raw.translatedAt) !== undefined) tr.translatedAt = num(raw.translatedAt);
  const untranslated = strings(raw.untranslated);
  if (untranslated) tr.untranslated = untranslated;
  return tr;
}

/**
 * A make as stored, if it has what the page needs (an id, its recipe, a photo or a device copy
 * waiting for one); otherwise null. Only the fields a make has are kept, each checked.
 */
export function parseMake(raw: unknown): Make | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id);
  const recipeId = text(raw.recipeId);
  const photo = text(raw.photo) ?? '';
  const photoOmitted = raw.photoOmitted === true;
  if (!id || !recipeId || (!photo && !photoOmitted)) return null;
  const createdAt = num(raw.createdAt) ?? 0;
  const make: Make = {
    id,
    recipeId,
    photo,
    createdAt,
    updatedAt: num(raw.updatedAt) ?? createdAt,
  };
  const title = text(raw.title)?.slice(0, MAX_TITLE);
  const note = text(raw.note)?.slice(0, MAX_NOTE);
  if (title) make.title = title;
  if (note) make.note = note;
  if (parseIsoDay(text(raw.madeOn))) make.madeOn = text(raw.madeOn);
  if (text(raw.ownerEmail)) make.ownerEmail = text(raw.ownerEmail);
  if (text(raw.ownerName)) make.ownerName = text(raw.ownerName);
  if (raw.ownerNameAsTyped === true) make.ownerNameAsTyped = true;
  if (isObject(raw.hearts)) {
    const hearts = Object.fromEntries(
      Object.entries(raw.hearts)
        .filter(([, v]) => v === true)
        .map(([k]) => [k, true as const]),
    );
    if (Object.keys(hearts).length > 0) make.hearts = hearts;
  }
  if (raw.sourceLanguage === 'en' || raw.sourceLanguage === 'pl') {
    make.sourceLanguage = raw.sourceLanguage;
  }
  if (isObject(raw.translations)) {
    const en = parseTranslation(raw.translations.en);
    const pl = parseTranslation(raw.translations.pl);
    if (en || pl) make.translations = { ...(en && { en }), ...(pl && { pl }) };
  }
  if (num(raw.deletedAt) !== undefined) make.deletedAt = num(raw.deletedAt);
  if (photoOmitted) make.photoOmitted = true;
  return make;
}

// --- This device's copy ---------------------------------------------------------------------

/** The make without its photo, marked so it's never saved from (see `photoOmitted`). */
export function leaveMakePhotoOut(make: Make): Make {
  return make.photo ? { ...make, photo: '', photoOmitted: true } : make;
}
