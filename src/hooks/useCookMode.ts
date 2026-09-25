import { useState, useEffect, useCallback } from 'react';

export function useCookMode() {
  const [isWakeLocked, setIsWakeLocked] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<WakeLockSentinel | null>(null);
  const isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator;

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
      } catch (err) {
        console.warn('Failed to release wake lock:', err);
      }
      setWakeLockSentinel(null);
      setIsWakeLocked(false);
    }
  }, [wakeLockSentinel]);

  const requestWakeLock = useCallback(async () => {
    if (!isSupported) return false;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      setWakeLockSentinel(sentinel);
      setIsWakeLocked(true);

      sentinel.addEventListener('release', () => {
        setIsWakeLocked(false);
        setWakeLockSentinel(null);
      });
      return true;
    } catch (err) {
      console.warn('Screen wake lock request failed:', err);
      setIsWakeLocked(false);
      setWakeLockSentinel(null);
      return false;
    }
  }, [isSupported]);

  const toggleCookMode = useCallback(async () => {
    if (isWakeLocked) {
      await releaseWakeLock();
      return false;
    } else {
      return await requestWakeLock();
    }
  }, [isWakeLocked, releaseWakeLock, requestWakeLock]);

  // Re-request wake lock when document becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isWakeLocked && !wakeLockSentinel) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isWakeLocked, wakeLockSentinel, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [wakeLockSentinel]);

  return { isWakeLocked, toggleCookMode, isSupported };
}
