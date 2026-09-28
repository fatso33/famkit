import React, { useEffect, useId, useRef } from 'react';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';

interface ConfirmSheetProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  /** Runs once the sheet has closed, whichever way. */
  onClose: () => void;
}

/**
 * Asks before something that can't simply be undone. Mount only while open. Focus starts on the
 * safe choice, so a stray Enter keeps things as they are.
 */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onClose,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  const titleId = useId();
  const messageId = useId();
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancel.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);

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
        <div className="editor-sheet-actions">
          <button ref={cancel} type="button" className="btn" onClick={requestClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              onConfirm();
              requestClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
