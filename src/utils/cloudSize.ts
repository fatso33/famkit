/**
 * Firestore keeps a recipe in one document of at most 1 MiB, photos and translations included
 * (photos are embedded). A recipe over that can't reach the family: the cloud refuses it.
 */
const DOCUMENT_LIMIT = 1_048_576;

// Room left for what the cloud adds on top of the recipe as saved: field names, the version
// list, the owner's details.
const HEADROOM = 32 * 1024;

const encoder = new TextEncoder();
const bytes = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

// The recipe without its photos (any embedded data: URL), to size its words alone.
const withoutPhotos = (value: unknown): unknown => {
  if (typeof value === 'string') return value.startsWith('data:') ? '' : value;
  if (Array.isArray(value)) return value.map(withoutPhotos);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutPhotos(v)]));
  }
  return value;
};

/**
 * Whether a recipe fits the cloud's limit, with room for the translation into the other
 * language that's still to come (about as long as its own words).
 */
export function fitsInCloud(recipe: object): boolean {
  return bytes(recipe) + bytes(withoutPhotos(recipe)) <= DOCUMENT_LIMIT - HEADROOM;
}
