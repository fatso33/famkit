import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';

interface VaultPopoverProps {
  label: string;
  /** How far the button it springs from is from the toolbar's right edge, in px. */
  originFromRight: number;
  /** Runs once it has closed (after its exit animation). */
  onClosed: () => void;
  /** Its contents, given a close() that plays the exit first. */
  children: (close: () => void) => React.ReactNode;
}

/**
 * A menu that springs out of a toolbar button (filter, sort). Mounted only while open. A tap
 * anywhere else, or Escape, closes it; the tap outside only closes it, so it can't also open a
 * recipe underneath by accident. Focus moves to the chosen option inside it.
 */
export const VaultPopover: React.FC<VaultPopoverProps> = ({
  label,
  originFromRight,
  onClosed,
  children,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClosed);
  const backdropProps = useDialogDismiss(requestClose);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The chosen option, or else the first thing in it (the filter menu's first field).
    const chosen =
      ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      ref.current?.querySelector<HTMLElement>('.vault-popover button');
    chosen?.focus({ preventScroll: true });
  }, [ref]);

  // It ends above the floating menu button (index.css, --popover-top), scrolling inside when a
  // list unfolds past there. Kept current as the page moves the toolbar it hangs from.
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const place = () => {
      // From its layout, not its box: it's still springing open (scaled) when first placed.
      const holder = popover.offsetParent ?? document.documentElement;
      const top = holder.getBoundingClientRect().top + popover.offsetTop;
      popover.style.setProperty('--popover-top', `${Math.max(0, Math.round(top))}px`);
    };
    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, []);

  return (
    <div ref={ref} className={`vault-popover-layer${isClosing ? ' is-closing' : ''}`}>
      {/* A tap outside closes the menu; keyboard users close it with Escape (useDialogDismiss). */}
      <div className="vault-popover-catcher" aria-hidden="true" {...backdropProps} />
      <div
        ref={popoverRef}
        className="vault-popover"
        role="dialog"
        aria-label={label}
        style={{ '--origin-right': `${originFromRight}px` } as React.CSSProperties}
      >
        {children(requestClose)}
      </div>
    </div>
  );
};
