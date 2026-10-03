import React, { useEffect, useId, useRef } from 'react';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { useInertBehind } from '../../hooks/useInertBehind';

interface ChangeNoteSheetProps {
  /** "Saving version 5". */
  title: string;
  /** "What changed since v4?" */
  label: string;
  note: string;
  onNote: (note: string) => void;
  onSave: () => void;
  /** Runs once the sheet has closed, whichever way. */
  onClose: () => void;
  t: UiTranslations;
}

/**
 * Asked as an edit is saved: what changed, in a line kept with the new version in its history.
 * It's optional, so Save saves either way (Enter too); Keep editing goes back to the page.
 * Mount only while open.
 */
export const ChangeNoteSheet: React.FC<ChangeNoteSheetProps> = ({
  title,
  label,
  note,
  onNote,
  onSave,
  onClose,
  t,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  // The editor under it is out of reach until it closes (before the focus hand-back below).
  useInertBehind(ref);
  const titleId = useId();
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    field.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);

  const save = () => {
    onSave();
    requestClose();
  };

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={ref}
      className={`editor-sheet-layer${isClosing ? ' is-closing' : ''}`}
      {...backdropProps}
    >
      <div
        className="editor-sheet is-change-note"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="editor-sheet-grip" aria-hidden="true" />
        <h3 className="editor-sheet-title" id={titleId}>
          {title}
        </h3>
        <div className="form-label-row">
          <label className="form-label" htmlFor={fieldId}>
            {label}
          </label>
          <span className="form-optional" aria-hidden="true">
            {t.optional}
          </span>
        </div>
        <input
          ref={field}
          id={fieldId}
          className="form-control"
          type="text"
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              save();
            }
          }}
        />
        <div className="editor-sheet-actions">
          <button type="button" className="btn" onClick={requestClose}>
            {t.keepEditing}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};
