import React from 'react';
import { Camera, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { usePhotoPicker } from '../../hooks/usePhotoPicker';

interface HeroPhotoFieldProps {
  photo: string;
  onChange: (photo: string) => void;
  labelId: string;
  t: UiTranslations;
}

/** The recipe's main photo, framed as the recipe page shows it, with Replace and Remove over it. */
export const HeroPhotoField: React.FC<HeroPhotoFieldProps> = ({ photo, onChange, labelId, t }) => {
  const { inputs, chooseFile, takePhoto } = usePhotoPicker(onChange);

  return (
    <div
      className={`hero-photo-field${photo ? ' has-photo' : ''}`}
      role="group"
      aria-labelledby={labelId}
    >
      {inputs}
      {photo ? (
        <>
          {/* Keyed by the photo, so a new one fades in. */}
          <img key={photo} className="hero-photo-img" src={photo} alt={t.photoPreviewAlt} />
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
            <Camera size="1.6rem" strokeWidth={1.8} />
          </span>
          <span className="hero-photo-hint">{t.photoHint}</span>
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
