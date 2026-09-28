import React, { useRef } from 'react';
import { compressImage, PHOTO_MAX_DIMENSION, PHOTO_QUALITY } from '../utils/imageCompression';

/**
 * Picking a photo from the phone's files or its camera. Every photo is compressed before it's
 * handed on (photos are stored in the recipe). Render `inputs` once; the buttons call
 * chooseFile() and takePhoto().
 */
export function usePhotoPicker(
  onPicked: (dataUrl: string) => void,
  { maxDimension = PHOTO_MAX_DIMENSION, quality = PHOTO_QUALITY } = {},
) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared, so picking the same photo again still counts as a change.
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') return;
      compressImage(dataUrl, maxDimension, quality).then(onPicked, (err: unknown) => {
        console.warn('Photo could not be compressed (not added):', err);
      });
    };
    reader.readAsDataURL(file);
  };

  const inputs = (
    <>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleChange} />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleChange}
      />
    </>
  );

  return {
    inputs,
    chooseFile: () => fileInput.current?.click(),
    takePhoto: () => cameraInput.current?.click(),
  };
}
