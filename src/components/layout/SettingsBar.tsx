import React, { useState } from 'react';
import { FontScaler } from '../common/FontScaler';
import { ThemeToggle } from '../common/ThemeToggle';
import { Language, Theme } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { getStoredApiKey, setStoredApiKey } from '../../services/storage';

interface SettingsBarProps {
  isOpen: boolean;
  fontPercent: number;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  language: Language;
  onToggleLanguage: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onShare: () => void;
  t: UiTranslations;
  onToast: (msg: string, icon?: string) => void;
}

export const SettingsBar: React.FC<SettingsBarProps> = ({
  isOpen,
  fontPercent,
  onIncreaseFont,
  onDecreaseFont,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  onShare,
  t,
  onToast,
}) => {
  const [apiKey, setApiKey] = useState(getStoredApiKey);
  const [showKeyInput, setShowKeyInput] = useState(false);

  if (!isOpen) return null;

  const handleSaveApiKey = () => {
    setStoredApiKey(apiKey);
    onToast(t.apiKeySavedToast, '🔑');
    setShowKeyInput(false);
  };

  return (
    <div
      role="region"
      aria-label="Settings bar"
      className="flex flex-col gap-3 px-5 py-3 border-t animate-[slideDownRow_0.18s_ease-out] shadow-md"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <FontScaler
          percent={fontPercent}
          onIncrease={onIncreaseFont}
          onDecrease={onDecreaseFont}
        />

        <button
          onClick={onToggleLanguage}
          className="btn px-2.5 py-1 text-xs font-bold cursor-pointer min-w-[44px]"
          title="Switch language (EN / PL)"
          aria-label="Toggle language: English / Polish"
        >
          <span>{language === 'pl' ? 'PL' : 'EN'}</span>
        </button>

        <ThemeToggle
          theme={theme}
          onToggle={onToggleTheme}
          title={t.themeToggle}
        />

        <button
          onClick={onShare}
          className="btn btn-icon cursor-pointer"
          title="Share recipe"
          aria-label="Share recipe"
        >
          <span>↗️</span>
        </button>

        <button
          onClick={() => setShowKeyInput((prev) => !prev)}
          className={`btn text-xs font-semibold cursor-pointer ${
            showKeyInput ? 'btn-primary' : ''
          }`}
          title="Configure Gemini API Key"
        >
          <span>🔑</span>
          <span>API Key</span>
        </button>
      </div>

      {showKeyInput && (
        <div
          className="p-3 rounded border text-xs flex flex-col gap-2 mt-1 animate-[fadeIn_0.15s_ease-out]"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <label className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t.apiKeyLabel}
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t.apiKeyPlaceholder}
              className="flex-1 px-3 py-1.5 rounded border text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={handleSaveApiKey}
              className="btn btn-primary text-xs px-3 py-1.5 cursor-pointer"
            >
              Save
            </button>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>
            Wanda's Cheese Bread works 100% offline without a key. This key is only used to translate custom recipes you add.
          </span>
        </div>
      )}
    </div>
  );
};
