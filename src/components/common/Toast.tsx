import React from 'react';
import { Check, CircleAlert } from 'lucide-react';
import { ToastContent } from '../../hooks/useToast';

interface ToastProps {
  toast: ToastContent | null;
  visible: boolean;
  /** Called once the fade-out has finished, to clear the text. */
  onHidden: () => void;
}

const ICONS = { success: Check, error: CircleAlert, info: null };

// Always mounted, so the slide/fade has an element to transition from. The live region is the
// unstyled wrapper: it stays in the accessibility tree while the pill inside is hidden, so screen
// readers announce new text instead of missing it as the pill appears.
export const Toast: React.FC<ToastProps> = ({ toast, visible, onHidden }) => {
  const Icon = toast && ICONS[toast.tone];

  return (
    <div role="status" aria-live="polite">
      <div
        className={`app-toast${visible ? ' show' : ''}`}
        onTransitionEnd={(e) => {
          if (!visible && e.target === e.currentTarget && e.propertyName === 'opacity') onHidden();
        }}
      >
        {toast && (
          <>
            {Icon && <Icon className="app-toast-icon" size="1.1em" aria-hidden="true" />}
            <span>{toast.message}</span>
          </>
        )}
      </div>
    </div>
  );
};
