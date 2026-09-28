import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { formatFraction } from '../utils/fractions';
import { UI_TEXT } from '../i18n/translations';

// jsdom can't render fonts, so these check the declarations instead: the text the app sets in
// each font must be covered by that font's self-hosted faces, not left to the phone's fallback.
const cssPath = resolve('src/index.css');
const css = readFileSync(cssPath, 'utf8');

interface Face {
  family: string;
  style: string;
  url: string;
  ranges: Array<[number, number]>;
}

function parseUnicodeRange(value: string): Array<[number, number]> {
  return value.split(',').map((part) => {
    const [lo, hi = lo] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(lo, 16), parseInt(hi, 16)];
  });
}

const faces: Face[] = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
  family: body.match(/font-family:\s*['"]?([^;'"]+)/)?.[1] ?? '',
  style: body.match(/font-style:\s*(\w+)/)?.[1] ?? 'normal',
  url: body.match(/url\(['"]?([^'")]+)/)?.[1] ?? '',
  ranges: parseUnicodeRange(body.match(/unicode-range:\s*([^;]+)/)?.[1] ?? 'U+0-10FFFF'),
}));

function firstFamily(token: string): string {
  const value = css.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1] ?? '';
  return value
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

/** Characters in `text` that no face of `family` in `style` covers. */
function uncovered(text: string, family: string, style = 'normal'): string[] {
  const own = faces.filter((f) => f.family === family && f.style === style);
  return [...new Set(text)].filter((ch) => {
    const cp = ch.codePointAt(0)!;
    return ch.trim() !== '' && !own.some((f) => f.ranges.some(([lo, hi]) => cp >= lo && cp <= hi));
  });
}

function emittedFractions(): string[] {
  const glyphs = new Set<string>();
  for (let n = 0; n <= 24; n++) {
    for (const ch of formatFraction(1 + n / 24)) if (ch.codePointAt(0)! > 0x7f) glyphs.add(ch);
  }
  return [...glyphs];
}

describe('self-hosted fonts', () => {
  const sans = firstFamily('--font-sans');
  const serif = firstFamily('--font-serif');

  it('leads both font stacks with a family the app hosts itself', () => {
    expect(faces.some((f) => f.family === sans)).toBe(true);
    expect(faces.some((f) => f.family === serif)).toBe(true);
  });

  it('points every face at a file in the repo, not at Google', () => {
    for (const face of faces) {
      expect(face.url).not.toMatch(/^https?:/);
      expect(existsSync(resolve(dirname(cssPath), face.url)), `${face.url} is missing`).toBe(true);
    }
    expect(readFileSync(resolve('index.html'), 'utf8')).not.toMatch(/fonts\.(googleapis|gstatic)/);
  });

  it('emits all nine fractions, so the next check means something', () => {
    expect(emittedFractions().sort()).toEqual([...'¼½¾⅓⅔⅛⅜⅝⅞'].sort());
  });

  it('draws every fraction formatFraction emits in the reading font', () => {
    expect(uncovered(emittedFractions().join(''), sans)).toEqual([]);
  });

  it('covers Polish in both fonts', () => {
    const polish = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';
    expect(uncovered(polish, sans)).toEqual([]);
    expect(uncovered(polish, serif)).toEqual([]);
  });

  it("has every letter of the splash's italic greeting in the italic subset", () => {
    for (const lang of ['en', 'pl'] as const) {
      expect(uncovered(UI_TEXT[lang].welcomeTo, serif, 'italic'), lang).toEqual([]);
    }
  });
});
