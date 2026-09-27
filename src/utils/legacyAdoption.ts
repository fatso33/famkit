// One-time migration from before recipes had owners. Wanda's Cheese Bread used to be bundled
// with the app; it becomes an ordinary recipe Peter added, and he also adopts any other recipe
// saved without an owner. Remove this (and the matching rule in firestore.rules) once it has run.
import { Recipe, Step } from '../types/recipe';
import type { CurrentUser } from '../hooks/useCurrentUser';
import { WANDAS_CHEESE_BREAD_SEED } from '../data/wandasCheeseBread';
import { sourceHash } from './recipeTranslation';

export const LEGACY_OWNER_EMAIL = 'p.gzowski33@gmail.com';
export const WANDA_ID = WANDAS_CHEESE_BREAD_SEED.id;

type OwnerFields = Required<Pick<Recipe, 'ownerEmail' | 'ownerName' | 'authorMode'>>;

export interface AdoptionPlan {
  /** Wanda's full record, to write in place of whatever is stored (or create). */
  wanda: Recipe | null;
  /** Owner fields for other recipes nobody owns yet. */
  claims: { id: string; owner: OwnerFields }[];
}

export function isLegacyOwner(user: CurrentUser | null): user is CurrentUser {
  return user?.email.trim().toLowerCase() === LEGACY_OWNER_EMAIL;
}

/** Whether a vault still shows signs of the old model: no owned Wanda, or an ownerless recipe. */
export function hasLegacyRecipes(recipes: Recipe[]): boolean {
  const wanda = recipes.find((r) => r.id === WANDA_ID);
  return !wanda?.ownerEmail || recipes.some((r) => !r.ownerEmail);
}

/**
 * Wanda's record from before adoption: its Polish is hand-written but not yet stamped as current,
 * so no phone may machine-translate over it in the meantime.
 */
export function awaitsAdoption(recipe: Recipe): boolean {
  return recipe.id === WANDA_ID && !recipe.ownerEmail;
}

/** Works out the adoption from the server's current recipes. Empty when nothing is left to do. */
export function planAdoption(cloud: Recipe[], owner: CurrentUser, now: number): AdoptionPlan {
  const existing = cloud.find((r) => r.id === WANDA_ID);
  const others = cloud.filter((r) => r.id !== WANDA_ID);

  let wanda: Recipe | null = null;
  if (!existing?.ownerEmail) {
    // The first recipe in the vault: dated just before the earliest one anyone added.
    const earliest = Math.min(now, ...others.map((r) => r.createdAt ?? now));
    const createdAt = existing?.createdAt ?? earliest - 60_000;
    const { translations, ...seed } = WANDAS_CHEESE_BREAD_SEED;
    const record: Recipe = {
      ...seed,
      author: 'Wanda G.',
      authorMode: 'custom',
      ownerEmail: owner.email,
      ownerName: owner.name,
      sourceLanguage: 'en',
      createdAt,
      updatedAt: existing?.updatedAt ?? createdAt,
      version: existing?.version ?? 1,
      history: existing?.history ?? [],
    };
    const pl = translations?.pl;
    wanda = pl
      ? {
          ...record,
          // Hand-written, so stamped as current: it must never be replaced by a machine translation.
          translations: {
            pl: { ...pl, steps: pl.steps?.map(textOnly), sourceHash: sourceHash(record) },
          },
        }
      : record;
  }

  const claims = others
    .filter((r) => !r.ownerEmail)
    .map((r) => ({
      id: r.id,
      owner: {
        ownerEmail: owner.email,
        ownerName: owner.name,
        authorMode: r.author.trim() === owner.name.trim() ? 'auto' : 'custom',
      } satisfies OwnerFields,
    }));

  return { wanda, claims };
}

// Photos always come from the original recipe; a translation carries only the words.
function textOnly(step: Step): Step {
  return { num: step.num, text: step.text, notes: step.notes, imageCaption: step.imageCaption };
}

const isBundledPhoto = (src?: string) => Boolean(src?.startsWith('./assets/'));

/**
 * Replaces photos that point at files bundled with the site with embedded, compressed copies,
 * the same as a photo picked on a phone. `compress` turns an image URL into a data URL.
 */
export async function embedBundledPhotos(
  recipe: Recipe,
  compress: (src: string) => Promise<string>,
): Promise<Recipe> {
  const embed = (src?: string) =>
    src && isBundledPhoto(src) ? compress(src) : Promise.resolve(src);
  const [heroImage, ...stepImages] = await Promise.all([
    embed(recipe.heroImage),
    ...recipe.steps.map((st) => embed(st.imageSrc)),
  ]);
  return {
    ...recipe,
    heroImage: heroImage ?? '',
    steps: recipe.steps.map((st, i) => ({ ...st, imageSrc: stepImages[i] })),
  };
}
