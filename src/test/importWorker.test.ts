// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  Jwk,
  decodeHtml,
  extractPage,
  publicAddress,
  readLimited,
  verifyIdToken,
} from '../../worker/src/lib';

describe('which addresses the import worker will fetch', () => {
  it('takes public https pages', () => {
    expect(publicAddress('https://www.kwestiasmaku.com/przepis/zupa#top')?.href).toBe(
      'https://www.kwestiasmaku.com/przepis/zupa',
    );
    expect(publicAddress('https://xn--bcher-kva.example.xn--p1ai/')).not.toBeNull();
  });

  it('refuses anything that could reach somewhere private', () => {
    const refused = [
      'http://example.com/', // not https
      'https://example.com:8443/', // odd port
      'https://user:pass@example.com/', // sign-in details
      'https://localhost/',
      'https://intranet/',
      'https://router.local/',
      'https://db.internal/',
      'https://127.0.0.1/',
      'https://2130706433/', // 127.0.0.1 as one number
      'https://0x7f.0.0.1/',
      'https://169.254.169.254/latest/meta-data', // cloud metadata
      'https://10.0.0.5/',
      'https://[::1]/',
      'https://[fd00::1]/',
      'ftp://example.com/',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'not an address',
      `https://example.com/${'a'.repeat(3000)}`,
      '',
      null,
      42,
    ];
    for (const address of refused) expect(publicAddress(address), String(address)).toBeNull();
  });

  it('never fetches itself', () => {
    expect(
      publicAddress('https://import.example.workers.dev/page', 'import.example.workers.dev'),
    ).toBeNull();
  });
});

describe('what the worker takes from a page', () => {
  const html = `<!doctype html>
    <html lang="pl-PL" class="x">
    <head>
      <meta property="og:site_name" content="Kuchnia &amp; Dom">
      <meta content='https://example.com/zupa.jpg' property='og:image'>
      <script>window.secret = 'not taken';</script>
      <script type="application/ld+json" class="yoast">{"@type":"Recipe","name":"Zupa"}</script>
      <SCRIPT TYPE='application/ld+json'>
        {"@type":"WebSite"}
      </SCRIPT>
      <script type="application/json">{"private":true}</script>
    </head><body><p>The whole article, which stays behind.</p></body></html>`;

  it('keeps only the recipe data, the language and the share picture', () => {
    expect(extractPage(html, 'https://example.com/zupa')).toEqual({
      url: 'https://example.com/zupa',
      lang: 'pl-PL',
      jsonLd: ['{"@type":"Recipe","name":"Zupa"}', '{"@type":"WebSite"}'],
      meta: { image: 'https://example.com/zupa.jpg', siteName: 'Kuchnia &amp; Dom' },
    });
  });

  it('sends the page’s markup too when its data holds no recipe, without scripts or styles', () => {
    const page = `<html lang="pl"><head><style>p { color: red }</style>
      <script type="application/ld+json">{"@type":"WebSite"}</script></head>
      <body><!-- a comment --><script>track()</script>
      <h3>Składniki</h3><ul><li>2   jabłka</li></ul><svg><path d="M0 0"/></svg></body></html>`;
    const extract = extractPage(page, 'https://example.com/racuchy');
    expect(extract.jsonLd).toEqual(['{"@type":"WebSite"}']);
    expect(extract.html).toBe(
      '<html lang="pl"><head> </head> <body> <h3>Składniki</h3><ul><li>2 jabłka</li></ul></body></html>',
    );
    expect(extractPage('<p>hello', 'https://example.com/')).toEqual({
      url: 'https://example.com/',
      lang: '',
      jsonLd: [],
      meta: { image: '', siteName: '' },
      html: '<p>hello',
    });
  });

  it('reads a page in the character set it names', () => {
    // "żurek" in ISO-8859-2.
    const bytes = new Uint8Array([0xbf, 0x75, 0x72, 0x65, 0x6b]);
    expect(decodeHtml(bytes, 'text/html; charset=iso-8859-2')).toBe('żurek');
    expect(decodeHtml(new TextEncoder().encode('żurek'), 'text/html; charset=made-up')).toBe(
      'żurek',
    );
  });

  it('stops reading a reply that is longer than allowed', async () => {
    expect(await readLimited(new Response('12345'), 5)).toHaveLength(5);
    expect(await readLimited(new Response('123456'), 5)).toBeNull();
    const claimed = new Response('1', { headers: { 'content-length': '999' } });
    expect(await readLimited(claimed, 5)).toBeNull();
  });
});

describe('checking who is asking', () => {
  const PROJECT = 'family-kitchen-test';
  const now = 1_800_000_000;
  let keys: Jwk[];
  let sign: (claims: object, header?: object, key?: CryptoKey) => Promise<string>;
  let strangerKey: CryptoKey;

  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const good = {
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: 'uid-123',
    email: 'Babcia@Example.com',
    email_verified: true,
    iat: now - 60,
    exp: now + 3000,
  };

  beforeAll(async () => {
    const algorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    };
    const pair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
    const stranger = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
    strangerKey = stranger.privateKey;
    keys = [{ ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'key-1' }];
    sign = async (claims, header = { alg: 'RS256', kid: 'key-1' }, key = pair.privateKey) => {
      const body = `${encode(header)}.${encode(claims)}`;
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(body),
      );
      return `${body}.${Buffer.from(signature).toString('base64url')}`;
    };
  });

  it('accepts a sign-in Google signed for this project', async () => {
    expect(await verifyIdToken(await sign(good), PROJECT, keys, now)).toEqual({
      uid: 'uid-123',
      email: 'babcia@example.com',
    });
  });

  it('refuses every other token', async () => {
    const refused: [string, string][] = [
      ['another project', await sign({ ...good, aud: 'someone-else' })],
      ['another issuer', await sign({ ...good, iss: 'https://evil.example/' })],
      ['expired', await sign({ ...good, exp: now - 1 })],
      ['issued in the future', await sign({ ...good, iat: now + 3600 })],
      ['unverified email', await sign({ ...good, email_verified: false })],
      ['no email', await sign({ ...good, email: undefined })],
      ['no user', await sign({ ...good, sub: '' })],
      ['signed by someone else', await sign(good, undefined, strangerKey)],
      ['an unknown key', await sign(good, { alg: 'RS256', kid: 'key-9' })],
      ['unsigned', `${encode({ alg: 'none', kid: 'key-1' })}.${encode(good)}.`],
      ['not a token', 'hello'],
      ['empty', ''],
    ];
    for (const [why, token] of refused) {
      expect(await verifyIdToken(token, PROJECT, keys, now), why).toBeNull();
    }
    // Tampered with after signing.
    const [header, , signature] = (await sign(good)).split('.');
    const forged = `${header}.${encode({ ...good, email: 'stranger@example.com' })}.${signature}`;
    expect(await verifyIdToken(forged, PROJECT, keys, now)).toBeNull();
  });
});
