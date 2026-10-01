import React, { useLayoutEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { MainPage } from '../../types/navigation';
import { UiTranslations } from '../../i18n/translations';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';

/** The pages whose tabs raise a card deck on a tablet or desktop: the Recipe Box and Makes. */
export type DeckKind = Exclude<MainPage, 'counter'>;

interface NavDeckProps {
  kind: DeckKind;
  title: string;
  /** "See all": the deck opens out into its page, given the deck to open out of. */
  onViewAll: (deck: HTMLElement) => void;
  viewAllLabel: string;
  /** Folding back into its tab: mounted until that ends (onClosed). */
  closing: boolean;
  /** Folding away quickly, for the other deck to rise in its place. */
  swapping: boolean;
  /** Focus moving out to the page behind (NavDeckScrim takes taps and Escape). */
  onClose: () => void;
  onClosed: () => void;
  /** Its tools and cards, laid out by the deck (index.css, .nav-deck). */
  children: React.ReactNode;
  t: UiTranslations;
}

/** The tab on the navigation island that a deck rises out of and folds back into. */
const tabOf = (kind: DeckKind) =>
  document.querySelector<HTMLElement>(`.nav-island .nav-tab[data-tab="${kind}"]`);

/**
 * Where the deck grows from: a circle centred on its tab, at first just reaching the deck's
 * lower edge, at last its farthest corner (index.css, nav-deck-in). The same circle shrinks
 * back into the tab as it closes.
 */
function measureTab(deck: HTMLElement, kind: DeckKind) {
  const tab = tabOf(kind)?.getBoundingClientRect();
  const box = deck.getBoundingClientRect();
  if (!tab || !box.width) return;
  const x = tab.left + tab.width / 2 - box.left;
  const y = tab.top + tab.height / 2 - box.top;
  deck.style.setProperty('--from-x', `${Math.round(x)}px`);
  deck.style.setProperty('--from-y', `${Math.round(y)}px`);
  deck.style.setProperty('--from-r', `${Math.max(0, Math.round(y - box.height))}px`);
  deck.style.setProperty('--to-r', `${Math.ceil(Math.hypot(Math.max(x, box.width - x), y))}px`);
}

/**
 * A card deck: on a tablet or desktop, the Recipe Box and Makes tabs raise their page's cards
 * over whatever is on screen, out of the tab, as a deck to pick from (the cards are dealt in).
 * The tab again, a tap anywhere but the island, or Escape folds it back into the tab. Mounted
 * only while open (or folding away).
 */
export const NavDeck: React.FC<NavDeckProps> = ({
  kind,
  title,
  onViewAll,
  viewAllLabel,
  closing,
  swapping,
  onClose,
  onClosed,
  children,
  t,
}) => {
  const deckRef = useRef<HTMLDivElement>(null);
  // It's as tall as what it holds (index.css caps it), and never shorter than it has been while
  // open, so a search or filter narrowing it doesn't make it jump under the finger. Cards that
  // arrive later (a sync) still grow it.
  useLayoutEffect(() => {
    const deck = deckRef.current;
    if (!deck || closing) return;
    const { height } = deck.getBoundingClientRect();
    const held = parseFloat(deck.style.getPropertyValue('--deck-held')) || 0;
    if (height > held) deck.style.setProperty('--deck-held', `${height}px`);
  });
  // Opening, or rising again when its tab is tapped as it folds: it grows out of the tab, and
  // focus moves in, so the keyboard starts there. Folding: it shrinks back into the tab from
  // where it is now, and hands focus back to the tab.
  useLayoutEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    measureTab(deck, kind);
    if (!closing) deck.focus({ preventScroll: true });
    else if (deck.contains(document.activeElement)) tabOf(kind)?.focus({ preventScroll: true });
  }, [closing, kind]);

  return (
    <>
      <div
        ref={deckRef}
        role="dialog"
        aria-label={title}
        tabIndex={-1}
        className={`nav-deck${closing ? ' is-closing' : ''}${closing && swapping ? ' is-swapping' : ''}`}
        data-deck={kind}
        onBlur={(e) => {
          // Focus going out to the page behind closes it; to the island, it stays.
          const next = e.relatedTarget;
          if (
            !closing &&
            next instanceof Node &&
            !e.currentTarget.contains(next) &&
            !document.querySelector('.nav-island')?.contains(next)
          ) {
            onClose();
          }
        }}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) onClosed();
        }}
      >
        <div className="nav-deck-head">
          <h2 className="nav-deck-title">{title}</h2>
          <button
            type="button"
            className="counter-see-all nav-deck-all"
            aria-label={viewAllLabel}
            onClick={() => deckRef.current && onViewAll(deckRef.current)}
          >
            {t.seeAll}
            <ChevronRight size="1.05em" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
};

/**
 * The page under a card deck softens, as under the actions panel. A tap on it, or Escape, folds
 * the deck away. It stays up while one deck swaps for the other, clearing as the last one closes.
 */
export const NavDeckScrim: React.FC<{ closing: boolean; onClose: () => void }> = ({
  closing,
  onClose,
}) => {
  const backdropProps = useDialogDismiss(onClose);
  return (
    // Backdrop click is a mouse/touch shortcut; keyboard users close the deck with Escape.
    <div
      className={`fk-menu-layer nav-deck-scrim${closing ? ' is-closing' : ''}`}
      {...backdropProps}
    />
  );
};
