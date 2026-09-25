import React, { useRef } from 'react';
import { UiTranslations } from '../../i18n/translations';

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
  maxDimension = 1000,
  quality = 0.8,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          onChange(compressed);
        } else {
          onChange(dataUrl);
        }
      };
      img.src = dataUrl;
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
            alt="Preview"
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
