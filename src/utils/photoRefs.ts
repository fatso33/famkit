import { Recipe, Step } from '../types/recipe';

/**
 * Recipe photos are kept in the cloud one to a document (`photos/{id}`), and a recipe, version or
 * draft holds only `photo:<id>` where the photo goes. Older records still hold the photo itself,
 * as a `data:` URL; it moves out the next time the recipe is saved (or quietly, by its owner's
 * phone). Both can stand in any photo field.
 */
const PREFIX = 'photo:';
const ID = /^[0-9a-f]{32}$/;

/** The largest photo the cloud accepts, in bytes (firestore.rules says the same). */
export const PHOTO_BYTES_LIMIT = 900 * 1024;

/** A photo to write to the cloud beside the recipe that points at it. */
export interface PhotoUpload {
  id: string;
  bytes: Uint8Array<ArrayBuffer>;
}

/**
 * The uploads in groups of at most `maxBytes` each (one photo alone may be more), so no single
 * write grows past what the cloud takes in one request.
 */
export function uploadGroups(uploads: readonly PhotoUpload[], maxBytes: number): PhotoUpload[][] {
  const groups: PhotoUpload[][] = [];
  let size = 0;
  for (const upload of uploads) {
    const last = groups.at(-1);
    if (last && size + upload.bytes.length <= maxBytes) {
      last.push(upload);
      size += upload.bytes.length;
    } else {
      groups.push([upload]);
      size = upload.bytes.length;
    }
  }
  return groups;
}

export const photoRef = (id: string) => `${PREFIX}${id}`;

/** The photo's id when `src` points at a photo kept on its own, else null. */
export function photoIdOf(src: unknown): string | null {
  if (typeof src !== 'string' || !src.startsWith(PREFIX)) return null;
  const id = src.slice(PREFIX.length);
  return ID.test(id) ? id : null;
}

/** Whether `src` is a photo held in the record itself (a `data:` URL). */
export const isEmbeddedPhoto = (src: unknown): src is string =>
  typeof src === 'string' && src.startsWith('data:');

/** A new photo's id: 128 random bits, as hex. */
export function newPhotoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

type WithPhotos = Pick<Recipe, 'heroImage' | 'steps'>;

/**
 * The recipe with every photo field passed through `change`: its own photo, each step's, and each
 * fork path's. Fields without a photo are left as they are, and so is the recipe when nothing
 * changes.
 */
export function mapRecipePhotos<T extends WithPhotos>(
  recipe: T,
  change: (src: string) => string,
): T {
  let changed = false;
  const swap = (src: unknown) => {
    if (typeof src !== 'string' || !src) return src;
    const next = change(src);
    if (next !== src) changed = true;
    return next;
  };
  const heroImage = swap(recipe.heroImage) as string;
  const steps = Array.isArray(recipe.steps)
    ? recipe.steps.map((st: Step) => {
        const imageSrc = swap(st.imageSrc) as string | undefined;
        const paths = st.fork?.paths?.map((path) => {
          const src = swap(path.imageSrc) as string | undefined;
          return src === path.imageSrc ? path : { ...path, imageSrc: src };
        });
        const fork =
          st.fork && paths && paths.some((p, i) => p !== st.fork!.paths[i])
            ? { ...st.fork, paths }
            : st.fork;
        return imageSrc === st.imageSrc && fork === st.fork ? st : { ...st, imageSrc, fork };
      })
    : recipe.steps;
  return changed ? { ...recipe, heroImage, steps } : recipe;
}

/** Every photo field's value, its own photo first, then the steps' in order. */
export function recipePhotoSources(recipe: WithPhotos): string[] {
  const found: string[] = [];
  mapRecipePhotos(recipe, (src) => {
    found.push(src);
    return src;
  });
  return found;
}

/** The ids of the photos the recipe points at, its own photo first, each once. */
export function recipePhotoIds(recipe: WithPhotos): string[] {
  const ids = recipePhotoSources(recipe).map(photoIdOf);
  return [...new Set(ids.filter((id): id is string => id !== null))];
}

/** Whether the recipe still holds any photo itself (an older record). */
export const hasEmbeddedPhotos = (recipe: WithPhotos) =>
  recipePhotoSources(recipe).some(isEmbeddedPhoto);

/** A `data:` URL's bytes and type, or null when it isn't a base64 data URL. */
export function dataUrlBytes(src: string): { bytes: Uint8Array<ArrayBuffer>; type: string } | null {
  const match = /^data:([^;,]*)(;[^,]*)?,/.exec(src);
  if (!match || !(match[2] ?? '').includes(';base64')) return null;
  try {
    const text = atob(src.slice(match[0].length));
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return { bytes, type: match[1] || 'image/jpeg' };
  } catch {
    return null;
  }
}

/** About how many bytes the photo in a base64 `data:` URL holds, without decoding it. */
export function embeddedPhotoBytes(src: string): number {
  const comma = src.indexOf(',');
  return Math.floor(((src.length - comma - 1) * 3) / 4);
}
