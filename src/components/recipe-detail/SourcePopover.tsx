import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Globe } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { useAnchoredPlacement } from '../../hooks/useAnchoredPlacement';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { sourceHost } from '../../utils/recipeForm';

/** The page's path as people read it ("/2024/03/babka"), or '' for a site's front page. */
function readablePath(url: string): string {
  const { pathname, search } = new URL(url);
  const path = `${pathname}${search}`.replace(/\/$/, '');
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

interface SourcePopoverProps {
  /** The chip it springs out of. */
  anchor: HTMLElement;
  /** An http(s) address (checked by the caller). */
  url: string;
  t: UiTranslations;
  onClose: () => void;
}

/**
 * Asks before a recipe's source page opens, springing out of its chip as the remix popover does
 * (same look, same placement, over the chip when the page's foot leaves no room under it). The
 * page opens in the browser, with no way back into the app's window (noopener). Focus starts on
 * "Not now"; a tap outside, Escape or the back gesture closes it, and focus returns to the chip.
 */
export const SourcePopover: React.FC<SourcePopoverProps> = ({ anchor, url, t, onClose }) => {
  const { ref: layerRef, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useAnchoredPlacement(anchor, panelRef);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    return () => anchor.focus({ preventScroll: true });
  }, [anchor]);

  const path = readablePath(url);
  const open = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    requestClose();
  };

  return createPortal(
    <div ref={layerRef} className={`remix-pop-layer${isClosing ? ' is-closing' : ''}`}>
      {/* A tap outside closes it; keyboard users close it with Escape (useDialogDismiss). */}
      <div className="remix-pop-catcher" aria-hidden="true" {...backdropProps} />
      <div
        ref={panelRef}
        className="remix-pop source-pop"
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="remix-pop-title">
          <Globe size="1.05em" strokeWidth={2} />
          <span>{t.sourceOpenTitle}</span>
        </h2>
        <p className="source-pop-host">{sourceHost(url)}</p>
        {path && <p className="source-pop-path">{path}</p>}
        <p id={bodyId} className="source-pop-body">
          {t.sourceOpenBody}
        </p>
        <div className="source-pop-keys">
          <button type="button" className="source-pop-key" onClick={requestClose}>
            {t.sourceNotNow}
          </button>
          <button type="button" className="source-pop-key is-go" onClick={open}>
            {t.sourceOpen}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
