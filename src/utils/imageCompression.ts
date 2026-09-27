export const PHOTO_MAX_DIMENSION = 1000;
export const PHOTO_QUALITY = 0.8;

/** Scales a size down to fit within `max` on its longer side, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max: number) {
  if (width <= max && height <= max) return { width, height };
  return width > height
    ? { width: max, height: Math.round((height * max) / width) }
    : { width: Math.round((width * max) / height), height: max };
}

/**
 * Loads an image (a data URL or a same-site path) and re-encodes it as a compressed JPEG data
 * URL, so recipe photos stay small enough to embed. Browser only.
 */
export function compressImage(
  src: string,
  maxDimension = PHOTO_MAX_DIMENSION,
  quality = PHOTO_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = fitWithin(img.width, img.height, maxDimension);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // No canvas support: a data URL is still usable as is; a path is not embeddable.
        if (src.startsWith('data:')) resolve(src);
        else reject(new Error('Canvas unavailable for image compression'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error(`Could not load image for compression: ${src}`));
    img.src = src;
  });
}
