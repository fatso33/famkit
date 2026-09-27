// One-time repair. Remove it (with src/data/wandasCheeseBread.ts and its call in useRecipes)
// once it has run. On 26 Sep 2026 a background translation named the wrong language for Wanda's
// Cheese Bread: her English was stored as the "Polish" original and her hand-written Polish was
// replaced by a machine translation filed as "English". Peter's test edit on top of that became
// version 4. This puts back her original English and hand-written Polish, keeping his photos.
import { Recipe, Step } from '../types/recipe';
import type { CurrentUser } from '../hooks/useCurrentUser';
import { WANDAS_CHEESE_BREAD_SEED } from '../data/wandasCheeseBread';
import { canEditRecipe } from './ownership';
import { sourceHash, translatableContent } from './recipeTranslation';

// The broken record exactly, so the repair can never undo a later, deliberate edit.
const BROKEN = { id: WANDAS_CHEESE_BREAD_SEED.id, version: 4, updatedAt: 1790479983309 };

export const WANDA_REPAIR_NOTE = "Restored Wanda's original wording and her hand-written Polish";

/** Whether this is the broken record, on a device signed in as its owner. */
export function needsWandaRepair(recipe: Recipe, user: CurrentUser | null): boolean {
  return (
    recipe.id === BROKEN.id &&
    recipe.version === BROKEN.version &&
    recipe.updatedAt === BROKEN.updatedAt &&
    canEditRecipe(recipe, user, true)
  );
}

// A translation carries only the words; photos come from the original.
const textOnly = (step: Step): Step => ({
  num: step.num,
  text: step.text,
  notes: step.notes,
  imageCaption: step.imageCaption,
});

/**
 * The broken record with Wanda's original English and her hand-written Polish, stamped as
 * current. Photos, author, owner and dates stay as they are.
 */
export function repairWanda(broken: Recipe): Recipe {
  const { translations, ...original } = WANDAS_CHEESE_BREAD_SEED;
  const repaired: Recipe = {
    ...broken,
    ...translatableContent(original),
    baseYield: original.baseYield,
    steps: original.steps.map((step, i) => ({
      ...textOnly(step),
      hasImage: broken.steps[i]?.hasImage,
      imageSrc: broken.steps[i]?.imageSrc,
    })),
    sourceLanguage: 'en',
  };
  const polish = translations!.pl!;
  return {
    ...repaired,
    translations: {
      pl: { ...polish, steps: polish.steps?.map(textOnly), sourceHash: sourceHash(repaired) },
    },
  };
}
