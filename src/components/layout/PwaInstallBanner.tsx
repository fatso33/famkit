import React from 'react';
import { UiTranslations } from '../../i18n/translations';

interface PwaInstallBannerProps {
  isVisible: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  t: UiTranslations;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  isVisible,
  onInstall,
  onDismiss,
  t,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Install app banner"
      className="flex items-center justify-between px-5 py-2 gap-3 text-xs border-t animate-[slideDownRow_0.2s_ease-out]"
      style={{
        backgroundColor: 'var(--accent-subtle)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">📱</span>
        <span
          className="truncate"
          dangerouslySetInnerHTML={{ __html: t.installBannerText }}
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onInstall}
          className="px-3 py-1 text-xs font-bold text-white rounded cursor-pointer transition-colors"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {t.installBtn}
        </button>
        <button
          onClick={onDismiss}
          className="w-6 h-6 rounded-full grid place-items-center text-xs opacity-70 hover:opacity-100 cursor-pointer"
          aria-label="Dismiss banner"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
