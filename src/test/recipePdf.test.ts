// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { UI_TEXT } from '../i18n/translations';
import { getLocalizedRecipe } from '../hooks/useRecipes';
import { buildRecipePdf, printableText } from '../services/recipePdf';
import { printableRecipe } from '../utils/printableRecipe';
import { jpegInfo, num } from '../utils/pdfWriter';
import { parseTrueType } from '../utils/trueType';

// The font pieces' URLs (Vite's `?url`) are paths from the project's root.
const fontsFromDisk = vi.fn(async (url: string) => readFileSync(resolve('.' + url.split('?')[0])));
const photo =
  'data:image/jpeg;base64,' +
  readFileSync(resolve('public/cheese-bread-cutting-board-e1754529029689.jpg')).toString('base64');

const withPhotos = {
  ...WANDAS_CHEESE_BREAD,
  heroImage: photo,
  steps: WANDAS_CHEESE_BREAD.steps.map((s) => (s.hasImage ? { ...s, imageSrc: photo } : s)),
};

describe('the recipe PDF', () => {
  it("makes Wanda's bread as a letter-size PDF named for the recipe, with no photos", async () => {
    const content = printableRecipe(WANDAS_CHEESE_BREAD, 'en', UI_TEXT.en, { photos: false });
    const doc = await PDFDocument.load(await buildRecipePdf(content, fontsFromDisk));
    expect(doc.getTitle()).toBe("Wanda's Cheese Bread");
    expect(doc.getAuthor()).toBe('Wanda G.');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    for (const page of doc.getPages()) expect(page.getSize()).toEqual({ width: 612, height: 792 });
    // English needs only the Latin fonts.
    expect(fontsFromDisk.mock.calls.every(([url]) => url.includes('-latin.'))).toBe(true);
    expect(
      doc.context.enumerateIndirectObjects().some(([, o]) => String(o).includes('/Image')),
    ).toBe(false);
  });

  it('includes the photos when chosen', async () => {
    const content = printableRecipe(withPhotos, 'en', UI_TEXT.en, { photos: true });
    const bytes = await buildRecipePdf(content, fontsFromDisk);
    const doc = await PDFDocument.load(bytes);
    const images = doc.context
      .enumerateIndirectObjects()
      .filter(([, o]) => String(o).includes('/Subtype /Image'));
    // The same photo twice is held once.
    expect(images).toHaveLength(1);
  });

  it('leaves out a photo it cannot read, and still makes the rest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = { ...withPhotos, heroImage: 'data:image/jpeg;base64,bm90IGEgcGhvdG8=' };
    const content = printableRecipe(broken, 'en', UI_TEXT.en, { photos: true });
    const doc = await PDFDocument.load(await buildRecipePdf(content, fontsFromDisk));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('photo'), expect.anything());
    warn.mockRestore();
  });

  it('sets Polish in the Latin Extended fonts', async () => {
    fontsFromDisk.mockClear();
    const shown = getLocalizedRecipe(WANDAS_CHEESE_BREAD, 'pl')!;
    const content = printableRecipe(shown, 'pl', UI_TEXT.pl, { photos: false });
    const doc = await PDFDocument.load(await buildRecipePdf(content, fontsFromDisk));
    expect(doc.getTitle()).toBe(shown.name);
    expect(fontsFromDisk.mock.calls.some(([url]) => url.includes('-latin-ext.'))).toBe(true);
    // Each font says which letter each of its glyphs is, so the text copies out as written.
    const maps = doc.context
      .enumerateIndirectObjects()
      .filter(([, o]) => o instanceof PDFRawStream)
      .map(([, o]) => new TextDecoder().decode(decodePDFRawStream(o as PDFRawStream).decode()))
      .filter((text) => text.includes('beginbfchar'));
    const letters = maps
      .flatMap((m) => [...m.matchAll(/<[0-9a-f]{4}> <([0-9a-f]{4})>/g)])
      .map(([, hex]) => String.fromCharCode(parseInt(hex, 16)));
    expect(letters).toEqual(expect.arrayContaining([...'ąęłóśżźćń']));
  });
});

describe('text for the PDF fonts', () => {
  it('turns unusual spaces into plain ones and drops invisible characters', () => {
    expect(printableText('1\u2009cup\u00a0flour\u200b\ufeff\u00ad')).toBe('1 cup flour');
  });
});

describe('the PDF fonts', () => {
  const font = (file: string) => parseTrueType(readFileSync(resolve('src/assets/fonts/pdf', file)));
  const width = (file: string, text: string, size: number) => {
    const f = font(file);
    return (
      ([...text].reduce((sum, ch) => sum + f.advances[f.glyphs.get(ch.codePointAt(0)!)!], 0) *
        size) /
      f.unitsPerEm
    );
  };

  it('are read at the widths a font engine gives them', () => {
    // Measured with fontkit when the fonts were made.
    expect(width('serif-600-latin.ttf', 'Hamburger', 16)).toBeCloseTo(89.66, 1);
    expect(width('sans-400-latin.ttf', 'Hamburger', 16)).toBeCloseTo(76.42, 1);
    expect(width('sans-600-latin.ttf', 'Hamburger', 16)).toBeCloseTo(78.62, 1);
  });

  it('come in pieces: Latin, Latin Extended for Polish, and the fractions', () => {
    const has = (file: string, ch: string) => font(file).glyphs.has(ch.codePointAt(0)!);
    expect(has('sans-400-latin.ttf', 'a')).toBe(true);
    expect(has('sans-400-latin.ttf', 'ą')).toBe(false);
    expect(has('sans-400-latin-ext.ttf', 'ą')).toBe(true);
    expect(has('serif-600-latin-ext.ttf', 'Ż')).toBe(true);
    expect(has('sans-400-fractions.ttf', '⅓')).toBe(true);
    expect(has('sans-400-latin.ttf', '½')).toBe(true);
  });
});

describe('the PDF writer', () => {
  it('writes numbers briefly', () => {
    expect(num(12)).toBe('12');
    expect(num(0.5)).toBe('0.5');
    expect(num(1 / 3)).toBe('0.333');
    expect(num(-0.0001)).toBe('0');
  });

  it("reads a JPEG's size from its frame header", () => {
    const jpeg = readFileSync(resolve('public/cheese-bread-cutting-board-e1754529029689.jpg'));
    const { width, height, components } = jpegInfo(jpeg);
    expect(width).toBeGreaterThan(100);
    expect(height).toBeGreaterThan(100);
    expect(components).toBe(3);
    expect(() => jpegInfo(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
