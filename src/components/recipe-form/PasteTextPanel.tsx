import React, { useEffect, useId, useRef, useState } from 'react';
import { UiTranslations } from '../../i18n/translations';

export type PasteTarget = 'ingredients' | 'steps';

interface PasteTextPanelProps {
  /** Adds the pasted lists (either may be empty); its sheet then closes. */
  onAdd: (text: Record<PasteTarget, string>) => void;
  onCancel: () => void;
  t: UiTranslations;
}

/**
 * A recipe's text, pasted or typed: an ingredient list and the steps, each kept in its own box
 * until Add.
 */
export const PasteTextPanel: React.FC<PasteTextPanelProps> = ({ onAdd, onCancel, t }) => {
  const nameId = useId();
  const fieldId = useId();
  const helpId = useId();
  const textField = useRef<HTMLTextAreaElement>(null);
  const [target, setTarget] = useState<PasteTarget>('ingredients');
  // Each list keeps its own text, so both can be pasted before adding.
  const [text, setText] = useState<Record<PasteTarget, string>>({ ingredients: '', steps: '' });

  // Text is typed or pasted straight away.
  useEffect(() => {
    textField.current?.focus({ preventScroll: true });
  }, [target]);

  return (
    <div className="paste-panel">
      <fieldset className="editor-sheet-choice">
        <legend className="form-label is-small">{t.pasteInto}</legend>
        <div className="choice-pill" data-value={target}>
          <span className="choice-pill-thumb" aria-hidden="true" />
          {(['ingredients', 'steps'] as const).map((option) => (
            <label key={option} className={target === option ? 'is-active' : ''}>
              <input
                type="radio"
                name={`${nameId}-target`}
                checked={target === option}
                onChange={() => setTarget(option)}
              />
              <span className="choice-pill-icon">
                {option === 'ingredients' ? t.ingredients : t.stepsHeading}
                {/* What's waiting in the other box isn't forgotten. */}
                {text[option].trim() && <span className="paste-filled" aria-hidden="true" />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="form-label is-small" htmlFor={fieldId}>
        {t.pasteTextLabel}
      </label>
      <textarea
        ref={textField}
        id={fieldId}
        className="form-control editor-sheet-text"
        rows={5}
        aria-describedby={helpId}
        value={text[target]}
        onChange={(e) => setText({ ...text, [target]: e.target.value })}
      />
      <p className="editor-sheet-help" id={helpId}>
        {target === 'ingredients' ? t.pasteHelpIngredients : t.pasteHelpSteps}
      </p>

      <div className="editor-sheet-actions">
        <button type="button" className="btn" onClick={onCancel}>
          {t.cancel}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!text.ingredients.trim() && !text.steps.trim()}
          onClick={() => onAdd(text)}
        >
          {t.pasteAdd}
        </button>
      </div>
    </div>
  );
};
