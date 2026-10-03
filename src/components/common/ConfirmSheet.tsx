import React, { useEffect, useId, useRef } from 'react';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { useInertBehind } from '../../hooks/useInertBehind';

interface ConfirmSheetProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  /** A third choice, offered first (e.g. "Save draft" before "Discard"). */
  alternative?: { label: string; onSelect: () => void };
  /** Runs once the sheet has closed, whichever way. */
  onClose: () => void;
}

/**
 * Asks before something that can't simply be undone. Mount only while open. Focus starts on the
 * safe choice, so a stray Enter keeps things as they are. With an alternative, the three choices
 * stack: the alternative, then the confirm, then the safe choice.
 */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  alternative,
  onClose,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  // The back gesture closes the sheet, like its safe choice.
  useBackStep(true, () => requestClose());
  // What it's asked over (the editor's bar and page) is out of reach until it closes. Before the
  // focus hand-back below, so the opener is reachable again by the time focus returns to it.
  useInertBehind(ref);
  const titleId = useId();
  const messageId = useId();
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancel.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);

  const safe = (
    <button ref={cancel} type="button" className="btn" onClick={requestClose}>
      {cancelLabel}
    </button>
  );

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={ref}
      className={`editor-sheet-layer${isClosing ? ' is-closing' : ''}`}
      {...backdropProps}
    >
      <div
        className="editor-sheet is-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <div className="editor-sheet-grip" aria-hidden="true" />
        <h3 className="editor-sheet-title" id={titleId}>
          {title}
        </h3>
        <p className="editor-sheet-message" id={messageId}>
          {message}
        </p>
        <div className={`editor-sheet-actions${alternative ? ' is-stacked' : ''}`}>
          {alternative && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                alternative.onSelect();
                requestClose();
              }}
            >
              {alternative.label}
            </button>
          )}
          {!alternative && safe}
          <button
            type="button"
            // Under a main choice, a destructive one is quieter.
            className={`btn ${danger ? (alternative ? 'btn-danger-quiet' : 'btn-danger') : 'btn-primary'}`}
            onClick={() => {
              onConfirm();
              requestClose();
            }}
          >
            {confirmLabel}
          </button>
          {alternative && safe}
        </div>
      </div>
    </div>
  );
};
