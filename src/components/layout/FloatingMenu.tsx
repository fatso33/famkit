import React, { useCallback, useId, useRef, useState } from 'react';
import { BookOpen, CookingPot, Moon, Settings, Sun, type LucideIcon } from 'lucide-react';
import { Language, Theme } from '../../types/recipe';
import { AppPage } from '../../types/navigation';
import { UiTranslations } from '../../i18n/translations';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';

/** A page-dependent entry at the bottom of the menu (e.g. "Add recipe" on the vault). */
export interface MenuAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

interface FloatingMenuProps {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  actions: MenuAction[];
  language: Language;
  onToggleLanguage: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  fontPercent: number;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  t: UiTranslations;
}

// 'closing' keeps the panel mounted until its exit animation ends.
type MenuState = 'closed' | 'open' | 'closing';

export const FloatingMenu: React.FC<FloatingMenuProps> = (props) => {
  const { t } = props;
  const [state, setState] = useState<MenuState>('closed');
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const isOpen = state === 'open';

  const close = useCallback(() => {
    setState('closing');
    fabRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      {state !== 'closed' && (
        <MenuPanel
          {...props}
          id={panelId}
          isClosing={state === 'closing'}
          onClose={close}
          onClosed={() => setState('closed')}
        />
      )}

      <button
        ref={fabRef}
        type="button"
        className={`fab-menu ${isOpen ? 'is-open' : ''}`}
        id="fabMenuBtn"
        aria-label={isOpen ? t.closeMenu : t.openMenu}
        aria-expanded={isOpen}
        aria-controls={state !== 'closed' ? panelId : undefined}
        onClick={() => (isOpen ? close() : setState('open'))}
      >
        <span className="fab-menu-glyph" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
    </>
  );
};

interface MenuPanelProps extends FloatingMenuProps {
  id: string;
  isClosing: boolean;
  onClose: () => void;
  onClosed: () => void;
}

// Mounted only while open (or animating closed).
const MenuPanel: React.FC<MenuPanelProps> = ({
  id,
  isClosing,
  onClose,
  onClosed,
  page,
  onNavigate,
  actions,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  fontPercent,
  onIncreaseFont,
  onDecreaseFont,
  t,
}) => {
  const backdropProps = useDialogDismiss(onClose);
  const pagesLabelId = useId();
  const prefsLabelId = useId();
  const darkLabelId = useId();
  const textLabelId = useId();

  // Stable callback ref, so focus moves to the current page once on open, not on every re-render.
  const focusCurrentPage = useCallback((panel: HTMLDivElement | null) => {
    panel?.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true });
  }, []);

  const go = (target: AppPage) => {
    onNavigate(target);
    onClose();
  };

  const pages: { id: AppPage; label: string; icon: LucideIcon }[] = [
    { id: 'recipes', label: t.recipeVault, icon: BookOpen },
    { id: 'makes', label: t.makes, icon: CookingPot },
  ];

  // Stagger order for the entrance animation.
  let row = 0;
  const stagger = () => ({ '--i': row++ }) as React.CSSProperties;

  return (
    // Backdrop click is a mouse/touch shortcut; keyboard users close with Escape or the menu button.
    <div
      className={`fk-menu-layer ${isClosing ? 'is-closing' : ''}`}
      role="dialog"
      aria-label={t.menu}
      {...backdropProps}
    >
      <div
        ref={focusCurrentPage}
        id={id}
        className="fk-menu-panel"
        onAnimationEnd={(e) => {
          if (isClosing && e.target === e.currentTarget) onClosed();
        }}
      >
        <div className="fk-menu-brand fk-menu-row" style={stagger()}>
          <img src="./apple-touch-icon.png" alt="" className="fk-menu-brand-icon" />
          <span className="fk-menu-brand-title">Family Kitchen</span>
        </div>

        <nav className="fk-menu-section" aria-labelledby={pagesLabelId}>
          <p id={pagesLabelId} className="fk-menu-eyebrow fk-menu-row" style={stagger()}>
            {t.pages}
          </p>
          <ul className="fk-menu-list">
            {pages.map(({ id: pageId, label, icon: Icon }) => (
              <li key={pageId} className="fk-menu-row" style={stagger()}>
                <button
                  type="button"
                  className="fk-menu-item"
                  aria-current={page === pageId ? 'page' : undefined}
                  onClick={() => go(pageId)}
                >
                  <span className="fk-menu-chip" aria-hidden="true">
                    <Icon size="1.1em" strokeWidth={1.9} />
                  </span>
                  <span className="fk-menu-item-label">{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="fk-menu-section" aria-labelledby={prefsLabelId}>
          <p id={prefsLabelId} className="fk-menu-eyebrow fk-menu-row" style={stagger()}>
            {t.preferences}
          </p>

          <div className="fk-pref-row fk-menu-row" style={stagger()}>
            <span className="fk-pref-label">{t.language}</span>
            <button
              type="button"
              className="fk-segmented"
              data-value={language}
              aria-label={t.languageToggle}
              onClick={onToggleLanguage}
            >
              <span className="fk-segmented-thumb" aria-hidden="true" />
              <span className={language === 'en' ? 'is-active' : ''}>EN</span>
              <span className={language === 'pl' ? 'is-active' : ''}>PL</span>
            </button>
          </div>

          <div className="fk-pref-row fk-menu-row" style={stagger()}>
            <span id={darkLabelId} className="fk-pref-label">
              {t.darkMode}
            </span>
            <button
              type="button"
              role="switch"
              className="fk-switch"
              aria-checked={theme === 'dark'}
              aria-labelledby={darkLabelId}
              onClick={onToggleTheme}
            >
              <span className="fk-switch-thumb" aria-hidden="true">
                {theme === 'dark' ? <Moon size="0.85em" /> : <Sun size="0.85em" />}
              </span>
            </button>
          </div>

          <div className="fk-pref-row fk-menu-row" style={stagger()}>
            <span id={textLabelId} className="fk-pref-label">
              {t.textScaling}
            </span>
            <div className="fk-stepper" role="group" aria-labelledby={textLabelId}>
              <button type="button" aria-label={t.decreaseTextSize} onClick={onDecreaseFont}>
                A−
              </button>
              <span className="fk-stepper-value" aria-live="polite">
                {fontPercent}%
              </span>
              <button type="button" aria-label={t.increaseTextSize} onClick={onIncreaseFont}>
                A+
              </button>
            </div>
          </div>
        </section>

        <div className="fk-menu-section fk-menu-row" style={stagger()}>
          <button
            type="button"
            className="fk-menu-item"
            aria-current={page === 'settings' ? 'page' : undefined}
            onClick={() => go('settings')}
          >
            <span className="fk-menu-chip" aria-hidden="true">
              <Settings size="1.1em" strokeWidth={1.9} />
            </span>
            <span className="fk-menu-item-label">{t.settings}</span>
          </button>
        </div>

        {actions.length > 0 && (
          <div className="fk-menu-actions">
            {actions.map(({ id: actionId, label, icon: Icon, onSelect }) => (
              <div key={actionId} className="fk-menu-row" style={stagger()}>
                <button
                  type="button"
                  className="fk-menu-action"
                  onClick={() => {
                    onClose();
                    onSelect();
                  }}
                >
                  <span className="fk-menu-chip" aria-hidden="true">
                    <Icon size="1.1em" strokeWidth={2.2} />
                  </span>
                  <span className="fk-menu-item-label">{label}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
