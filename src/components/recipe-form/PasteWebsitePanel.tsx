import React, { useEffect, useId, useRef, useState } from 'react';
import { ClipboardPaste, LoaderCircle } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { ImportProblem } from '../../services/importRecipe';
import { importAddress } from '../../utils/recipeImport';

interface PasteWebsitePanelProps {
  /**
   * Reads the recipe off the page. Resolves with what went wrong, or null once it's in: the
   * panel's sheet is then closed by whoever opened it (onDone).
   */
  onImport: (url: string) => Promise<ImportProblem | null>;
  onDone: () => void;
  onCancel: () => void;
  /** Something is written already, which the website's recipe would replace. */
  replaces?: boolean;
  /** Reading a page: the sheet keeps its other choices still meanwhile. */
  onBusyChange?: (busy: boolean) => void;
  t: UiTranslations;
}

/** The address of a web page with a recipe on it, pasted or typed, then read. */
export const PasteWebsitePanel: React.FC<PasteWebsitePanelProps> = ({
  onImport,
  onDone,
  onCancel,
  replaces = false,
  onBusyChange,
  t,
}) => {
  const fieldId = useId();
  const helpId = useId();
  const errorId = useId();
  const urlField = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusyState] = useState(false);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);

  const setBusy = (value: boolean) => {
    setBusyState(value);
    onBusyChange?.(value);
  };

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
    if (busy) return;
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
    else onDone();
  };

  return (
    <form
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
        <button type="button" className="btn" onClick={onCancel}>
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
          {busy && <LoaderCircle className="paste-spinner" size="1.15em" aria-hidden="true" />}
          {busy ? t.importing : t.pasteAdd}
        </button>
      </div>
    </form>
  );
};
