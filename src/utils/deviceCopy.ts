import { Recipe, Step } from '../types/recipe';
import { Make } from '../types/make';
import { isEmbeddedPhoto } from './photoRefs';

/**
 * The recipe without the photos it holds itself, marked so it is never edited or saved (see
 * `photosOmitted`). Photos kept on their own (`photo:<id>`, utils/photoRefs) are only pointed at,
 * so they stay. A recipe without photos of its own comes back as it is.
 */
export function leavePhotosOut(recipe: Recipe): Recipe {
  const steps = recipe.steps ?? [];
  const hero = isEmbeddedPhoto(recipe.heroImage);
  const hasPhoto = (st: Step) =>
    isEmbeddedPhoto(st.imageSrc) || st.fork?.paths.some((path) => isEmbeddedPhoto(path.imageSrc));
  if (!hero && !steps.some(hasPhoto)) return recipe;
  const without = <T extends { imageSrc?: string }>(on: T): T => {
    if (!isEmbeddedPhoto(on.imageSrc)) return on;
    const { imageSrc: _photo, ...rest } = on;
    return rest as T;
  };
  return {
    ...recipe,
    heroImage: hero ? '' : recipe.heroImage,
    steps: steps.map((st) =>
      st.fork ? { ...without(st), fork: { paths: st.fork.paths.map(without) } } : without(st),
    ),
    photosOmitted: { hero },
  };
}

/** Whether this is a copy whose photos were left out: it must not be edited or saved. */
export function hasLeftOutPhotos(recipe: Pick<Recipe, 'photosOmitted'>): boolean {
  return Boolean(recipe.photosOmitted);
}

/** Whether the recipe's own photo is still on its way (so it shows no stand-in tile). */
export function photoPending(recipe: Pick<Recipe, 'photosOmitted'>): boolean {
  return Boolean(recipe.photosOmitted?.hero);
}

/**
 * The incoming recipes, except that a copy without photos never replaces the same version
 * already loaded with them (e.g. when the cloud fails and the app falls back to this device's
 * copy).
 */
export function keepLoadedPhotos(current: Recipe[], incoming: Recipe[]): Recipe[] {
  const loaded = new Map(current.filter((r) => !hasLeftOutPhotos(r)).map((r) => [r.id, r]));
  return incoming.map((r) => {
    const mine = hasLeftOutPhotos(r) ? loaded.get(r.id) : undefined;
    return mine && mine.updatedAt === r.updatedAt && mine.version === r.version ? mine : r;
  });
}

// --- Photos kept apart from the words (services/photoStore) -----------------------------------

/**
 * One recipe's or make's photos as this device keeps them: in IndexedDB, beside the copy of the
 * words in localStorage, so the app starts with them before the cloud answers.
 */
export interface PhotoEntry {
  /** `recipe:<id>` or `make:<id>`. */
  key: string;
  /** The saved state they belong to: they fill only a copy of that same state. */
  at: string;
  /** Tells changed photos apart cheaply: each photo's place, length and ending. */
  sig: string;
  /** Each photo by its place: `hero`, `s<step>`, `s<step>p<path>` (a recipe); `photo` (a make). */
  photos: Record<string, string>;
}

/** Every photo of one kind this device should keep, for the photo store to catch up with. */
export interface PhotoSet {
  kind: 'recipe' | 'make';
  /** The photos of each one that has any. */
  wanted: PhotoEntry[];
  /** Copies still waiting for their photos: whatever is kept for them stays. */
  waiting: string[];
}

export const recipePhotoKey = (id: string) => `recipe:${id}`;
export const makePhotoKey = (id: string) => `make:${id}`;

const recipeAt = (r: Recipe) => `${r.version ?? 1}@${r.updatedAt ?? r.createdAt ?? 0}`;
const makeAt = (m: Make) => String(m.updatedAt ?? m.createdAt);

function photoEntry(key: string, at: string, photos: Record<string, string>): PhotoEntry | null {
  const places = Object.keys(photos);
  if (places.length === 0) return null;
  const sig = places.map((p) => `${p}:${photos[p].length}:${photos[p].slice(-16)}`).join('|');
  return { key, at, sig, photos };
}

/**
 * The photos the recipe holds itself, to keep on this device. Null for a copy without them, or
 * none (photos kept on their own are kept by services/photos).
 */
