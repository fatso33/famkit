import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';

/** One link in the popover: a recipe, or a make. */
export interface PopoverLink {
  id: string;
  name: string;
  /** Under the name, e.g. who made it. */
  byline: string;
  /** Its little picture: a photo, or the recipe's category tile. */
  thumb: React.ReactNode;
}

interface LinkPopoverProps {
  /** The mark or badge it springs out of. */
  anchor: HTMLElement;
  title: string;
  /** The badge's own icon, beside the title. */
  icon: React.ComponentType<{ size?: string | number; strokeWidth?: number }>;
  links: PopoverLink[];
  /** Shown in place of the links when there are none (the original was deleted). */
  emptyText?: string;
  /** Opens a link, given the name that was tapped (it flies into the page it opens). */
  onOpen: (id: string, name: HTMLElement) => void;
  onClose: () => void;
}

/** Space kept between the popover and the screen's edges, in px. */
const EDGE = 16;
/** Its gap under the mark it springs from, in px. */
const GAP = 10;

/**
 * A small card of links springing out of a recipe's remix mark or badge (to the original, or to
 * its remixes), or its make badge (to its makes). Mounted only while open. It lives on the page (it scrolls with it), placed under
 * the mark once as it opens, and grows out of the mark, animating only transform and opacity.
 * A tap outside, Escape or the back gesture closes it, and focus returns to the mark.
 */
export const LinkPopover: React.FC<LinkPopoverProps> = ({
  anchor,
  title,
  icon: Icon,
  links,
  emptyText,
  onOpen,
  onClose,
}) => {
  const { ref: layerRef, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Under the mark, as near its middle as the screen allows, before the first frame is drawn.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const place = () => {
      const mark = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const middle = mark.left + mark.width / 2;
      const left = Math.min(
        Math.max(EDGE, middle - width / 2),
        document.documentElement.clientWidth - EDGE - width,
      );
      panel.style.left = `${Math.round(left + window.scrollX)}px`;
      panel.style.top = `${Math.round(mark.bottom + GAP + window.scrollY)}px`;
      panel.style.setProperty('--pop-origin-x', `${Math.round(middle - left)}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  // Focus moves to the first link (or the card); the mark gets it back when it closes.
  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>('button') ?? panelRef.current;
    first?.focus({ preventScroll: true });
    return () => anchor.focus({ preventScroll: true });
  }, [anchor]);

  return createPortal(
    <div ref={layerRef} className={`remix-pop-layer${isClosing ? ' is-closing' : ''}`}>
      {/* A tap outside closes it; keyboard users close it with Escape (useDialogDismiss). */}
      <div className="remix-pop-catcher" aria-hidden="true" {...backdropProps} />
      <div
        ref={panelRef}
        className="remix-pop"
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="remix-pop-title">
          <Icon size="1.05em" strokeWidth={2} />
          <span>{title}</span>
          {links.length > 1 && <span className="remix-pop-count">{links.length}</span>}
        </h2>
        {links.length === 0 ? (
          <p className="remix-pop-empty">{emptyText}</p>
        ) : (
          <ul className="remix-pop-list">
            {links.map((link, i) => (
              <li key={link.id} style={{ '--i': i } as React.CSSProperties}>
                <button
                  type="button"
                  className="remix-pop-link"
                  onClick={(e) => {
                    const name = e.currentTarget.querySelector<HTMLElement>('.remix-pop-name');
                    onOpen(link.id, name ?? e.currentTarget);
                  }}
                >
                  <span className="remix-pop-thumb" aria-hidden="true">
                    {link.thumb}
                  </span>
                  <span className="remix-pop-text">
                    <span className="remix-pop-name">{link.name}</span>
                    <span className="remix-pop-cook">{link.byline}</span>
                  </span>
                  <ChevronRight
                    className="remix-pop-chevron"
                    size="1.1em"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
};
