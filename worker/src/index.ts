import {
  Caller,
  Jwk,
  decodeHtml,
  extractPage,
  publicAddress,
  readLimited,
  verifyIdToken,
} from './lib';

/**
 * Family Kitchen's import worker (Cloudflare). A browser can't read another site's page, so the
 * app asks this worker to fetch a recipe page (POST /page) or its picture (POST /image) for it.
 *
 * It is not an open proxy. Every request must come from the app's own address, carry the
 * Firebase sign-in of someone on the family list, and stay within a per-person rate limit; the
 * worker then fetches only public https pages, follows redirects itself (checking each one),
 * sends no cookies or sign-in details anywhere, caps what it reads, and hands back only the
 * recipe data of a page or the bytes of a picture. It stores nothing and logs no addresses.
 * Setup and the full list of safeguards: docs/recipe-import-worker.md.
 */

export interface Env {
  /** The Firebase project the family signs in to. */
  FIREBASE_PROJECT_ID: string;
  /** The app's addresses, separated by commas: only pages served from these may call. */
  ALLOWED_ORIGINS: string;
  /** Cloudflare's rate limiter (wrangler.toml). Without it, requests aren't counted. */
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

const MAX_REQUEST_BYTES = 4096;
const MAX_PAGE_BYTES = 3_000_000;
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; FamilyKitchen/1.0; recipe import for a private family)';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

const GOOGLE_KEYS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** A refusal: the status and a short code the app turns into a message. */
class Refusal extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

// --- Who is asking ------------------------------------------------------------------------------

// Google's signing keys, kept for as long as Google says they're good (they rotate).
let googleKeys: { keys: Jwk[]; until: number } | null = null;

async function signingKeys(): Promise<Jwk[]> {
  if (googleKeys && googleKeys.until > Date.now()) return googleKeys.keys;
  const response = await fetch(GOOGLE_KEYS_URL);
  if (!response.ok) throw new Refusal(503, 'unavailable');
  const body: { keys?: Jwk[] } = await response.json();
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  googleKeys = { keys: body.keys ?? [], until: Date.now() + maxAge * 1000 };
  return googleKeys.keys;
}

// People already found on the family list, for a few minutes, so each import costs one lookup.
const FAMILY_MEMORY_MS = 10 * 60 * 1000;
const knownFamily = new Map<string, number>();

/**
 * Whether the caller is on the family list. Asked of Firestore with the caller's own sign-in,
 * so the app's security rules decide (each person may read only their own entry) and the worker
 * holds no key to the database.
 */
async function isFamily(caller: Caller, token: string, request: Request, env: Env) {
  if ((knownFamily.get(caller.uid) ?? 0) > Date.now()) return true;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const appCheck = request.headers.get('X-Firebase-AppCheck');
  if (appCheck) headers['X-Firebase-AppCheck'] = appCheck;
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
      `/databases/(default)/documents/family_members/${encodeURIComponent(caller.email)}`,
    { headers },
  );
  if (response.status === 403 || response.status === 404) return false;
  if (!response.ok) throw new Refusal(503, 'unavailable');
  if (knownFamily.size > 500) knownFamily.clear();
  knownFamily.set(caller.uid, Date.now() + FAMILY_MEMORY_MS);
  return true;
}

async function authorize(request: Request, env: Env): Promise<void> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const caller = token
    ? await verifyIdToken(token, env.FIREBASE_PROJECT_ID, await signingKeys())
    : null;
  if (!token || !caller) throw new Refusal(401, 'signed-out');
  if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: caller.uid })).success) {
    throw new Refusal(429, 'busy');
  }
  if (!(await isFamily(caller, token, request, env))) throw new Refusal(403, 'not-family');
}

// --- Fetching ---------------------------------------------------------------------------------

/**
 * Fetches a public address, following redirects by hand so that each hop is checked like the
 * first: a page can't bounce the worker to somewhere it wouldn't go directly.
 */
async function fetchPublic(raw: unknown, accept: string, ownHost: string): Promise<Response> {
  let url = publicAddress(raw, ownHost);
  for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetch(url.href, {
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'en,pl;q=0.9' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new Refusal(502, 'unreachable');
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      try {
        url = publicAddress(new URL(location, url).href, ownHost);
      } catch {
        url = null;
      }
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Refusal(502, response.status === 404 ? 'not-found' : 'refused');
    }
    return response;
  }
  throw new Refusal(400, 'bad-address');
}

async function page(target: unknown, ownHost: string): Promise<Response> {
  const response = await fetchPublic(target, 'text/html,application/xhtml+xml', ownHost);
  const type = response.headers.get('content-type') ?? '';
  if (!/^(?:text\/html|application\/xhtml\+xml)\b/i.test(type)) {
    await response.body?.cancel();
    throw new Refusal(415, 'not-a-page');
  }
  const body = await readLimited(response, MAX_PAGE_BYTES);
  if (!body) throw new Refusal(413, 'too-large');
  return Response.json(extractPage(decodeHtml(body, type), response.url));
}

async function image(target: unknown, ownHost: string): Promise<Response> {
  const response = await fetchPublic(target, IMAGE_TYPES.join(','), ownHost);
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  // Pictures only, and never SVG (which can carry scripts).
  if (!IMAGE_TYPES.includes(type)) {
    await response.body?.cancel();
    throw new Refusal(415, 'not-a-picture');
  }
  const body = await readLimited(response, MAX_IMAGE_BYTES);
  if (!body) throw new Refusal(413, 'too-large');
  return new Response(body, { headers: { 'Content-Type': type } });
}

// --- The worker -------------------------------------------------------------------------------

async function handle(request: Request, env: Env): Promise<Response> {
  const { pathname, hostname } = new URL(request.url);
  if (pathname !== '/page' && pathname !== '/image') throw new Refusal(404, 'not-found');
  if (request.method !== 'POST') throw new Refusal(405, 'bad-request');
  if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) {
    throw new Refusal(415, 'bad-request');
  }
  await authorize(request, env);

  const sent = await readLimited(request, MAX_REQUEST_BYTES);
  let target: unknown;
  try {
    target = (JSON.parse(new TextDecoder().decode(sent ?? new Uint8Array())) as { url?: unknown })
      .url;
  } catch {
    throw new Refusal(400, 'bad-request');
  }
  return pathname === '/page' ? page(target, hostname) : image(target, hostname);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS.split(',')
      .map((item) => item.trim())
      .includes(origin);
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      Vary: 'Origin',
    });
    if (allowed) headers.set('Access-Control-Allow-Origin', origin);

    // Only the app's own pages may call: other sites' pages are turned away before anything runs.
    if (!allowed) {
      return Response.json({ error: 'forbidden' }, { status: 403, headers });
    }
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST');
      headers.set(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Firebase-AppCheck',
      );
      headers.set('Access-Control-Max-Age', '86400');
      return new Response(null, { status: 204, headers });
    }

    let response: Response;
    try {
      response = await handle(request, env);
    } catch (error) {
      const refusal = error instanceof Refusal ? error : new Refusal(500, 'failed');
      response = Response.json({ error: refusal.code }, { status: refusal.status });
    }
    headers.forEach((value, name) => response.headers.set(name, value));
    return response;
  },
};
