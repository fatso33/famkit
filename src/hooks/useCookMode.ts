import { useState, useEffect, useCallback, useRef } from 'react';

function releaseQuietly(sentinel: WakeLockSentinel) {
  sentinel.release().catch((err: unknown) => {
    console.warn('Failed to release wake lock:', err);
  });
}

export function useCookMode() {
  // The user's choice. Only toggleCookMode changes it, so the browser releasing
  // the lock (tab hidden, phone locked) doesn't switch Cook Mode off.
  const [isCookModeOn, setIsCookModeOn] = useState(false);
  // Mirrors the user's choice for async code and event listeners.
  const wantsLockRef = useRef(false);
  // The lock currently held, if any. The browser can release it at any time.
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  // An in-flight request, so rapid visibility changes don't stack up locks.
  const pendingRef = useRef<Promise<boolean> | null>(null);
  const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator;

  const releaseLock = useCallback(() => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel) releaseQuietly(sentinel);
  }, []);

  const acquireLock = useCallback((): Promise<boolean> => {
    if (sentinelRef.current) return Promise.resolve(true);
    pendingRef.current ??= navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        if (!wantsLockRef.current) {
          // Cook Mode was switched off while the request was in flight.
          releaseQuietly(sentinel);
          return false;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
        return true;
      })
      .catch((err: unknown) => {
        console.warn('Screen wake lock request failed:', err);
        return false;
      })
      .finally(() => {
        pendingRef.current = null;
      });
    return pendingRef.current;
  }, []);

  const toggleCookMode = useCallback(async () => {
    if (wantsLockRef.current) {
      wantsLockRef.current = false;
      setIsCookModeOn(false);
      releaseLock();
      return false;
    }
    if (!isSupported) return false;
    wantsLockRef.current = true;
    const acquired = await acquireLock();
    // A failed first request (e.g. battery saver) leaves Cook Mode off.
    wantsLockRef.current = acquired;
    setIsCookModeOn(acquired);
    return acquired;
  }, [isSupported, acquireLock, releaseLock]);

  // The browser drops the lock whenever the page is hidden; take it back on return.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wantsLockRef.current) {
        void acquireLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [acquireLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantsLockRef.current = false;
      releaseLock();
    };
  }, [releaseLock]);

  return { isCookModeOn, toggleCookMode, isSupported };
}
