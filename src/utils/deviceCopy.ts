import { Recipe } from '../types/recipe';

/**
 * How big this device's quick-start copy of the vault may get, in characters. Browsers let a
 * site keep about 5M; half leaves room for everything else, and keeps the copy quick to read at
 * launch and to write on every change. Photos are nearly all of it.
 */
export const DEVICE_COPY_BUDGET = 2_500_000;

/**
 * The recipe without its photos, marked so it is never edited or saved (see `photosOmitted`).
 * A recipe without photos comes back as it is.
 */
export function leavePhotosOut(recipe: Recipe): Recipe {
  const steps = recipe.steps ?? [];
  const hero = Boolean(recipe.heroImage);
  if (!hero && !steps.some((st) => st.imageSrc)) return recipe;
  return {
    ...recipe,
    heroImage: '',
    steps: steps.map(({ imageSrc: _photo, ...st }) => st),
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
 * The vault as JSON, within `budget` characters where it can be: the recipes `firstShown` lists
 * (ids, in the order the vault shows them) keep their photos while there's room, and the rest
 * lose theirs, those the vault doesn't show (deleted ones) first. Every recipe is kept, in its
 * place.
 */
export function deviceCopyJson(recipes: Recipe[], firstShown: string[], budget: number): string {
  const whole = recipes.map((r) => JSON.stringify(r));
  const total = whole.reduce((sum, json) => sum + json.length + 1, 1);
  if (total <= budget) return `[${whole.join(',')}]`;

  const slim = recipes.map((r, i) => {
    const copy = leavePhotosOut(r);
    return copy === r ? whole[i] : JSON.stringify(copy);
  });
  const rank = new Map(firstShown.map((id, i) => [id, i]));
  const byRank = recipes
    .map((_, i) => i)
    .sort(
      (a, b) =>
        (rank.get(recipes[a].id) ?? Infinity) - (rank.get(recipes[b].id) ?? Infinity) || a - b,
    );

  const parts = [...slim];
  let size = parts.reduce((sum, json) => sum + json.length + 1, 1);
  for (const i of byRank) {
    const extra = whole[i].length - slim[i].length;
    if (extra > 0 && size + extra <= budget) {
      parts[i] = whole[i];
      size += extra;
    }
  }
  return `[${parts.join(',')}]`;
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
