import { getToken } from 'firebase/app-check';
import { appCheck, auth } from './firebase';
import { compressImage } from '../utils/imageCompression';

/**
 * Fetching a recipe page and its picture through the family's import worker (worker/), since a
 * browser can't read another site's pages itself. The worker answers only the signed-in family.
 */

const ENDPOINT = ((import.meta.env.VITE_RECIPE_IMPORT_URL as string | undefined) ?? '').replace(
  /\/+$/,
  '',
);

/** Whether this build knows where the import worker is. */
export const isRecipeImportAvailable = Boolean(ENDPOINT);

/**
 * Why an import didn't work: no connection, the site wouldn't give the page, too many imports
 * at once, not signed in as family, or anything else.
 */
export type ImportFailure = 'offline' | 'refused' | 'busy' | 'notAllowed' | 'failed';

export class ImportError extends Error {
  constructor(readonly reason: ImportFailure) {
    super(`Recipe import: ${reason}`);
  }
}

const PAGE_TIMEOUT_MS = 25_000;

async function ask(path: 'page' | 'image', url: string): Promise<Response> {
  if (!ENDPOINT) throw new ImportError('failed');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ImportError('offline');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let response: Response;
  try {
    const idToken = await auth?.currentUser?.getIdToken();
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    if (appCheck) {
      try {
        headers['X-Firebase-AppCheck'] = (await getToken(appCheck)).token;
      } catch (error) {
        // The worker passes it on to Firestore, which may not need it: the sign-in is the key.
        console.warn('Recipe import: no App Check token, trying without:', error);
      }
    }
    response = await fetch(`${ENDPOINT}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
  } catch {
    // No connection, a timeout, or the worker not answering.
    throw new ImportError(
      typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed',
    );
  }
  if (response.ok) return response;
  if (response.status === 401 || response.status === 403) throw new ImportError('notAllowed');
  if (response.status === 429) throw new ImportError('busy');
  // The site itself said no, isn't there, or sent something that isn't a page.
  if ([400, 413, 415, 502].includes(response.status)) throw new ImportError('refused');
  throw new ImportError('failed');
}

/** What the worker found on the page, unchecked (utils/recipeImport reads it). */
export async function fetchRecipePage(url: string): Promise<unknown> {
  const response = await ask('page', url);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ImportError('failed');
  }
}

/**
 * The picture at an address, compressed like any photo added to a recipe, as a data URL.
 * Empty when it can't be had: a recipe without its picture is still worth bringing in.
 */
export async function fetchRecipePhoto(url: string): Promise<string> {
  let objectUrl = '';
  try {
    const response = await ask('image', url);
    objectUrl = URL.createObjectURL(await response.blob());
    return await compressImage(objectUrl);
  } catch (error) {
    console.warn('Recipe import: the picture could not be brought in:', error);
    return '';
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
