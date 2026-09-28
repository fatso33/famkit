import React, { useEffect, useId, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { Language, VersionSummary } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { formatVersionDate } from '../../utils/recipeVersions';

interface VersionMenuProps {
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

/**
 * The recipe's versions as a timeline, dropping down from the version under the editor's title.
 * Mount only while open. A tap outside or Escape closes it.
 */
export const VersionMenu: React.FC<VersionMenuProps> = ({
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Focus moves into the list; the version button gets it back when the list closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);

  const pick = (id: string) => {
    setLoadingId(id);
    // Usually the editor reopens on that version, unmounting this list. Picking the version
    // already shown changes nothing, so close explicitly.
    void onPick(id).then((loaded) => {
      if (loaded) requestClose();
      else setLoadingId(null);
    });
  };

  return (
    <div ref={layerRef} className={`version-menu-layer${isClosing ? ' is-closing' : ''}`}>
      <div className="version-menu-catcher" aria-hidden="true" {...backdropProps} />
      <div
        ref={panelRef}
        className="version-menu"
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h3 id={titleId} className="version-menu-title">
          <History size="1.05em" strokeWidth={2} aria-hidden="true" />
          {t.versionHistory}
        </h3>

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

          {versions.map((v, i) => {
            const isLoading = loadingId === v.id;
            return (
              <li
                key={v.id}
                className={`version-entry${v.id === shownId ? ' is-shown' : ''}`}
                style={{ '--i': i + 1 } as React.CSSProperties}
              >
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
