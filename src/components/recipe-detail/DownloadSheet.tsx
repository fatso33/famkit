import React, { useEffect, useId, useRef, useState } from 'react';
import { FileDown, LoaderCircle } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';

interface DownloadSheetProps {
  /** The file it saves ("Wanda's Cheese Bread.pdf"). */
  fileName: string;
  /** The recipe's own photo, shown on the "With photos" page; '' when it has none. */
  photo: string;
  /** Makes and saves the PDF, with or without the photos. The sheet closes once it's done. */
  onChoose: (photos: boolean) => Promise<void>;
  onClose: () => void;
  t: UiTranslations;
}

/** A small picture of the PDF's first page: the title, perhaps the photo, and two columns. */
const MiniPage: React.FC<{ photo?: string }> = ({ photo }) => (
  <span className="pdf-mini" aria-hidden="true">
    <span className="pdf-mini-title" />
    <span className="pdf-mini-credit" />
    {photo !== undefined &&
      (photo ? (
        <img className="pdf-mini-photo" src={photo} alt="" />
      ) : (
        <span className="pdf-mini-photo" />
      ))}
    <span className="pdf-mini-columns">
      <span className="pdf-mini-column is-narrow">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="pdf-mini-column">
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    </span>
  </span>
);

/**
 * Asks whether a recipe's PDF has its photos, each choice showing its page in small, then makes
 * it. Mount only while open. While the chosen one is being made its card says so; the sheet
 * closes when it's saved.
 */
export const DownloadSheet: React.FC<DownloadSheetProps> = ({
  fileName,
  photo,
  onChoose,
  onClose,
  t,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  const titleId = useId();
  const fileId = useId();
  const first = useRef<HTMLButtonElement>(null);
  // The choice being made, while its PDF is.
  const [making, setMaking] = useState<boolean | null>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    first.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);

  const choose = async (photos: boolean) => {
    if (making !== null) return;
    setMaking(photos);
    // onChoose reports its own failures.
    await onChoose(photos);
    requestClose();
  };

  const choice = (photos: boolean) => {
    const busy = making === photos;
    return (
      <button
        ref={photos ? first : undefined}
        type="button"
        className={`download-choice${busy ? ' is-making' : ''}`}
        aria-busy={busy || undefined}
        aria-describedby={fileId}
        disabled={making !== null && !busy}
        onClick={() => void choose(photos)}
      >
        <span className="download-choice-art">
          <MiniPage photo={photos ? photo : undefined} />
          {busy && (
            <span className="download-choice-spinner">
              <LoaderCircle className="paste-spinner" size="1.5rem" aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="download-choice-label">
          {busy ? t.downloadPreparing : photos ? t.downloadWithPhotos : t.downloadTextOnly}
        </span>
        {!photos && <span className="download-choice-hint">{t.downloadTextOnlyHint}</span>}
      </button>
    );
  };

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={ref}
      className={`editor-sheet-layer is-over-page${isClosing ? ' is-closing' : ''}`}
      {...backdropProps}
    >
      <div
        className="editor-sheet is-download"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="editor-sheet-grip" aria-hidden="true" />
        <h3 className="editor-sheet-title" id={titleId}>
          <FileDown size="1.1em" aria-hidden="true" />
          {t.downloadTitle}
        </h3>
        <p className="download-file" id={fileId}>
          {t.downloadFileName(fileName)}
        </p>
        <div className="download-choices">
          {choice(true)}
          {choice(false)}
        </div>
        <div className="editor-sheet-actions is-stacked">
          <button type="button" className="btn" onClick={requestClose}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};
