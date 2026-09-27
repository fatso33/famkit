import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { formatFraction } from '../utils/fractions';

// jsdom can't render fonts, so this checks the declarations instead: every glyph formatFraction
// can emit must come from the app's reading font, not the phone's fallback font.
const cssPath = resolve('src/index.css');
const css = readFileSync(cssPath, 'utf8');

// Google's `latin` subset of Plus Jakarta Sans covers U+0000–00FF, so ½ ¼ ¾ arrive with it. Its
// subsets stop short of the Number Forms block (⅓ ⅔ ⅛ ⅜ ⅝ ⅞), which needs its own face.
const inGoogleLatin = (cp: number) => cp <= 0xff;

function parseUnicodeRange(value: string): Array<[number, number]> {
  return value.split(',').map((part) => {
    const [lo, hi = lo] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(lo, 16), parseInt(hi, 16)];
  });
}

function emittedGlyphs(): string[] {
  const glyphs = new Set<string>();
  for (let n = 0; n <= 24; n++) {
    for (const ch of formatFraction(1 + n / 24)) if (ch.codePointAt(0)! > 0x7f) glyphs.add(ch);
  }
  return [...glyphs];
}

describe('fraction glyphs come from the reading font', () => {
  const fontSans = css.match(/--font-sans:\s*([^;]+);/)?.[1] ?? '';
  const firstFamily = fontSans
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
  const face = [...css.matchAll(/@font-face\s*{([^}]*)}/g)]
    .map((m) => m[1])
    .find((body) => body.match(/font-family:\s*['"]?([^;'"]+)/)?.[1] === firstFamily);

  it('emits all nine fractions, so the check below means something', () => {
    expect(emittedGlyphs().sort()).toEqual([...'¼½¾⅓⅔⅛⅜⅝⅞'].sort());
  });

  it('declares a self-hosted fraction face at the head of --font-sans', () => {
    expect(
      face,
      `no @font-face for "${firstFamily}", the first family in --font-sans`,
    ).toBeDefined();
    const url = face!.match(/url\(['"]?([^'")]+)/)?.[1] ?? '';
    expect(url).not.toMatch(/^https?:/);
    expect(existsSync(resolve(dirname(cssPath), url)), `${url} is missing`).toBe(true);
  });

  it('covers every fraction glyph formatFraction emits', () => {
    const ranges = parseUnicodeRange(face?.match(/unicode-range:\s*([^;]+)/)?.[1] ?? '');
    const uncovered = emittedGlyphs().filter((ch) => {
      const cp = ch.codePointAt(0)!;
      return !inGoogleLatin(cp) && !ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
    });
    expect(uncovered).toEqual([]);
  });
});
