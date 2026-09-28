import React, { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronUp,
  CookingPot,
  Moon,
  Settings,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from 'lucide-react';
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
  /** A back button grows out of the menu button's left side while this is true. */
  showBack: boolean;
  onBack: () => void;
  t: UiTranslations;
}

// 'closing' keeps the panel mounted until its exit animation ends.
type MenuState = 'closed' | 'open' | 'closing';

export const FloatingMenu: React.FC<FloatingMenuProps> = (props) => {
  const { t, showBack, onBack } = props;
  const [state, setState] = useState<MenuState>('closed');
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const isOpen = state === 'open';

  // The back button tucks back into the menu button while the menu is open.
  const backShown = showBack && state === 'closed';
  // Until it first appears there's nothing to animate away, so it isn't there at all.
  const [backEverShown, setBackEverShown] = useState(false);
  if (backShown && !backEverShown) setBackEverShown(true);
  const back = backShown ? 'shown' : backEverShown ? 'hidden' : 'none';

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
          // Focus already moved on (e.g. Tab out of the menu), so don't pull it back to the button.
          onFocusLeave={() => setState('closing')}
          onClosed={() => setState('closed')}
          fabRef={fabRef}
        />
      )}

      <div className="fab-group" data-back={back}>
        <span className="fab-pill-track" aria-hidden="true">
          <span className="fab-pill" />
        </span>
        <button
          type="button"
          className="fab-back"
          aria-label={t.backToRecipes}
          aria-hidden={!backShown || undefined}
          inert={!backShown}
          onClick={() => {
            // It's about to tuck away, so keyboard focus moves to the menu button it merges into.
            fabRef.current?.focus({ preventScroll: true });
            onBack();
          }}
        >
          <ArrowLeft
            className="fab-back-arrow"
            size="1.6rem"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </button>
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
      </div>
    </>
  );
};

