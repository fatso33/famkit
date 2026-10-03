import { useEffect, useRef } from 'react';
import { Recipe, RecipeDraft } from '../types/recipe';
import { forgetPhotosExcept } from '../services/photos';
import { recipePhotoIds } from '../utils/photoRefs';

// Long enough after launch for the cloud's answer to have replaced this phone's copy.
const TIDY_AFTER_MS = 20_000;

/**
 * Once a session, a while after launch, removes from this phone the photos nothing points at any
 * more: a photo replaced, a deleted recipe's (erased only when the recipe is gone from the list),
 * a discarded draft's. One wanted again later is simply fetched again. Waits for the drafts, so a
 * draft's photos are never taken for unused.
 */
export function usePhotoTidy(recipes: Recipe[], drafts: RecipeDraft[], draftsLoaded: boolean) {
  const latest = useRef({ recipes, drafts });
  useEffect(() => {
    latest.current = { recipes, drafts };
  });
  const tidied = useRef(false);

  useEffect(() => {
    if (!draftsLoaded || tidied.current) return;
    const timer = setTimeout(() => {
      tidied.current = true;
      const { recipes: all, drafts: mine } = latest.current;
      const keep = new Set([
        ...all.flatMap(recipePhotoIds),
        ...mine.flatMap((draft) => recipePhotoIds(draft.recipe)),
      ]);
      void forgetPhotosExcept(keep);
    }, TIDY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [draftsLoaded]);
}
