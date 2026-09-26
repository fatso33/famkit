import React from 'react';
import { X } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';

interface InstallCardProps {
  onInstall: () => void;
  onDismiss: () => void;
  t: UiTranslations;
}

export const InstallCard: React.FC<InstallCardProps> = ({ onInstall, onDismiss, t }) => (
  <aside className="install-card" id="installCard" aria-label={t.installBannerLabel}>
    <img src="./apple-touch-icon.png" alt="" className="install-card-icon" />
    <span
      className="install-card-text"
      // Static, trusted translation string (only <strong> markup), never user data.
      dangerouslySetInnerHTML={{ __html: t.installBannerText }}
    />
    <button type="button" className="btn btn-primary install-card-cta" onClick={onInstall}>
      {t.installBtn}
    </button>
    <button
      type="button"
      className="install-card-close"
      aria-label={t.dismissBanner}
      title={t.dismissBanner}
      onClick={onDismiss}
    >
      <X size="1em" aria-hidden="true" />
    </button>
  </aside>
);
