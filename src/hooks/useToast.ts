import { useState, useCallback, useRef } from 'react';

export const TOAST_DURATION_MS = 3200;

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastContent {
  message: string;
  tone: ToastTone;
}

/**
 * One toast at a time. `visible` drives the slide/fade; the content stays until the fade-out
 * ends (`clearToast`), so the text doesn't vanish mid-animation.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastContent | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    // A newer toast gets its full time; the previous one's timer would hide it early.
    window.clearTimeout(hideTimer.current);
    setToast({ message, tone });
    setVisible(true);
    hideTimer.current = window.setTimeout(() => setVisible(false), TOAST_DURATION_MS);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, visible, showToast, clearToast };
}