interface MenuPanelProps extends FloatingMenuProps {
  id: string;
  isClosing: boolean;
  onClose: () => void;
  onFocusLeave: () => void;
  onClosed: () => void;
  fabRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * The menu unfurls in a circle out of the menu button's centre (index.css). It only needs to
 * grow as far as the panel's farthest corner: any bigger and the start of the unfurl is spent
 * where nothing shows, so what can be seen happens in fewer, bigger steps.
 */
function unfurlReach(panel: HTMLElement) {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // The button's centre from the panel's top-left corner (--menu-origin in index.css, with
  // --fab-size 4rem: half the button in from the side, the 0.75rem gap plus half below).
  const reach = Math.hypot(panel.offsetWidth - 2 * rem, panel.offsetHeight + 2.75 * rem);
  panel.style.setProperty('--menu-reach', `${Math.ceil(reach + 2)}px`);
}

// Mounted only while open (or animating closed).
const MenuPanel: React.FC<MenuPanelProps> = ({
  id,
  isClosing,
  onClose,
  onFocusLeave,
  onClosed,
  fabRef,
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
  const currentPageId = useId();
  const prefsToggleId = useId();
  const prefsDrawerId = useId();
  const darkLabelId = useId();
  const textLabelId = useId();
  // Starts folded each time the menu opens, so the pages stay the first thing in reach.
  const [prefsOpen, setPrefsOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  // Stable callback ref, so focus moves to the current page once on open, not on every re-render.
  const focusCurrentPage = useCallback((panel: HTMLDivElement | null) => {
    panelRef.current = panel;
    if (!panel) return;
    unfurlReach(panel);
    panel.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true });
  }, []);
  // The panel can grow while it's open (preferences, text size), so it furls up from its size now.
  useLayoutEffect(() => {
    if (isClosing && panelRef.current) unfurlReach(panelRef.current);
  }, [isClosing]);

  const go = (target: AppPage) => {
    onNavigate(target);
    onClose();
  };

  const settingsPage = { id: 'settings' as const, label: t.settings, icon: Settings };
  const pages: { id: AppPage; label: string; icon: LucideIcon }[] = [
    { id: 'recipes', label: t.recipeVault, icon: BookOpen },
    { id: 'makes', label: t.makes, icon: CookingPot },
  ];
  // Settings normally sits at the top of the preferences, but while it's the page you're on it
  // takes the current page's place like any other.
  const current = pages.find((p) => p.id === page) ?? settingsPage;
  const otherPages = pages.filter((p) => p !== current);
  const CurrentIcon = current.icon;

  // The rows rise in from the bottom up, following the unfurl out of the menu button.
  let row = 1 + otherPages.length + 1 + actions.length;
  const stagger = () => ({ '--i': --row }) as React.CSSProperties;
  // The preference rows slide up out from behind their toggle, the top one leading.
  let fold = 0;
  const unfold = () => ({ '--j': fold++ }) as React.CSSProperties;

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
        onBlur={(e) => {
          // Close when keyboard focus leaves for the page behind the scrim. A tap on a
          // non-focusable part of the panel has no relatedTarget and keeps it open.
          const next = e.relatedTarget;
          if (
            !isClosing &&
            next instanceof Node &&
            !e.currentTarget.contains(next) &&
            next !== fabRef.current
          ) {
            onFocusLeave();
          }
        }}
        onAnimationEnd={(e) => {
          if (isClosing && e.target === e.currentTarget) onClosed();
        }}
      >
        {/* One child in a column-reverse scroller: if it outgrows the screen, it stays pinned
            to the menu button and the preferences scroll away upwards. */}
        <div className="fk-menu-content">
          <section className="fk-prefs" data-open={prefsOpen} aria-labelledby={prefsToggleId}>
            <div id={prefsDrawerId} className="fk-prefs-drawer" inert={!prefsOpen}>
              <div className="fk-prefs-clip">
                <div className="fk-prefs-body">
                  {page !== 'settings' && (
                    <div className="fk-prefs-row fk-prefs-settings" style={unfold()}>
                      <button type="button" className="fk-menu-item" onClick={() => go('settings')}>
                        <span className="fk-menu-chip" aria-hidden="true">
                          <Settings size="1.1em" strokeWidth={1.9} />
                        </span>
                        <span className="fk-menu-item-label">{t.settings}</span>
                      </button>
                    </div>
                  )}

                  <div className="fk-pref-row fk-prefs-row" style={unfold()}>
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

                  <div className="fk-pref-row fk-prefs-row" style={unfold()}>
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

                  <div className="fk-pref-row fk-prefs-row" style={unfold()}>
                    <span id={textLabelId} className="fk-pref-label">
                      {t.textScaling}
                    </span>
                    <div className="fk-stepper" role="group" aria-labelledby={textLabelId}>
                      <button
                        type="button"
                        aria-label={t.decreaseTextSize}
                        onClick={onDecreaseFont}
                      >
                        A−
                      </button>
                      <span className="fk-stepper-value" aria-live="polite">
                        {fontPercent}%
                      </span>
                      <button
                        type="button"
                        aria-label={t.increaseTextSize}
                        onClick={onIncreaseFont}
                      >
                        A+
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              id={prefsToggleId}
              type="button"
              className="fk-menu-item fk-prefs-toggle fk-menu-row"
              style={stagger()}
              aria-expanded={prefsOpen}
              aria-controls={prefsDrawerId}
              onClick={() => setPrefsOpen((open) => !open)}
            >
              <span className="fk-menu-chip" aria-hidden="true">
                <SlidersHorizontal size="1.1em" strokeWidth={1.9} />
              </span>
              <span className="fk-menu-item-label">{t.preferences}</span>
              <ChevronUp
                className="fk-menu-item-trail fk-prefs-chevron"
                size="1.1em"
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          </section>

          <nav className="fk-menu-pages" aria-label={t.pages}>
            <ul className="fk-menu-list">
              {otherPages.map(({ id: pageId, label, icon: Icon }) => (
                <li key={pageId} className="fk-menu-row" style={stagger()}>
                  <button type="button" className="fk-menu-item" onClick={() => go(pageId)}>
                    <span className="fk-menu-chip" aria-hidden="true">
                      <Icon size="1.1em" strokeWidth={1.9} />
                    </span>
                    <span className="fk-menu-item-label">{label}</span>
                  </button>
                </li>
              ))}

              {/* The page you're on, with what you can do on it hanging off it. */}
              <li className="fk-menu-current">
                <button
                  id={currentPageId}
                  type="button"
                  className="fk-menu-item fk-menu-row"
                  style={stagger()}
                  aria-current="page"
                  onClick={() => go(current.id)}
                >
                  <span className="fk-menu-chip" aria-hidden="true">
                    <CurrentIcon size="1.1em" strokeWidth={1.9} />
                  </span>
                  <span className="fk-menu-item-label">{current.label}</span>
                </button>

                {actions.length > 0 && (
                  <ul className="fk-menu-actions" aria-labelledby={currentPageId}>
                    {actions.map(({ id: actionId, label, icon: Icon, onSelect }) => (
                      <li key={actionId} className="fk-menu-row" style={stagger()}>
                        <button
                          type="button"
                          className="fk-menu-action"
                          onClick={() => {
                            onClose();
                            onSelect();
                          }}
                        >
                          <span className="fk-menu-chip" aria-hidden="true">
                            <Icon size="1.05em" strokeWidth={2.2} />
                          </span>
                          <span className="fk-menu-item-label">{label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
};
