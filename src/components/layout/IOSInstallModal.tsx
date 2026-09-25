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
      className="ios-install-modal-overlay open"
      id="iosInstallModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iosModalTitle"
      onClick={onClose}
    >
      <div
        className="ios-install-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ios-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="ios-modal-icon">
              <img src="./apple-touch-icon.png" alt="Family Kitchen logo" className="brand-icon-img" />
            </div>
            <div>
              <h3 className="ios-modal-title" id="iosModalTitle">
                {t.iosModalTitle}
              </h3>
              <p className="ios-modal-subtitle" id="iosModalSubtitle">
                {t.iosModalSubtitle}
              </p>
            </div>
          </div>
          <button
            className="ios-modal-close"
            id="iosModalCloseBtn"
            aria-label="Close modal"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="ios-modal-body">
          <div className="ios-step-item">
            <div className="ios-step-num">1</div>
            <div
              className="ios-step-text"
              id="iosStep1"
              dangerouslySetInnerHTML={{
                __html: `Tap the <strong>Share</strong> button <span class="ios-share-badge"><svg width="13" height="17" viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-3px;"><path d="M7 11V1m0 0L3 5m4-4l4 4"/><rect x="1" y="7" width="12" height="10" rx="2"/></svg></span> in Safari (bottom or top bar).`,
              }}
            />
          </div>

          <div className="ios-step-item">
            <div className="ios-step-num">2</div>
            <div
              className="ios-step-text"
              id="iosStep2"
              dangerouslySetInnerHTML={{
                __html: `Scroll down and tap <strong>Add to Home Screen</strong> <span class="ios-add-badge">⊞</span>.`,
              }}
            />
          </div>

          <div className="ios-step-item">
            <div className="ios-step-num">3</div>
            <div
              className="ios-step-text"
              id="iosStep3"
              dangerouslySetInnerHTML={{
                __html: `Tap <strong>Add</strong> in the top-right corner to finish.`,
              }}
            />
          </div>
        </div>

        <div className="ios-modal-footer">
          <button
            className="btn btn-primary"
            id="iosModalDoneBtn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onClose}
          >
            {t.iosModalDone}
          </button>
        </div>
      </div>
    </div>
  );
};
