import React, { useState } from 'react';
import { FontScaler } from '../common/FontScaler';
import { ThemeToggle } from '../common/ThemeToggle';
import { Language, Theme } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { getStoredApiKey, setStoredApiKey } from '../../services/storage';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, User as UserIcon } from 'lucide-react';

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
  const { user, isConfigured, signOut } = useAuth();

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* User Account / Auth badge */}
        {isConfigured && user ? (
          <div className="flex items-center gap-2 text-xs py-1 px-2.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || user.email || 'User'}
                className="w-5 h-5 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserIcon className="w-3.5 h-3.5" />
            )}
            <span className="font-medium truncate max-w-[140px] sm:max-w-[200px]">
              {user.displayName || user.email}
            </span>
            <button
              onClick={() => void signOut()}
              className="ml-1 text-stone-500 hover:text-red-600 dark:hover:text-red-400 p-0.5 rounded cursor-pointer transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div />
        )}

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
