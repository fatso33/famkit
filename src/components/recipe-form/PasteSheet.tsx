import React, { useEffect, useId, useRef, useState } from 'react';
import { CaseSensitive, ClipboardPaste, Globe, LoaderCircle } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { importAddress } from '../../utils/recipeImport';

export type PasteTarget = 'ingredients' | 'steps';
type PasteSource = 'website' | 'text';
export type ImportProblem = keyof UiTranslations['importErrors'];

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
  const fieldId = useId();
  const helpId = useId();
  const errorId = useId();
  const textField = useRef<HTMLTextAreaElement>(null);
  const urlField = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<PasteSource>(onImport ? 'website' : 'text');
  const [target, setTarget] = useState<PasteTarget>('ingredients');
  // Each list keeps its own text, so both can be pasted before adding.
  const [text, setText] = useState<Record<PasteTarget, string>>({ ingredients: '', steps: '' });
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);

  // Text is typed or pasted straight away; an address is usually pasted with the button, so the
  // keyboard stays down until its field is tapped.
  useEffect(() => {
    if (source === 'text') textField.current?.focus({ preventScroll: true });
  }, [source, target]);

  const pasteAddress = async () => {
    try {
      const copied = (await navigator.clipboard.readText()).trim();
      if (!copied) throw new Error('Nothing copied');
      setUrl(copied);
      setProblem(null);
    } catch {
      // No permission, or a browser without clipboard reading: the field's own paste still works.
      setProblem(t.clipboardUnavailable);
      urlField.current?.focus({ preventScroll: true });
    }
  };

  const importFromWebsite = async () => {
    if (!onImport || busy) return;
    const address = importAddress(url);
    if (!address) {
      setProblem(t.importErrors.badAddress);
      urlField.current?.focus({ preventScroll: true });
      return;
    }
    setProblem(null);
    setBusy(true);
    const failure = await onImport(address);
    // Closed meanwhile: there's no sheet left to update or close.
    if (!open.current) return;
    setBusy(false);
    if (failure) setProblem(t.importErrors[failure]);
    else requestClose();
  };

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
              onChange={() => {
                setSource(option);
                setProblem(null);
              }}
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

        {source === 'website' ? (
          // Keyed by the source, so each side fades in as it's chosen.
          <form
            key="website"
            className="paste-panel"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void importFromWebsite();
            }}
          >
            <label className="form-label is-small" htmlFor={fieldId}>
              {t.pasteUrlLabel}
            </label>
            <div className="paste-url-row">
              <input
                ref={urlField}
                id={fieldId}
                className="form-control"
                type="url"
                inputMode="url"
                enterKeyHint="go"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://"
                disabled={busy}
                aria-invalid={Boolean(problem) || undefined}
                aria-describedby={problem ? `${errorId} ${helpId}` : helpId}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setProblem(null);
                }}
              />
              <button
                type="button"
                className="editor-chip"
                disabled={busy}
                aria-label={t.pasteUrlFromClipboard}
                onClick={() => void pasteAddress()}
              >
                <ClipboardPaste size="1.15em" aria-hidden="true" />
                {t.paste}
              </button>
            </div>
            {problem && (
              <p className="field-error" id={errorId} role="alert">
                {problem}
              </p>
            )}
            <p className="editor-sheet-help" id={helpId}>
              {t.pasteHelpWebsite}
              {replaces && <strong> {t.pasteWebsiteReplaces}</strong>}
            </p>

            <div className="editor-sheet-actions">
              <button type="button" className="btn" onClick={requestClose}>
                {t.cancel}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!url.trim()}
                // Still focusable while it works, so the screen reader hears what it's doing.
                aria-disabled={busy || undefined}
                aria-busy={busy || undefined}
              >
                {busy && (
                  <LoaderCircle className="paste-spinner" size="1.15em" aria-hidden="true" />
                )}
                {busy ? t.importing : t.pasteAdd}
              </button>
            </div>
          </form>
        ) : (
          <div key="text" className="paste-panel">
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
              <button type="button" className="btn" onClick={requestClose}>
                {t.cancel}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!text.ingredients.trim() && !text.steps.trim()}
                onClick={() => {
                  onAdd(text);
                  requestClose();
                }}
              >
                {t.pasteAdd}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
