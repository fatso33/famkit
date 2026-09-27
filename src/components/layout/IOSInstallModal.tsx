import React from 'react';
import { UiTranslations } from '../../i18n/translations';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';

interface IOSInstallModalProps {
  onClose: () => void;
  t: UiTranslations;
}

// Decorative Safari icons, inserted at the `{icon}` marker of the (static, trusted) step text.
const SHARE_ICON = `<span class="ios-share-badge" aria-hidden="true"><svg width="13" height="17" viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-3px;"><path d="M7 11V1m0 0L3 5m4-4l4 4"/><rect x="1" y="7" width="12" height="10" rx="2"/></svg></span>`;
const ADD_ICON = `<span class="ios-add-badge" aria-hidden="true">⊞</span>`;

const withIcon = (html: string, icon: string) => html.replace('{icon}', icon);

// Mount only while open.
export const IOSInstallModal: React.FC<IOSInstallModalProps> = ({ onClose, t }) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={ref}
      className={`ios-install-modal-overlay open${isClosing ? ' is-closing' : ''}`}
      id="iosInstallModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iosModalTitle"
      {...backdropProps}
    >
      <div className="ios-install-modal-card">
        <div className="ios-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="ios-modal-icon">
              <img src="./apple-touch-icon.png" alt={t.logoAlt} className="brand-icon-img" />
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
            aria-label={t.closeDialog}
            onClick={requestClose}
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
              dangerouslySetInnerHTML={{ __html: withIcon(t.iosStep1, SHARE_ICON) }}
            />
          </div>

          <div className="ios-step-item">
            <div className="ios-step-num">2</div>
            <div
              className="ios-step-text"
              id="iosStep2"
              dangerouslySetInnerHTML={{ __html: withIcon(t.iosStep2, ADD_ICON) }}
            />
          </div>

          <div className="ios-step-item">
            <div className="ios-step-num">3</div>
            <div
              className="ios-step-text"
              id="iosStep3"
              dangerouslySetInnerHTML={{ __html: t.iosStep3 }}
            />
          </div>
        </div>

        <div className="ios-modal-footer">
          <button
            className="btn btn-primary"
            id="iosModalDoneBtn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={requestClose}
          >
            {t.iosModalDone}
          </button>
        </div>
      </div>
    </div>
  );
};
