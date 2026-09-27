import { useState, useCallback, useRef } from 'react';

export const TOAST_DURATION_MS = 3200;

export type ToastTone = 'success' | 'error' | 'info';

/** A button on the toast, e.g. "Undo". */
export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastContent {
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

// Long enough to reach for Undo.
const ACTION_TOAST_DURATION_MS = 6000;

/**
 * One toast at a time. `visible` drives the slide/fade; the content stays until the fade-out
 * ends (`clearToast`), so the text doesn't vanish mid-animation.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastContent | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success', action?: ToastAction) => {
      // A newer toast gets its full time; the previous one's timer would hide it early.
      window.clearTimeout(hideTimer.current);
      setToast({ message, tone, action });
      setVisible(true);
      hideTimer.current = window.setTimeout(
        () => setVisible(false),
        action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS,
      );
    },
    [],
  );

  /** Hides the toast now (e.g. once its action was used). */
  const hideToast = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    setVisible(false);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, visible, showToast, hideToast, clearToast };
}
