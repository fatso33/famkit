import React, { useEffect, useId, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { Language, VersionSummary } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { formatVersionDate } from '../../utils/recipeVersions';

interface VersionHistorySheetProps {
  current: { version: number; savedAt: number; note?: string };
  /** Earlier versions, newest first. */
  versions: VersionSummary[];
  /** The earlier version currently loaded into the form, if any. */
  shownId?: string;
  language: Language;
  /** Loads a version into the form. Resolves false when it couldn't be loaded (already reported). */
  onPick: (id: string) => Promise<boolean>;
  onClose: () => void;
  t: UiTranslations;
}

// A timeline of the recipe's versions, opened over the editor. Mount only while open.
export const VersionHistorySheet: React.FC<VersionHistorySheetProps> = ({
  current,
  versions,
  shownId,
  language,
  onPick,
  onClose,
  t,
}) => {
  const { ref: layerRef, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Move focus into the sheet; the editor gets it back when the sheet closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);

  const pick = (id: string) => {
    setLoadingId(id);
    // Usually the editor reopens on that version, unmounting this sheet. Picking the version
    // already shown changes nothing, so close explicitly.
    void onPick(id).then((loaded) => {
      if (loaded) requestClose();
      else setLoadingId(null);
    });
  };

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={layerRef}
      className={`version-sheet-layer${isClosing ? ' is-closing' : ''}`}
      {...backdropProps}
    >
      <div
        ref={sheetRef}
        className="version-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="version-sheet-grip" aria-hidden="true" />
        <div className="version-sheet-header">
          <h3 id={titleId} className="version-sheet-title">
            <History size="1.05em" strokeWidth={2} aria-hidden="true" />
            {t.versionHistory}
          </h3>
          <button
            type="button"
            className="btn btn-icon"
            aria-label={t.closeDialog}
            onClick={requestClose}
          >
            ✕
          </button>
        </div>

        <ol className="version-timeline">
          <li className="version-entry is-current">
            <span className="version-dot" aria-hidden="true" />
            <div className="version-card">
              <span className="version-card-head">
                <span className="version-name">{t.versionLabel(current.version)}</span>
                <span className="version-chip">{t.currentVersion}</span>
              </span>
              <span className="version-date">{formatVersionDate(current.savedAt, language)}</span>
              {current.note && <span className="version-note">{current.note}</span>}
            </div>
          </li>

          {versions.map((v) => {
            const isLoading = loadingId === v.id;
            return (
              <li key={v.id} className={`version-entry${v.id === shownId ? ' is-shown' : ''}`}>
                <span className="version-dot" aria-hidden="true" />
                <button
                  type="button"
                  className="version-card"
                  onClick={() => pick(v.id)}
                  disabled={loadingId !== null}
                  aria-busy={isLoading}
                >
                  <span className="version-card-head">
                    <span className="version-name">{t.versionLabel(v.version)}</span>
                    {isLoading && <span className="version-loading">{t.versionLoading}</span>}
                  </span>
                  <span className="version-date">{formatVersionDate(v.savedAt, language)}</span>
                  {v.note && <span className="version-note">{v.note}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