export function recipePhotoEntry(recipe: Recipe): PhotoEntry | null {
  if (hasLeftOutPhotos(recipe)) return null;
  const photos: Record<string, string> = {};
  if (isEmbeddedPhoto(recipe.heroImage)) photos.hero = recipe.heroImage;
  (recipe.steps ?? []).forEach((st, i) => {
    if (isEmbeddedPhoto(st.imageSrc)) photos[`s${i}`] = st.imageSrc;
    st.fork?.paths.forEach((path, j) => {
      if (isEmbeddedPhoto(path.imageSrc)) photos[`s${i}p${j}`] = path.imageSrc;
    });
  });
  return photoEntry(recipePhotoKey(recipe.id), recipeAt(recipe), photos);
}

const STEP_PLACE = /^s(\d+)(?:p(\d+))?$/;

/**
 * The copy without its photos made whole again from those kept on this device, when they belong
 * to the same saved state and every one has its place. Otherwise it stays as it is, waiting for
 * the cloud: a copy is never half filled, since a filled one may be edited and saved.
 */
export function withRecipePhotos(recipe: Recipe, kept: PhotoEntry | undefined): Recipe {
  const mark = recipe.photosOmitted;
  if (!mark || !kept || kept.at !== recipeAt(recipe)) return recipe;
  if (mark.hero !== Boolean(kept.photos.hero)) return recipe;
  const steps = recipe.steps.map((st) =>
    st.fork ? { ...st, fork: { paths: st.fork.paths.map((path) => ({ ...path })) } } : { ...st },
  );
  for (const [place, src] of Object.entries(kept.photos)) {
    if (place === 'hero') continue;
    const match = STEP_PLACE.exec(place);
    const step = match ? steps[Number(match[1])] : undefined;
    if (!match || !step) return recipe;
    if (match[2] === undefined) {
      step.imageSrc = src;
    } else {
      const path = step.fork?.paths[Number(match[2])];
      if (!path) return recipe;
      path.imageSrc = src;
    }
  }
  const { photosOmitted: _mark, ...rest } = recipe;
  return { ...rest, heroImage: kept.photos.hero ?? recipe.heroImage, steps };
}

/** The make's photo, to keep on this device. Null for a copy without it. */
export function makePhotoEntry(make: Make): PhotoEntry | null {
  if (make.photoOmitted || !make.photo) return null;
  return photoEntry(makePhotoKey(make.id), makeAt(make), { photo: make.photo });
}

/** The make waiting for its photo, with the one kept on this device for the same saved state. */
export function withMakePhoto(make: Make, kept: PhotoEntry | undefined): Make {
  const photo = kept?.photos.photo;
  if (!make.photoOmitted || !photo || kept.at !== makeAt(make)) return make;
  const { photoOmitted: _mark, ...rest } = make;
  return { ...rest, photo };
}

export function recipePhotoSet(recipes: Recipe[]): PhotoSet {
  return {
    kind: 'recipe',
    wanted: recipes.map((r) => recipePhotoEntry(r)).filter((e) => e !== null),
    waiting: recipes.filter(hasLeftOutPhotos).map((r) => recipePhotoKey(r.id)),
  };
}

export function makePhotoSet(makes: Make[]): PhotoSet {
  return {
    kind: 'make',
    wanted: makes.map((m) => makePhotoEntry(m)).filter((e) => e !== null),
    waiting: makes.filter((m) => m.photoOmitted).map((m) => makePhotoKey(m.id)),
  };
}

/**
 * What the photo store must write to match `set`: new and changed photos, and removing those of
 * its kind nobody has any more (a recipe gone, or its photos removed).
 */
export function photoChanges(
  known: ReadonlyMap<string, PhotoEntry>,
  set: PhotoSet,
): { put: PhotoEntry[]; remove: string[] } {
  const put = set.wanted.filter((e) => {
    const old = known.get(e.key);
    return !old || old.at !== e.at || old.sig !== e.sig;
  });
  const stays = new Set([...set.wanted.map((e) => e.key), ...set.waiting]);
  const prefix = `${set.kind}:`;
  const remove = [...known.keys()].filter((key) => key.startsWith(prefix) && !stays.has(key));
  return { put, remove };
}
