import React, { useEffect } from 'react';
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

  useEffect(() => {
    const chosen = ref.current?.querySelector<HTMLElement>(
      '[aria-pressed="true"], [aria-checked="true"]',
    );
    chosen?.focus({ preventScroll: true });
  }, [ref]);

  return (
    <div ref={ref} className={`vault-popover-layer${isClosing ? ' is-closing' : ''}`}>
      {/* A tap outside closes the menu; keyboard users close it with Escape (useDialogDismiss). */}
      <div className="vault-popover-catcher" aria-hidden="true" {...backdropProps} />
      <div
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
