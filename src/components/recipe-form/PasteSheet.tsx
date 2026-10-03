import React, { useId, useState } from 'react';
import { CaseSensitive, ClipboardPaste, Globe } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { ImportProblem } from '../../services/importRecipe';
import { PasteTarget, PasteTextPanel } from './PasteTextPanel';
import { PasteWebsitePanel } from './PasteWebsitePanel';

export type { PasteTarget } from './PasteTextPanel';
type PasteSource = 'website' | 'text';

interface PasteSheetProps {
  /** Adds the pasted lists (either may be empty). */
  onAdd: (text: Record<PasteTarget, string>) => void;
  /**
   * Fills the form from a recipe page. Resolves with what went wrong, or null once it's filled
   * in. Missing where websites can't be read (no import worker), which leaves pasting text.
   */
  onImport?: (url: string) => Promise<ImportProblem | null>;
  /** The form already has something in it, which a website's recipe would replace. */
  replaces?: boolean;
  onClose: () => void;
  t: UiTranslations;
}

/**
 * Pasting a recipe: the address of a web page it's on (the form is filled in from the page), or
 * its text (an ingredient list and the steps, each kept in its own box until Add).
 */
export const PasteSheet: React.FC<PasteSheetProps> = ({
  onAdd,
  onImport,
  replaces = false,
  onClose,
  t,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  // Lifts the sheet above the phone's keyboard, which would otherwise cover it.
  useKeyboardInset(ref);
  const titleId = useId();
  const [source, setSource] = useState<PasteSource>(onImport ? 'website' : 'text');
  const [busy, setBusy] = useState(false);

  const sourceChoice = onImport && (
    <fieldset className="editor-sheet-choice" disabled={busy}>
      <legend className="form-label is-small">{t.pasteFrom}</legend>
      <div className="choice-pill" data-value={source}>
        <span className="choice-pill-thumb" aria-hidden="true" />
        {(['website', 'text'] as const).map((option) => (
          <label key={option} className={source === option ? 'is-active' : ''}>
            <input
              type="radio"
              name={`${titleId}-source`}
              checked={source === option}
              onChange={() => setSource(option)}
            />
            <span className="choice-pill-icon">
              {option === 'website' ? (
                <Globe size="1.15em" aria-hidden="true" />
              ) : (
                <CaseSensitive size="1.35em" aria-hidden="true" />
              )}
              {option === 'website' ? t.pasteFromWebsite : t.pasteFromText}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={ref}
      className={`editor-sheet-layer${isClosing ? ' is-closing' : ''}`}
      {...backdropProps}
    >
      <div
        className="editor-sheet is-paste"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="editor-sheet-grip" aria-hidden="true" />
        <h3 className="editor-sheet-title" id={titleId}>
          <ClipboardPaste size="1.1em" aria-hidden="true" />
          {t.pasteTitle}
        </h3>

        {sourceChoice}

        {/* Keyed by the source, so each side fades in as it's chosen. */}
        {source === 'website' && onImport ? (
          <PasteWebsitePanel
            key="website"
            onImport={onImport}
            onDone={requestClose}
            onCancel={requestClose}
            replaces={replaces}
            onBusyChange={setBusy}
            t={t}
          />
        ) : (
          <PasteTextPanel
            key="text"
            onAdd={(text) => {
              onAdd(text);
              requestClose();
            }}
            onCancel={requestClose}
            t={t}
          />
        )}
      </div>
    </div>
  );
};
