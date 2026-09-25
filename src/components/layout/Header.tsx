import React, { useState } from 'react';
import { Language, Theme } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { getStoredApiKey, setStoredApiKey } from '../../services/storage';

interface HeaderProps {
  selectedRecipeName?: string;
  onNavigateHome: () => void;
  fontPercent: number;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  language: Language;
  onToggleLanguage: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onShare: () => void;
  isInstallBannerVisible: boolean;
  onInstall: () => void;
  onDismissInstall: () => void;
  t: UiTranslations;
  onToast: (msg: string, icon?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedRecipeName,
  onNavigateHome,
  fontPercent,
  onIncreaseFont,
  onDecreaseFont,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  onShare,
  isInstallBannerVisible,
  onInstall,
  onDismissInstall,
  t,
  onToast,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(getStoredApiKey);

  const handleSaveApiKey = () => {
    setStoredApiKey(apiKey);
    onToast(t.apiKeySavedToast, '🔑');
    setShowApiKeyInput(false);
  };

  return (
    <header className="app-header" id="appHeader">
      {/* Main Row */}
      <div className="header-main-row">
        <div
          className="brand-group"
          id="navHomeBtn"
          role="button"
          tabIndex={0}
          title="Family Kitchen Home"
          onClick={onNavigateHome}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNavigateHome();
          }}
        >
          <div className="brand-icon">🌾</div>
          <span className="brand-title">Family Kitchen</span>
        </div>

        <button
          className={`btn ${isSettingsOpen ? 'btn-primary' : ''}`}
          id="settingsToggleBtn"
          aria-label={t.settings}
          aria-expanded={isSettingsOpen}
          title={t.settings}
          onClick={() => setIsSettingsOpen((prev) => !prev)}
        >
          <span>⚙️</span>
          <span>{t.settings}</span>
        </button>
      </div>

      {/* Minimal Install Banner Row */}
      <div
        className={`install-banner-row ${isInstallBannerVisible ? 'show' : ''}`}
        id="installBannerRow"
        role="region"
        aria-label="Install app banner"
      >
        <div className="install-banner-left">
          <span className="install-banner-icon">📱</span>
          <span
            className="install-banner-text"
            id="installBannerText"
            dangerouslySetInnerHTML={{ __html: t.installBannerText }}
          />
        </div>
        <div className="install-banner-actions">
          <button
            className="btn-install-cta"
            id="installBannerBtn"
            onClick={onInstall}
          >
            {t.installBtn}
          </button>
          <button
            className="btn-install-close"
            id="installBannerCloseBtn"
            aria-label="Dismiss banner"
            title="Dismiss"
            onClick={onDismissInstall}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Extra Settings Row */}
      <div
        className={`header-settings-row ${isSettingsOpen ? 'open' : ''}`}
        id="settingsRow"
        role="region"
        aria-label="Settings bar"
      >
        <div className="font-scale-group" title={t.textScaling}>
          <button
            className="font-scale-btn"
            id="fontDecBtn"
            aria-label="Decrease text size"
            onClick={onDecreaseFont}
          >
            A−
          </button>
          <span className="font-scale-val" id="fontScaleLabel">
            {fontPercent}%
          </span>
          <button
            className="font-scale-btn"
            id="fontIncBtn"
            aria-label="Increase text size"
            onClick={onIncreaseFont}
          >
            A+
          </button>
        </div>

        {/* Language Toggle: EN / PL text only */}
        <button
          className="btn btn-lang-toggle"
          id="langToggleBtn"
          aria-label="Toggle language: English / Polish"
          title="Switch language (EN / PL)"
          onClick={onToggleLanguage}
        >
          <span className="lang-toggle-code" id="langCodeLabel">
            {language === 'pl' ? 'PL' : 'EN'}
          </span>
        </button>

        <button
          className="btn btn-icon"
          id="themeToggleBtn"
          aria-label={t.themeToggle}
          title={t.themeToggle}
          onClick={onToggleTheme}
        >
          <span id="themeIcon">{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>

        <button
          className="btn btn-icon"
          id="shareRecipeBtn"
          title="Share recipe"
          aria-label="Share recipe"
          onClick={onShare}
        >
          <span>↗️</span>
        </button>

        <button
          className={`btn ${showApiKeyInput ? 'btn-primary' : ''}`}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', minHeight: '38px' }}
          title="Configure Gemini API Key for custom recipes"
          onClick={() => setShowApiKeyInput((prev) => !prev)}
        >
          <span>🔑</span>
          <span>API Key</span>
        </button>
      </div>

      {/* Optional API Key Drawer */}
      {isSettingsOpen && showApiKeyInput && (
        <div
          style={{
            padding: '0.75rem 1.25rem',
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {t.apiKeyLabel}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '500px' }}>
            <input
              type="password"
              className="form-control"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t.apiKeyPlaceholder}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem' }}
            />
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
              onClick={handleSaveApiKey}
            >
              Save
            </button>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Wanda's Cheese Bread works 100% offline without a key. This key is only used to translate custom recipes you add.
          </span>
        </div>
      )}

      {/* Recipe row: appears when viewing a recipe */}
      <div
        className={`header-recipe-row ${selectedRecipeName ? 'active' : ''}`}
        id="headerRecipeRow"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
          <button
            className="btn btn-icon btn-back-header"
            id="backToGridBtn"
            aria-label={t.backToRecipes}
            title={t.backToRecipes}
            onClick={onNavigateHome}
          >
            <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>←</span>
          </button>
          <span className="header-recipe-badge">{t.recipeBadge}</span>
          <span className="header-recipe-name" id="headerRecipeName">
            {selectedRecipeName || ''}
          </span>
        </div>
      </div>
    </header>
  );
};
