import { useEffect } from 'react';
import type React from 'react';

/**
 * Standard modal dismissal for dialogs that are mounted only while open:
 * Escape closes (keyboard), and the returned handler closes on clicks that land
 * on the backdrop element itself rather than bubbling up from its contents.
 */
export function useDialogDismiss(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };
}
