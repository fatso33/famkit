import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChefHat, CookingPot, Moon, Settings, Sun, type LucideIcon } from 'lucide-react';
import { Language, Theme } from '../../types/recipe';
import { AppPage, MAIN_PAGES, MainPage } from '../../types/navigation';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { prefersReducedMotion, transitionStarted } from '../../utils/viewTransition';
import { tick } from '../../utils/haptics';
import { RecipeBoxIcon, RecipeCardIcon } from '../common/RecipeBoxIcon';
import { PrefsGlyph } from '../common/PrefsGlyph';
import { NavTabIcon } from './NavTabIcon';

/** Something to do on the current page (e.g. "Add recipe" on the vault), held in its panel. */
export interface MenuAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Takes a row of its own, under the keys before it. */
  wide?: boolean;
}

interface NavIslandProps {
  page: AppPage;
  /** The tab shown as current: the main page, or the Recipe Box while a recipe is open. */
  litTab: MainPage;
  /** A recipe is open: the Recipe Box tab's tin holds its card pulled up (the recipe icon). */
  onRecipe: boolean;
  onSelectTab: (page: MainPage) => void;
  /** The tabs that raise a card deck when tapped, here and now (tablets and desktops). */
  deckTabs: readonly MainPage[];
  /** The tab whose card deck is open, if any. */
  deck: MainPage | null;
  /** The actions panel opening: an open card deck makes way for it. */
  onActionsOpen: () => void;
  onOpenSettings: () => void;
  actions: MenuAction[];
  /** What the actions panel is headed with: the page's name, or the open recipe's. */
  panelTitle: string;
  language: Language;
  onToggleLanguage: () => void;
  theme: Theme;
  /** From the centre of the theme pill, where the new theme spreads out from. */
  onToggleTheme: (origin: { x: number; y: number }) => void;
  fontPercent: number;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  /** A back button slides out from behind the pill's left end while this is true. */
  showBack: boolean;
  backLabel: string;
  /** A photo is open full screen: only the back button stays, over it, and closes it. */
  photoOpen: boolean;
  onBack: () => void;
  t: UiTranslations;
}

const TABS = MAIN_PAGES;

// 'closing' keeps the panel mounted until its exit animation ends.
type MenuState = 'closed' | 'open' | 'closing';

/**
 * The navigation island: a pill of the three main pages, centred at the foot of the screen,
 * with two capsules tucked behind its ends. The one on the right unrolls into the current page's
 * actions; on a recipe or Settings, a back button slides out from behind the left end. The pill
 * shrinks to the current page while the page scrolls down, and the current tab's icon does its
 * own small thing as it's chosen (index.css, the nav- rules).
 */
