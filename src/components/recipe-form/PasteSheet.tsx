import React, { useEffect, useId, useRef, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';

export type PasteTarget = 'ingredients' | 'steps';

interface PasteSheetProps {
  onAdd: (target: PasteTarget, text: string) => void;
  onClose: () => void;
  t: UiTranslations;
}

/** Pasting a list from a message or website: each line becomes an ingredient or a step. */
export const PasteSheet: React.FC<PasteSheetProps> = ({ onAdd, onClose, t }) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  const titleId = useId();
  const fieldId = useId();
  const helpId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [target, setTarget] = useState<PasteTarget>('ingredients');
  const [text, setText] = useState('');

  useEffect(() => {
    field.current?.focus({ preventScroll: true });
  }, []);

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={ref}
      className={`editor-sheet-layer${isClosing ? ' is-closing' : ''}`}
      {...backdropProps}
    >
      <div className="editor-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="editor-sheet-grip" aria-hidden="true" />
        <h3 className="editor-sheet-title" id={titleId}>
          <ClipboardPaste size="1.1em" aria-hidden="true" />
          {t.pasteTitle}
        </h3>

        <fieldset className="editor-sheet-choice">
          <legend className="form-label is-small">{t.pasteInto}</legend>
          <div className="choice-pill" data-value={target}>
            <span className="choice-pill-thumb" aria-hidden="true" />
            {(['ingredients', 'steps'] as const).map((option) => (
              <label key={option} className={target === option ? 'is-active' : ''}>
                <input
                  type="radio"
                  name={`${titleId}-target`}
                  checked={target === option}
                  onChange={() => setTarget(option)}
                />
                {option === 'ingredients' ? t.ingredients : t.stepsHeading}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="form-label is-small" htmlFor={fieldId}>
          {t.pasteTextLabel}
        </label>
        <textarea
          ref={field}
          id={fieldId}
          className="form-control editor-sheet-text"
          rows={6}
          aria-describedby={helpId}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="editor-sheet-help" id={helpId}>
          {target === 'ingredients' ? t.pasteHelpIngredients : t.pasteHelpSteps}
        </p>

        <div className="editor-sheet-actions">
          <button type="button" className="btn" onClick={requestClose}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!text.trim()}
            onClick={() => {
              onAdd(target, text);
              requestClose();
            }}
          >
            {t.pasteAdd}
          </button>
        </div>
      </div>
    </div>
  );
};
