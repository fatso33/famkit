import React, { useState } from 'react';
import { Language, Theme } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { SettingsBar } from './SettingsBar';
import { PwaInstallBanner } from './PwaInstallBanner';

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

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Main Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 min-h-[52px]">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer select-none bg-transparent border-none text-left"
          title="Family Kitchen Home"
        >
          <div
            className="w-8 h-8 rounded-lg grid place-items-center text-lg shrink-0"
            style={{
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--accent)',
            }}
          >
            🌾
          </div>
          <span className="font-serif font-bold text-xl tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
            Family Kitchen
          </span>
        </button>

        <button
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className={`btn text-xs font-semibold cursor-pointer ${
            isSettingsOpen ? 'btn-primary' : ''
          }`}
          aria-expanded={isSettingsOpen}
          aria-label={t.settings}
        >
          <span>⚙️</span>
          <span>{t.settings}</span>
        </button>
      </div>

      {/* PWA Install Banner */}
      <PwaInstallBanner
        isVisible={isInstallBannerVisible}
        onInstall={onInstall}
        onDismiss={onDismissInstall}
        t={t}
      />

      {/* Settings Row */}
      <SettingsBar
        isOpen={isSettingsOpen}
        fontPercent={fontPercent}
        onIncreaseFont={onIncreaseFont}
        onDecreaseFont={onDecreaseFont}
        language={language}
        onToggleLanguage={onToggleLanguage}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onShare={onShare}
        t={t}
        onToast={onToast}
      />

      {/* Recipe Breadcrumb Row */}
      {selectedRecipeName && (
        <div
          className="flex items-center justify-between px-5 py-2 border-t animate-[slideDownRow_0.18s_ease-out]"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onNavigateHome}
              className="w-8 h-8 rounded border grid place-items-center text-base hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer shrink-0 transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
              title={t.backToRecipes}
              aria-label={t.backToRecipes}
            >
              ←
            </button>
            <span
              className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent)',
              }}
            >
              {t.recipeBadge}
            </span>
            <span
              className="font-serif font-bold text-sm truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {selectedRecipeName}
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
