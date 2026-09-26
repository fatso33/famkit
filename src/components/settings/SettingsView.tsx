import React from 'react';
import { Languages } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { isAppCheckEnabled } from '../../services/firebase';

interface SettingsViewProps {
  t: UiTranslations;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ t }) => (
  <section id="viewSettings">
    <div className="vault-hero">
      <h1 className="font-serif">{t.settings}</h1>
    </div>

    <div className="settings-card">
      <h2 className="settings-card-title">
        <span className="settings-card-icon" aria-hidden="true">
          <Languages size="1.1em" strokeWidth={1.9} />
        </span>
        {t.translationSection}
      </h2>
      <p className="settings-body">{t.translationInfo}</p>
      <p className="settings-note">{t.translationOfflineNote}</p>
      {isAppCheckEnabled && (
        <p className="settings-note">
          {t.recaptchaNoticeStart}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            {t.privacyPolicy}
          </a>
          {t.recaptchaNoticeAnd}
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
            {t.termsOfService}
          </a>
          {t.recaptchaNoticeEnd}
        </p>
      )}
    </div>
  </section>
);
