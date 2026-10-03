import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { photoState, requestPhoto, subscribePhoto } from '../services/photos';
import { photoIdOf } from '../utils/photoRefs';

const noSubscription = () => () => {};

/**
 * What to draw for a photo field: the photo's address once it's here, and whether it's still on
 * its way (so the place shows a soft stand-in rather than none). A photo the record holds itself
 * (an older recipe, a photo just picked) is drawn as it is; one kept on its own
 * (`photo:<id>`, utils/photoRefs) is loaded from this phone, else the cloud. One that can't be had
 * (offline, never fetched) comes back as no photo, not as endlessly waiting.
 */
export function usePhoto(value: string | undefined): { src: string; pending: boolean } {
  const id = photoIdOf(value);
  const subscribe = useCallback(
    (listener: () => void) => (id ? subscribePhoto(id, listener) : noSubscription()),
    [id],
  );
  const state = useSyncExternalStore(subscribe, () => (id ? photoState(id) : undefined));

  // The photo store is outside React: ask it for the photo once this field shows it.
  useEffect(() => {
    if (id) requestPhoto(id);
  }, [id]);

  if (!id) return { src: typeof value === 'string' ? value : '', pending: false };
  if (state?.status === 'ready') return { src: state.url, pending: false };
  return { src: '', pending: state?.status !== 'missing' };
}
