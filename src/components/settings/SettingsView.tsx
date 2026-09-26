import React, { useId, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import {
  getStoredApiKey,
  setStoredApiKey,
  hasCustomApiKey,
  hasBundledApiKey,
} from '../../services/storage';

interface SettingsViewProps {
  t: UiTranslations;
  onToast: (msg: string, icon?: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ t, onToast }) => {
  const [apiKey, setApiKey] = useState(getStoredApiKey);
  // Re-read after saving so the status line reflects what is now stored.
  const [hasCustomKey, setHasCustomKey] = useState(hasCustomApiKey);
  const inputId = useId();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredApiKey(apiKey);
    setHasCustomKey(hasCustomApiKey());
    onToast(t.apiKeySavedToast, '🔑');
  };

  let status: { ok: boolean; text: string };
  if (hasCustomKey) status = { ok: true, text: t.apiKeyCustomActive };
  else if (hasBundledApiKey()) status = { ok: true, text: t.apiKeyBundledActive };
  else status = { ok: false, text: t.apiKeyMissing };

  return (
    <section id="viewSettings">
      <div className="vault-hero">
        <h1 className="font-serif">{t.settings}</h1>
      </div>

      <div className="settings-card">
        <h2 className="settings-card-title">
          <span className="settings-card-icon" aria-hidden="true">
            <KeyRound size="1.1em" strokeWidth={1.9} />
          </span>
          {t.translationSection}
        </h2>

        <form className="settings-form" onSubmit={handleSave}>
          <label className="form-label" htmlFor={inputId}>
            {t.apiKeyLabel}
          </label>
          <div className="settings-input-row">
            <input
              id={inputId}
              type="password"
              className="form-control"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasBundledApiKey() ? t.apiKeyBundledPlaceholder : t.apiKeyPlaceholder}
            />
            <button type="submit" className="btn btn-primary">
              {t.apiKeySave}
            </button>
          </div>
        </form>

        <p className={`settings-status ${status.ok ? 'is-ok' : 'is-warn'}`}>
          <span aria-hidden="true">{status.ok ? '✓' : '⚠️'}</span> {status.text}
        </p>
        <p className="settings-note">{t.apiKeyOfflineNote}</p>
      </div>
    </section>
  );
};
