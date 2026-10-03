import React from 'react';
import { Camera, ImagePlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { usePhotoPicker } from '../../hooks/usePhotoPicker';
import { usePhoto } from '../../hooks/usePhoto';

interface HeroPhotoFieldProps {
  photo: string;
  onChange: (photo: string) => void;
  /** A picture from a recipe's web page is on its way. */
  loading?: boolean;
  labelId: string;
  /** What the empty frame says (the recipe editor's own hint by default). */
  hint?: string;
  /** Set when the photo is required and missing: the field's error, which describes it. */
  errorId?: string;
  t: UiTranslations;
}

/** The recipe's main photo, framed as the recipe page shows it, with Replace and Remove over it. */
export const HeroPhotoField: React.FC<HeroPhotoFieldProps> = ({
  photo,
  onChange,
  loading = false,
  labelId,
  hint,
  errorId,
  t,
}) => {
  const { inputs, chooseFile, takePhoto } = usePhotoPicker(onChange);
  const shown = usePhoto(photo);

  return (
    <div
      className={`hero-photo-field${photo ? ' has-photo' : ''}`}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={errorId}
    >
      {inputs}
      {photo ? (
        <>
          {/* Keyed by the photo, so a new one fades in. */}
          {shown.src ? (
            <img key={photo} className="hero-photo-img" src={shown.src} alt={t.photoPreviewAlt} />
          ) : (
            <span className="hero-photo-img photo-pending" />
          )}
          <div className="hero-photo-actions">
            <button type="button" className="glass-chip" onClick={chooseFile}>
              <RefreshCw size="1.05em" aria-hidden="true" />
              {t.replacePhoto}
            </button>
            <button
              type="button"
              className="glass-chip"
              onClick={() => onChange('')}
              aria-label={t.removePhoto}
            >
              <Trash2 size="1.05em" aria-hidden="true" />
              {t.remove}
            </button>
          </div>
        </>
      ) : (
        <div className="hero-photo-empty">
          <span className="hero-photo-badge" aria-hidden="true">
            {loading ? (
              <LoaderCircle className="paste-spinner" size="1.6rem" strokeWidth={1.8} />
            ) : (
              <Camera size="1.6rem" strokeWidth={1.8} />
            )}
          </span>
          <span className="hero-photo-hint" role={loading ? 'status' : undefined}>
            {loading ? t.importPhotoLoading : (hint ?? t.photoHint)}
          </span>
          <div className="hero-photo-buttons">
            <button type="button" className="editor-chip" onClick={takePhoto}>
              <Camera size="1.15em" aria-hidden="true" />
              {t.takePhoto}
            </button>
            <button type="button" className="editor-chip" onClick={chooseFile}>
              <ImagePlus size="1.15em" aria-hidden="true" />
              {t.uploadPhoto}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