export const NavIsland: React.FC<NavIslandProps> = (props) => {
  const {
    page,
    litTab,
    onRecipe,
    onSelectTab,
    deckTabs,
    deck,
    onActionsOpen,
    showBack,
    backLabel,
    photoOpen,
    onBack,
    t,
  } = props;
  const [state, setState] = useState<MenuState>('closed');
  const actionsRef = useRef<HTMLButtonElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const isOpen = state === 'open';

  // Until it first appears there's nothing to slide away, so it starts tucked without a motion.
  const [backEverShown, setBackEverShown] = useState(false);
  const backOut = showBack || photoOpen;
  if (backOut && !backEverShown) setBackEverShown(true);

  // While the page scrolls down the pill shrinks to the current page; scrolling up opens it out.
  // It belongs to the page it shrank on: any other page starts with it open. The jump to a
  // page's remembered spot as it arrives isn't the reader scrolling, so a moment is let pass.
  const view = onRecipe ? 'recipe' : page;
  const [compactOn, setCompactOn] = useState<string | null>(null);
  // Leaving the page forgets it, so the next page of the same kind (another recipe) starts open.
  const [compactView, setCompactView] = useState(view);
  if (compactView !== view) {
    setCompactView(view);
    setCompactOn(null);
  }
  const compact = compactOn === view && state === 'closed' && !photoOpen;
  const viewRef = useRef(view);
  const viewSince = useRef(0);
  useEffect(() => {
    viewRef.current = view;
    viewSince.current = performance.now();
  }, [view]);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - last;
      if (Math.abs(dy) < 6) return;
      last = y;
      if (performance.now() - viewSince.current < 700) return;
      setCompactOn(dy > 0 && y > 160 ? viewRef.current : null);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = useCallback(() => {
    setState('closing');
    actionsRef.current?.focus({ preventScroll: true });
  }, []);

  // The phone's back gesture closes an open panel first, like its back button.
  useBackStep(isOpen, close);

  // The highlight stretches from one tab to the next, its leading edge first. It rests by a
  // custom property (index.css); the stretch plays over that once, on the compositor.
  const lit = TABS.indexOf(litTab);
  const prevLit = useRef(lit);
  useLayoutEffect(() => {
    const from = prevLit.current;
    prevLit.current = lit;
    const ind = indRef.current;
    if (from === lit || !ind || prefersReducedMotion() || !ind.animate) return;
    const w = ind.offsetWidth;
    const a = from * w;
    const d = (lit - from) * w;
    const left = a + (d > 0 ? 0.25 : 0.75) * d;
    const width = w + 0.5 * Math.abs(d);
    ind.animate(
      [
        { transform: `translateX(${a}px)` },
        { transform: `translateX(${left}px) scaleX(${width / w})`, offset: 0.42 },
        { transform: `translateX(${lit * w}px)` },
      ],
      { duration: 480, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' },
    );
  }, [lit]);

  // Dragging a thumb along the pill moves the highlight under it, with a tick at each tab;
  // letting go there chooses it.
  const drag = useRef<{ x: number; over: number; moving: boolean } | null>(null);
  const dragged = useRef(false);
  // The tabs start past the pill's padding, where the highlight rests (its offsetLeft).
  const tabAt = (clientX: number, nav: HTMLElement, ind: HTMLElement) => {
    const x = clientX - nav.getBoundingClientRect().left - ind.offsetLeft;
    return Math.max(0, Math.min(TABS.length - 1, Math.floor(x / ind.offsetWidth)));
  };
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    // A drag's own click may never arrive (the pointer was captured), so it's forgotten here.
    dragged.current = false;
    if (compact || e.pointerType === 'mouse') return;
    drag.current = { x: e.clientX, over: lit, moving: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const ind = indRef.current;
    if (!d || !ind) return;
    if (!d.moving) {
      if (Math.abs(e.clientX - d.x) < 8) return;
      d.moving = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const nav = e.currentTarget;
    const w = ind.offsetWidth;
    const x = e.clientX - nav.getBoundingClientRect().left - ind.offsetLeft - w / 2;
    ind.style.transform = `translateX(${Math.max(0, Math.min((TABS.length - 1) * w, x))}px)`;
    const over = tabAt(e.clientX, nav, ind);
    if (over !== d.over) {
      d.over = over;
      tick();
      nav.children[over + 1]
        ?.querySelector('.nav-icon')
        ?.animate?.([{ scale: '1' }, { scale: '1.22' }, { scale: '1' }], {
          duration: 260,
          easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
        });
    }
  };
  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moving) return;
    dragged.current = true;
    // Let go back on the current tab, or cut short, the drag chooses nothing.
    const chosen = e.type === 'pointerup' && d.over !== lit;
    const to = chosen ? d.over : lit;
    const ind = indRef.current;
    if (ind) {
      const from = ind.style.transform;
      ind.style.removeProperty('transform');
      ind.animate?.([{ transform: from }, { transform: `translateX(${to * ind.offsetWidth}px)` }], {
        duration: 320,
        easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      });
    }
    if (chosen) selectTab(TABS[d.over]);
  };

  // A page chosen with the panel open takes the panel away with the page it belonged to.
  const selectTab = (target: MainPage) => {
    if (isOpen) setState('closing');
    onSelectTab(target);
  };

  const chooseTab = (target: MainPage) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (TABS[lit] !== target) tick();
    selectTab(target);
  };

  const back = photoOpen ? 'photo' : backOut ? 'out' : backEverShown ? 'in' : 'none';
  const tabLabels: Record<MainPage, string> = {
    counter: t.navCounter,
    recipes: t.navRecipes,
    makes: t.navMakes,
  };
  const tabNames: Record<MainPage, string> = {
    counter: t.counter,
    recipes: t.recipeVault,
    makes: t.makes,
  };

  return (
    <>
      <div
        ref={islandRef}
        className="nav-island"
        data-back={back}
        data-menu={state === 'closed' ? undefined : state}
        data-compact={compact ? '' : undefined}
        data-recipe={onRecipe ? '' : undefined}
        style={{ '--lit': lit } as React.CSSProperties}
      >
        {state !== 'closed' && (
          <ActionsPanel
            {...props}
            id={panelId}
            isClosing={state === 'closing'}
            onClose={close}
            onFocusLeave={() => setState('closing')}
            onClosed={() => setState('closed')}
            islandRef={islandRef}
          />
        )}

        {/* Over a photo, the photo's dialog holds the same close for the keyboard and screen
            readers, so this one is for pointers only there. */}
        <button
          type="button"
          className="nav-cap nav-back"
          aria-label={photoOpen ? t.closePhotoPreview : isOpen ? t.closeMenu : backLabel}
          aria-hidden={!backOut || photoOpen || undefined}
          tabIndex={photoOpen ? -1 : undefined}
          inert={!backOut}
          onClick={() => {
            // With the panel open, back steps out of the panel only, leaving the page showing.
            if (isOpen) {
              close();
              return;
            }
            // It's about to tuck away, so keyboard focus moves to the actions button.
            actionsRef.current?.focus({ preventScroll: true });
            onBack();
          }}
        >
          <ArrowLeft className="nav-back-arrow" size="1.4em" strokeWidth={2.2} aria-hidden="true" />
        </button>

        <div className="nav-pill" inert={photoOpen} aria-hidden={photoOpen || undefined}>
          <span className="nav-shade" aria-hidden="true" />
          <span className="nav-shade is-compact" aria-hidden="true" />
          <span className="nav-mid" aria-hidden="true" />
          <span className="nav-end is-left" aria-hidden="true" />
          <span className="nav-end is-right" aria-hidden="true" />
          <nav
            className="nav-tabs"
            aria-label={t.pages}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={(e) => {
              // A tap on the shrunk pill only opens it out again.
              if (!compact) return;
              e.preventDefault();
              e.stopPropagation();
              setCompactOn(null);
            }}
          >
            <span ref={indRef} className="nav-ind" aria-hidden="true" />
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className="nav-tab"
                aria-label={tabNames[tab]}
                aria-current={tab === litTab && page !== 'settings' ? 'page' : undefined}
                data-lit={tab === litTab ? '' : undefined}
                data-tab={tab}
                // On a tablet the Recipe Box and Makes tabs raise their card decks (NavDeck).
                data-deck={tab === deck ? '' : undefined}
                aria-haspopup={deckTabs.includes(tab) ? 'dialog' : undefined}
                aria-expanded={deckTabs.includes(tab) ? tab === deck : undefined}
                onClick={() => chooseTab(tab)}
              >
                <NavTabIcon page={tab} />
                <span className="nav-tab-label" aria-hidden="true">
                  {tabLabels[tab]}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <button
          ref={actionsRef}
          type="button"
          id="navActionsBtn"
          className="nav-cap nav-actions"
          aria-hidden={photoOpen || undefined}
          inert={photoOpen}
          aria-label={isOpen ? t.closeMenu : t.openMenu}
          aria-expanded={isOpen}
          aria-controls={state !== 'closed' ? panelId : undefined}
          onClick={() => {
            if (isOpen) {
              close();
              return;
            }
            onActionsOpen();
            setState('open');
          }}
        >
          <span className="nav-glyph" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>
    </>
  );
};

