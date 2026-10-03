import { useCallback, useEffect, useState } from 'react';
import { RecipeDraft } from '../types/recipe';
import { deleteDraftFromCloud, saveDraftToCloud, subscribeToDrafts } from '../services/drafts';
import { photosCommitted, withPhotosApart } from '../services/photos';
import type { CurrentUser } from './useCurrentUser';

/**
 * The signed-in family member's drafts, kept in sync with the cloud. Saving and discarding show
 * at once; the returned promise rejects if the cloud (or this device's storage) refused it.
 */
export function useDrafts(currentUser: CurrentUser | null) {
  const email = currentUser?.email ?? '';
  // Tagged with whose they are, so another person's never show after switching accounts.
  // `loaded`: the list has come back at least once, so a draft missing from it isn't there.
  const [state, setState] = useState<{ email: string; drafts: RecipeDraft[]; loaded: boolean }>({
    email: '',
    drafts: [],
    loaded: false,
  });

  useEffect(() => {
    if (!email) return;
    return subscribeToDrafts(email, (drafts) => setState({ email, drafts, loaded: true }));
  }, [email]);

  const mine = state.email === email;
  const drafts = mine ? state.drafts : [];

  const saveDraft = useCallback(
    (written: RecipeDraft): Promise<void> => {
      if (!email) return Promise.reject(new Error('Drafts need a signed-in family member'));
      // Its new photos go to the cloud on their own, beside it (services/photos).
      const { recipe, uploads } = withPhotosApart(written.recipe);
      const draft = { ...written, recipe };
      setState((prev) => ({
        email,
        loaded: prev.email === email && prev.loaded,
        drafts: [
          ...(prev.email === email ? prev.drafts : []).filter((d) => d.id !== draft.id),
          draft,
        ],
      }));
      return saveDraftToCloud(email, draft, uploads).then(() => photosCommitted(uploads));
    },
    [email],
  );

  const discardDraft = useCallback(
    (id: string): Promise<void> => {
      if (!email) return Promise.resolve();
      setState((prev) => ({
        email,
        loaded: prev.email === email && prev.loaded,
        drafts: (prev.email === email ? prev.drafts : []).filter((d) => d.id !== id),
      }));
      return deleteDraftFromCloud(email, id);
    },
    [email],
  );

  return {
    drafts,
    /** Whether `drafts` is known to be complete. */
    loaded: mine && state.loaded,
    saveDraft,
    discardDraft,
    canDraft: Boolean(email),
  };
}
