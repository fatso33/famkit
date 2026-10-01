import { useSyncExternalStore } from 'react';

/**
 * A tablet or a desktop: wide, and tall enough for a card deck to rise over the page above the
 * navigation island. A phone, turned sideways too, is neither.
 */
export const WIDE_SCREEN = '(min-width: 768px) and (min-height: 600px)';

const query = () => window.matchMedia?.(WIDE_SCREEN);

const subscribe = (onChange: () => void) => {
  const list = query();
  list?.addEventListener?.('change', onChange);
  return () => list?.removeEventListener?.('change', onChange);
};

/** Whether the screen is a tablet's or a desktop's (WIDE_SCREEN), kept current as it resizes. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false,
  );
}
