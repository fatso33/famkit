/**
 * The import worker's pure parts: which addresses it will fetch, what it takes from a page, and
 * checking who is asking. No I/O here except where a `fetch` is passed in, so it's tested with
 * the app's tests (src/test/importWorker.test.ts).
 */

// --- Which addresses may be fetched -------------------------------------------------------------

// Names that never belong to a public site.
const PRIVATE_SUFFIXES = [
  'localhost',
  'local',
  'internal',
  'intranet',
  'lan',
  'home',
  'corp',
  'test',
  'example',
  'invalid',
  'onion',
  'arpa',
];

const MAX_URL_LENGTH = 2048;

/**
 * The address as one the worker will fetch, or null. Only public https sites by name, on the
 * standard port: no IP addresses (the URL parser has already turned "2130706433" and "0x7f.1"
 * into dotted form), no single-label or private names, no sign-in details, and never the worker
 * itself. Checked again on every redirect.
 */
export function publicAddress(raw: unknown, ownHost = ''): URL | null {
  if (typeof raw !== 'string' || raw.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === ownHost.toLowerCase()) return null;
  const labels = host.split('.');
  // IPv6 comes in brackets; IPv4 ends in a number. A site's name ends in letters (or punycode).
  if (labels.length < 2 || !/^(?:[a-z]{2,}|xn--[a-z\d-]+)$/.test(labels.at(-1)!)) return null;
  if (!labels.every((label) => /^[a-z\d_-]{1,63}$/.test(label))) return null;
  if (PRIVATE_SUFFIXES.includes(labels.at(-1)!)) return null;
  url.hash = '';
  return url;
}

// --- What's taken from a page -------------------------------------------------------------------

export interface PageExtract {
  url: string;
  lang: string;
  jsonLd: string[];
  meta: { image: string; siteName: string };
  /** The page's markup, only when its JSON-LD holds no recipe. */
  html?: string;
}

const MAX_BLOCKS = 30;
const MAX_JSON_LD_CHARS = 1_000_000;
const MAX_MARKUP_CHARS = 1_500_000;

const attribute = (tag: string, name: string): string => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
};

/**
 * The parts of a page the app reads a recipe from: its JSON-LD blocks (as text, unparsed), its
 * language, and its share picture and site name. When those blocks hold a recipe the rest of
 * the page is dropped here, so the phone gets a few kilobytes rather than the whole page.
 */
export function extractPage(html: string, url: string): PageExtract {
  const jsonLd: string[] = [];
  let total = 0;
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/^application\/ld\+json\b/i.test(attribute(` ${script[1]}`, 'type').trim())) continue;
    const block = script[2].trim();
    total += block.length;
    if (!block || jsonLd.length >= MAX_BLOCKS || total > MAX_JSON_LD_CHARS) continue;
    jsonLd.push(block);
  }

  const meta: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attribute(tag, 'property') || attribute(tag, 'name')).toLowerCase();
    if (key && !(key in meta)) meta[key] = attribute(tag, 'content').slice(0, 2048);
  }

  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? '';
  const extract: PageExtract = {
    url,
    lang: attribute(htmlTag, 'lang').slice(0, 20),
    jsonLd,
    meta: {
      image: meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || '',
      siteName: meta['og:site_name'] || '',
    },
  };
  // Some sites (many Polish ones) describe the recipe in the page's own markup instead. For
  // those the page goes too, without its scripts, styles and drawings, for the app to read.
  if (!jsonLd.some((block) => /\bRecipe\b/.test(block))) {
    const markup = html
      .replace(/<(script|style|svg|noscript|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ');
    if (markup.length <= MAX_MARKUP_CHARS) extract.html = markup;
  }
  return extract;
}

// --- Who is asking ------------------------------------------------------------------------------

export interface Caller {
  uid: string;
  /** Their verified email, in lowercase. */
  email: string;
}

export interface Jwk extends JsonWebKey {
  kid?: string;
}

const decodeSegment = (segment: string) => {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const decodeJson = (segment: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('not an object');
  }
  return parsed as Record<string, unknown>;
};

// A clock a few minutes out still signs in.
const CLOCK_SKEW_SECONDS = 300;

/**
 * Checks a Firebase sign-in token the way Firebase's own servers do: signed by Google with
 * RS256 (a key from `keys`), issued for this project, in date, and for a verified email.
 * Returns who it is, or null. Any failure is a plain "no": callers learn nothing more.
 */
export async function verifyIdToken(
  token: string,
  projectId: string,
  keys: readonly Jwk[],
  nowSeconds = Date.now() / 1000,
): Promise<Caller | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || token.length > 4096) return null;
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signed = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeSegment(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!signed) return null;

    const { aud, iss, sub, exp, iat, email, email_verified: verified } = claims;
    if (aud !== projectId || iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof exp !== 'number' || exp <= nowSeconds) return null;
    if (typeof iat !== 'number' || iat > nowSeconds + CLOCK_SKEW_SECONDS) return null;
    if (typeof sub !== 'string' || !sub || sub.length > 128) return null;
    if (typeof email !== 'string' || !email || verified !== true) return null;
    return { uid: sub, email: email.toLowerCase() };
  } catch {
    return null;
  }
}

// --- Reading a reply without trusting its size ------------------------------------------------

/** A request's or a reply's body up to `limit` bytes, or null when it's longer. */
export async function readLimited(
  source: Pick<Response, 'headers' | 'body'>,
  limit: number,
): Promise<Uint8Array | null> {
  if (Number(source.headers.get('content-length') ?? 0) > limit) return null;
  const reader = source.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** The page's text, in the character set its reply names (UTF-8 when it names none we know). */
export function decodeHtml(body: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder().decode(body);
  }
}
