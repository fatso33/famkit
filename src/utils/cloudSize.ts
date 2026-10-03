import { PHOTO_BYTES_LIMIT, embeddedPhotoBytes, isEmbeddedPhoto } from './photoRefs';

/**
 * Firestore keeps a recipe in one document of at most 1 MiB, translations included. Its photos
 * are kept apart, one to a document (services/photos), so only its words count against that, and
 * each photo against its own limit. A recipe over either can't reach the family.
 */
const DOCUMENT_LIMIT = 1_048_576;

// Room left for what the cloud adds on top of the recipe as saved: field names, the version
// list, the owner's details, the photos' short pointers.
const HEADROOM = 32 * 1024;

const encoder = new TextEncoder();
const bytes = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

// The recipe without the photos it holds (any embedded data: URL), to size its words alone.
const withoutPhotos = (value: unknown): unknown => {
  if (isEmbeddedPhoto(value)) return '';
  if (Array.isArray(value)) return value.map(withoutPhotos);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutPhotos(v)]));
  }
  return value;
};

// Every photo the value holds itself.
const embeddedPhotos = (value: unknown): string[] => {
  if (isEmbeddedPhoto(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(embeddedPhotos);
  if (typeof value === 'object' && value !== null)
    return Object.values(value).flatMap(embeddedPhotos);
  return [];
};

/**
 * Whether a recipe fits the cloud's limits: its words with room for the translation into the
 * other language that's still to come (about as long as them), and each new photo on its own.
 */
export function fitsInCloud(recipe: object): boolean {
  const words = bytes(withoutPhotos(recipe));
  return (
    words * 2 <= DOCUMENT_LIMIT - HEADROOM &&
    embeddedPhotos(recipe).every((photo) => embeddedPhotoBytes(photo) <= PHOTO_BYTES_LIMIT)
  );
}
