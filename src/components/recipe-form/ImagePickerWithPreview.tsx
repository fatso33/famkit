import React from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { usePhotoPicker } from '../../hooks/usePhotoPicker';

interface ImagePickerWithPreviewProps {
  imageUrl: string;
  onChange: (url: string) => void;
  t: UiTranslations;
}

/** A step's photo: a thumbnail to remove, or buttons to take or choose one (compressed). */
export const ImagePickerWithPreview: React.FC<ImagePickerWithPreviewProps> = ({
  imageUrl,
  onChange,
  t,
}) => {
  const { inputs, chooseFile, takePhoto } = usePhotoPicker(onChange);

  return (
    <div className="image-picker-zone">
      {inputs}
      {imageUrl ? (
        <div className="image-preview-wrapper">
          <img src={imageUrl} alt={t.photoPreviewAlt} className="image-preview-thumb" />
          <button
            type="button"
            className="image-delete-badge"
            onClick={() => onChange('')}
            aria-label={t.removePhoto}
          >
            <X size="0.95rem" strokeWidth={2.6} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="image-picker-actions">
          <button type="button" className="editor-chip" onClick={takePhoto}>
            <Camera size="1.15em" aria-hidden="true" />
            {t.takePhoto}
          </button>
          <button type="button" className="editor-chip" onClick={chooseFile}>
            <ImagePlus size="1.15em" aria-hidden="true" />
            {t.uploadPhoto}
          </button>
        </div>
      )}
    </div>
  );
};
