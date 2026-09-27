import React, { useRef } from 'react';
import { UiTranslations } from '../../i18n/translations';
import { compressImage, PHOTO_MAX_DIMENSION, PHOTO_QUALITY } from '../../utils/imageCompression';

interface ImagePickerWithPreviewProps {
  imageUrl: string;
  onChange: (url: string) => void;
  label?: string;
  idPrefix?: string;
  helpText?: string;
  t: UiTranslations;
  maxDimension?: number;
  quality?: number;
}

export const ImagePickerWithPreview: React.FC<ImagePickerWithPreviewProps> = ({
  imageUrl,
  onChange,
  label,
  idPrefix = 'img-picker',
  helpText,
  t,
  maxDimension = PHOTO_MAX_DIMENSION,
  quality = PHOTO_QUALITY,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      compressImage(dataUrl, maxDimension, quality).then(onChange, (err: unknown) => {
        console.warn('Photo could not be compressed (not added):', err);
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="image-picker-zone">
      {label && <label className="form-label">{label}</label>}

      {imageUrl ? (
        <div className="image-preview-wrapper">
          <img
            src={imageUrl}
            alt={t.photoPreviewAlt}
            className="image-preview-thumb"
            loading="lazy"
          />
          <button
            type="button"
            className="image-delete-badge"
            onClick={handleRemove}
            title={t.removePhoto}
            aria-label={t.removePhoto}
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="image-picker-actions">
          <input
            ref={fileInputRef}
            type="file"
            id={`${idPrefix}-file`}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            id={`${idPrefix}-camera`}
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className="btn-camera-capture"
            onClick={() => fileInputRef.current?.click()}
          >
            📁 {t.uploadPhoto}
          </button>

          <button
            type="button"
            className="btn-camera-capture"
            onClick={() => cameraInputRef.current?.click()}
          >
            📷 {t.takePhoto}
          </button>
        </div>
      )}

      {helpText && !imageUrl && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'block',
          }}
        >
          {helpText}
        </span>
      )}
    </div>
  );
};