interface ActionsPanelProps extends NavIslandProps {
  id: string;
  isClosing: boolean;
  onClose: () => void;
  onFocusLeave: () => void;
  onClosed: () => void;
  /** The island: focus can move to its buttons without closing the panel. */
  islandRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The panel unrolls up out of the actions capsule, tucked behind the pill like it (index.css,
 * nav-panel-in): it starts as the capsule's own shape and grows to its full size, so the capsule
 * becomes the panel's corner. It only needs measuring for where that shape sits.
 */
function measureCapsule(panel: HTMLElement) {
  const cap = panel.parentElement?.querySelector<HTMLElement>('.nav-actions');
  if (!cap) return;
  panel.style.setProperty('--cap-top', `${panel.offsetHeight - cap.offsetHeight}px`);
  panel.style.setProperty('--cap-left', `${panel.offsetWidth - cap.offsetWidth}px`);
}

// Mounted only while open (or animating closed).
const ActionsPanel: React.FC<ActionsPanelProps> = ({
  id,
  isClosing,
  onClose,
  onFocusLeave,
  onClosed,
  islandRef,
  page: livePage,
  onRecipe: liveOnRecipe,
  onOpenSettings,
  actions: liveActions,
  panelTitle: liveTitle,
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
  // Settings chosen here changes the page while the panel is still up (it closes as the new
  // page fades in beneath it), so it keeps showing what it opened on, not rearranging mid-fade.
  const [opened] = useState({
    page: livePage,
    onRecipe: liveOnRecipe,
    actions: liveActions,
    title: liveTitle,
  });
  const same = livePage === opened.page && liveOnRecipe === opened.onRecipe;
  const { page, onRecipe, actions, title } = same
    ? { page: livePage, onRecipe: liveOnRecipe, actions: liveActions, title: liveTitle }
    : opened;
  const titleId = useId();
  const prefsDrawerId = useId();
  const darkLabelId = useId();
  const textLabelId = useId();
  // Starts folded each time the panel opens, so the actions stay the first thing in reach.
  const [prefsOpen, setPrefsOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  // Stable callback ref, so focus moves to the first action once on open, not on every render.
  const focusFirst = useCallback((panel: HTMLDivElement | null) => {
    panelRef.current = panel;
    if (!panel) return;
    measureCapsule(panel);
    panel.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, []);
  // The panel can grow while it's open (preferences, text size), so it rolls up from its size now.
  useLayoutEffect(() => {
    if (isClosing && panelRef.current) measureCapsule(panelRef.current);
  }, [isClosing]);

  const openSettings = () => {
    onOpenSettings();
    void transitionStarted().then(onClose);
  };

  const TitleIcon: React.ComponentType<{ size?: string | number; strokeWidth?: number }> = onRecipe
    ? RecipeCardIcon
    : page === 'settings'
      ? Settings
      : page === 'recipes'
        ? RecipeBoxIcon
        : page === 'makes'
          ? CookingPot
          : ChefHat;

  // The rows rise in from the bottom up, following the unroll out of the capsule.
  let row = 0;
  const rise = () => ({ '--i': row++ }) as React.CSSProperties;
  let fold = 0;
  const unfold = () => ({ '--j': fold++ }) as React.CSSProperties;

  return (
    <>
      {createPortal(
        // Backdrop click is a mouse/touch shortcut; keyboard users close with Escape or the button.
        <div
          className={`fk-menu-layer nav-scrim ${isClosing ? 'is-closing' : ''}`}
          {...backdropProps}
        />,
        document.body,
      )}
      <div
        ref={focusFirst}
        id={id}
        role="dialog"
        aria-label={t.menu}
        className={`fk-menu-panel nav-panel ${isClosing ? 'is-closing' : ''}`}
        onBlur={(e) => {
          // Close when keyboard focus leaves for the page behind the scrim. A tap on a
          // non-focusable part of the panel has no relatedTarget and keeps it open.
          const next = e.relatedTarget;
          if (
            !isClosing &&
            next instanceof Node &&
            !e.currentTarget.contains(next) &&
            !islandRef.current?.contains(next)
          ) {
            onFocusLeave();
          }
        }}
        onAnimationEnd={(e) => {
          if (isClosing && e.target === e.currentTarget) onClosed();
        }}
      >
        <div className="nav-panel-body">
          <div id={titleId} className="nav-panel-title fk-menu-row" style={rise()}>
            <span className="nav-panel-chip" aria-hidden="true">
              <TitleIcon size="1.15em" strokeWidth={onRecipe || page === 'recipes' ? 1.75 : 1.9} />
            </span>
            <span className="nav-panel-name">{title}</span>
          </div>

          {actions.length > 0 && (
            <ul className="fk-menu-actions nav-panel-actions" aria-labelledby={titleId}>
              {actions.map(({ id: actionId, label, icon: Icon, onSelect, wide }) => (
                <li
                  key={actionId}
                  className={`fk-menu-row ${wide ? 'is-wide' : ''}`}
                  style={rise()}
                >
                  <button
                    type="button"
                    className="fk-menu-action"
                    onClick={() => {
                      onClose();
                      onSelect();
                    }}
                  >
                    <Icon
                      className="fk-menu-action-icon"
                      size="1.15em"
                      strokeWidth={2.1}
                      aria-hidden="true"
                    />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div
            className="fk-menu-content nav-panel-foot"
            data-prefs={prefsOpen ? 'open' : 'closed'}
          >
            <div className="nav-panel-settings fk-menu-row" style={rise()}>
              {page !== 'settings' && (
                <button type="button" className="fk-menu-item" onClick={openSettings}>
                  <span className="fk-menu-chip" aria-hidden="true">
                    <Settings size="1.1em" strokeWidth={1.9} />
                  </span>
                  <span className="fk-menu-item-label">{t.settings}</span>
                </button>
              )}
              <button
                type="button"
                className="fk-prefs-toggle"
                aria-label={t.preferences}
                aria-expanded={prefsOpen}
                aria-controls={prefsDrawerId}
                onClick={() => setPrefsOpen((open) => !open)}
              >
                <span className="fk-prefs-key">
                  <PrefsGlyph />
                </span>
              </button>
            </div>

            <div
              id={prefsDrawerId}
              className="fk-prefs-drawer"
              role="group"
              aria-label={t.preferences}
              inert={!prefsOpen}
            >
              <div className="fk-prefs-clip">
                <div className="fk-prefs-body">
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
                    {/* The splash's sun and moon pill, the size of its neighbours. */}
                    <button
                      type="button"
                      role="switch"
                      className="fk-segmented"
                      data-value={theme}
                      aria-checked={theme === 'dark'}
                      aria-labelledby={darkLabelId}
                      onClick={(e) => {
                        const pill = e.currentTarget.getBoundingClientRect();
                        onToggleTheme({
                          x: pill.left + pill.width / 2,
                          y: pill.top + pill.height / 2,
                        });
                      }}
                    >
                      <span className="fk-segmented-thumb" aria-hidden="true" />
                      <span className={theme === 'light' ? 'is-active' : ''}>
                        <Sun size="1.45em" strokeWidth={2} aria-hidden="true" />
                      </span>
                      <span className={theme === 'dark' ? 'is-active' : ''}>
                        <Moon size="1.35em" strokeWidth={2} aria-hidden="true" />
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
          </div>
        </div>
      </div>
    </>
  );
};
