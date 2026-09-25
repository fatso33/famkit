import React from 'react';
import { UiTranslations } from '../../i18n/translations';

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: UiTranslations;
}

export const IOSInstallModal: React.FC<IOSInstallModalProps> = ({
  isOpen,
  onClose,
  t,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="iosModalTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden animate-[scaleUp_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg grid place-items-center text-lg font-bold"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent)',
              }}
            >
              🌾
            </div>
            <div>
              <h3 id="iosModalTitle" className="font-serif font-bold text-base">
                {t.iosModalTitle}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t.iosModalSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full grid place-items-center text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3.5 text-sm">
          <div className="flex items-start gap-3">
            <div
              className="w-6 h-6 rounded-full text-xs font-bold text-white grid place-items-center shrink-0 mt-0.5"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              1
            </div>
            <p className="leading-snug">
              Tap the <strong>Share</strong> button in Safari (bottom or top bar).
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="w-6 h-6 rounded-full text-xs font-bold text-white grid place-items-center shrink-0 mt-0.5"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              2
            </div>
            <p className="leading-snug">
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="w-6 h-6 rounded-full text-xs font-bold text-white grid place-items-center shrink-0 mt-0.5"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              3
            </div>
            <p className="leading-snug">
              Tap <strong>Add</strong> in the top-right corner to finish.
            </p>
          </div>
        </div>

        <div
          className="p-3 border-t"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-primary w-full justify-center text-sm cursor-pointer"
          >
            {t.iosModalDone}
          </button>
        </div>
      </div>
    </div>
  );
};
