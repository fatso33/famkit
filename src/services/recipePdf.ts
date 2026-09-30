import { FontKey, InkKey, Mark, TextStyle } from '../utils/pdfFlow';
import { PdfImage, PdfWriter, num } from '../utils/pdfWriter';
import { PrintableRecipe } from '../utils/printableRecipe';
import { ImageSize, PAGE, layoutRecipePdf } from '../utils/recipePdfLayout';
import { TrueTypeFont, parseTrueType } from '../utils/trueType';
import serif600Latin from '../assets/fonts/pdf/serif-600-latin.ttf?url';
import serif600LatinExt from '../assets/fonts/pdf/serif-600-latin-ext.ttf?url';
import sans400Latin from '../assets/fonts/pdf/sans-400-latin.ttf?url';
import sans400LatinExt from '../assets/fonts/pdf/sans-400-latin-ext.ttf?url';
import sans400Fractions from '../assets/fonts/pdf/sans-400-fractions.ttf?url';
import sans600Latin from '../assets/fonts/pdf/sans-600-latin.ttf?url';
import sans600LatinExt from '../assets/fonts/pdf/sans-600-latin-ext.ttf?url';
import sans600Fractions from '../assets/fonts/pdf/sans-600-fractions.ttf?url';

/**
 * Makes a recipe's PDF on the phone: nothing is sent anywhere. App loads this only when someone
 * downloads a recipe (services/recipePdfLoader).
 *
 * The fonts are the app's own Fraunces and Source Sans 3, set at fixed weights for print (a PDF
 * can't vary a font's weight), in the same pieces as the app's: Latin, Latin Extended for Polish
 * and other accents, and the fractions ⅓ ⅔ ⅛. Only the pieces a recipe's text needs are fetched
 * and put in the file.
 */

interface Piece {
  url: string;
  /** Its name in the PDF. */
  name: string;
}

const piece = (url: string, name: string): Piece => ({ url, name });
const SERIF = piece(serif600Latin, 'Fraunces-SemiBold');
const SANS = piece(sans400Latin, 'SourceSans3-Regular');
const SANS_BOLD = piece(sans600Latin, 'SourceSans3-SemiBold');
const SANS_FRACTIONS = piece(sans400Fractions, 'SourceSans3-Regular-Fractions');
const SANS_BOLD_FRACTIONS = piece(sans600Fractions, 'SourceSans3-SemiBold-Fractions');

/** Each style's pieces, in the order its letters are looked for. */
const FACES: Record<FontKey, Piece[]> = {
  serif: [SERIF, piece(serif600LatinExt, 'Fraunces-SemiBold-LatinExt'), SANS_BOLD_FRACTIONS],
  sans: [SANS, piece(sans400LatinExt, 'SourceSans3-Regular-LatinExt'), SANS_FRACTIONS],
  sansBold: [
    SANS_BOLD,
    piece(sans600LatinExt, 'SourceSans3-SemiBold-LatinExt'),
    SANS_BOLD_FRACTIONS,
  ],
};
/** The Latin pieces, which every recipe needs. */
const LATIN = [SERIF, SANS, SANS_BOLD];

/** The inks, as RGB from 0 to 1. */
const INKS: Record<InkKey, string> = {
  ink: '0.129 0.114 0.098',
  muted: '0.431 0.4 0.369',
  accent: '0.545 0.29 0.169',
  rule: '0.812 0.776 0.737',
};

/** Fetches a font piece's bytes, given its URL. Tests read them from disk instead. */
export type FontSource = (url: string) => Promise<ArrayBuffer | Uint8Array>;

const fetchFont: FontSource = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font ${url}: HTTP ${response.status}`);
  return response.arrayBuffer();
};

/**
 * Text as the fonts set it: unusual spaces become plain ones, and invisible characters (which
 * would draw nothing, or a box) go.
 */
export function printableText(text: string): string {
  return text
    .replace(/[\t\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u00ad\u200b-\u200f\u2028\u2029\u2060-\u2064\ufeff]/g, '')
    .replace(/\r\n?/g, '\n');
}

/** Every piece of text in the recipe cleaned for printing, its photos left as they are. */
function cleanRecipe(recipe: PrintableRecipe): PrintableRecipe {
  const clean = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string') return key === 'photo' ? value : printableText(value);
    if (Array.isArray(value)) return value.map((v) => clean(v));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k)]));
    }
    return value;
  };
  return clean(recipe) as PrintableRecipe;
}

/** All the recipe's text, in capitals too (the labels are set in capitals). */
function allText(recipe: PrintableRecipe): string {
  const parts: string[] = [];
  const walk = (value: unknown, key = '') => {
    if (typeof value === 'string' && key !== 'photo') parts.push(value);
    else if (Array.isArray(value)) value.forEach((v) => walk(v));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(recipe);
  const text = parts.join(' ');
  return text + text.toLocaleUpperCase(recipe.language === 'pl' ? 'pl-PL' : 'en-US');
}

interface Face {
  font: TrueTypeFont;
  /** Its number in the PDF writer. */
  id: number;
}

/** The fonts in the PDF, and which one sets each letter. */
class FontBook {
  private faces = new Map<string, Face>();
  private widths = new Map<string, number>();

  constructor(private pdf: PdfWriter) {}

  async load(pieces: Piece[], source: FontSource) {
    const fresh = [...new Map(pieces.map((p) => [p.url, p])).values()].filter(
      (p) => !this.faces.has(p.url),
    );
    const fonts = await Promise.all(fresh.map(async (p) => parseTrueType(await source(p.url))));
    fresh.forEach((p, i) => {
      this.faces.set(p.url, { font: fonts[i], id: this.pdf.addFont(fonts[i], p.name) });
    });
  }

  covers(cp: number): boolean {
    return [...this.faces.values()].some((face) => face.font.glyphs.has(cp));
  }

  private faceFor(key: FontKey, cp: number): Face | undefined {
    for (const p of FACES[key]) {
      const face = this.faces.get(p.url);
      if (face?.font.glyphs.has(cp)) return face;
    }
    // Missing from its own font: any font that has it, rather than a blank.
    return [...this.faces.values()].find((face) => face.font.glyphs.has(cp));
  }

  /** The text cut into runs, each set in one font. Letters no font has are left out. */
  runs(text: string, key: FontKey): { face: Face; text: string }[] {
    const runs: { face: Face; text: string }[] = [];
    for (const ch of text) {
      const face = this.faceFor(key, ch.codePointAt(0)!);
      if (!face) continue;
      const last = runs[runs.length - 1];
      if (last?.face === face) last.text += ch;
      else runs.push({ face, text: ch });
    }
    return runs;
  }

  /** A run's width at `size`, letter-spacing included. */
  runWidth(run: { face: Face; text: string }, size: number, tracking: number): number {
    const { font } = run.face;
    let units = 0;
    let count = 0;
    for (const ch of run.text) {
      units += font.advances[font.glyphs.get(ch.codePointAt(0)!)!] ?? 0;
      count += 1;
    }
    return (units * size) / font.unitsPerEm + tracking * count;
  }

  measure = (text: string, style: TextStyle): number => {
    const key = `${style.font}|${style.size}|${style.tracking ?? 0}|${text}`;
    let width = this.widths.get(key);
    if (width === undefined) {
      width = this.runs(text, style.font).reduce(
        (sum, run) => sum + this.runWidth(run, style.size, style.tracking ?? 0),
        0,
      );
      this.widths.set(key, width);
    }
    return width;
  };
}

/** A photo as JPEG, which a PDF holds as it is; other kinds are redrawn as JPEG first. */
async function photoJpeg(src: string): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return bytes;
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas to redraw the photo on');
  // A photo with transparency goes on white, as on paper.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  );
  if (!jpeg) throw new Error('The photo could not be redrawn as JPEG');
  return new Uint8Array(await jpeg.arrayBuffer());
}

function photoSources(recipe: PrintableRecipe): string[] {
  const photos = new Set<string>();
  if (recipe.photo) photos.add(recipe.photo);
  for (const section of recipe.method) {
    for (const step of section.steps) {
      if (step.kind === 'fork') step.paths.forEach((p) => p.photo && photos.add(p.photo));
      else if (step.photo) photos.add(step.photo);
    }
  }
  return [...photos];
}

/** A mark as PDF drawing operators. y runs up from the page's foot in a PDF, so it's flipped. */
function drawMark(
  mark: Mark,
  fonts: FontBook,
  pdf: PdfWriter,
  photos: Map<string, PdfImage>,
): string {
  const flip = (y: number) => num(PAGE.height - y);
  if (mark.type === 'line') {
    return (
      `q ${INKS[mark.ink]} RG ${num(mark.weight)} w ${num(mark.x1)} ${flip(mark.y1)} m ` +
      `${num(mark.x2)} ${flip(mark.y2)} l S Q`
    );
  }
  if (mark.type === 'image') {
    const photo = photos.get(mark.src);
    if (!photo) return '';
    return (
      `q ${num(mark.width)} 0 0 ${num(mark.height)} ${num(mark.x)} ` +
      `${flip(mark.y + mark.height)} cm /${photo.key} Do Q`
    );
  }
  const { style } = mark;
  const tracking = style.tracking ?? 0;
  const ops = [`BT ${INKS[style.ink]} rg ${num(tracking)} Tc`];
  let x = mark.x;
  for (const run of fonts.runs(mark.text, style.font)) {
    ops.push(
      `/${pdf.fontKey(run.face.id)} ${num(style.size)} Tf`,
      `1 0 0 1 ${num(x)} ${flip(mark.y)} Tm ${pdf.encode(run.face.id, run.text)} Tj`,
    );
    x += fonts.runWidth(run, style.size, tracking);
  }
  ops.push('ET');
  return ops.join(' ');
}

/**
 * The recipe's PDF, as the bytes of a file. A photo that can't be read is left out (the rest of
 * the recipe still comes); a font that can't be fetched fails it.
 */
export async function buildRecipePdf(
  content: PrintableRecipe,
  source: FontSource = fetchFont,
): Promise<Uint8Array<ArrayBuffer>> {
  const recipe = cleanRecipe(content);
  const pdf = new PdfWriter();

  const fonts = new FontBook(pdf);
  await fonts.load(LATIN, source);
  const needsMore = [...allText(recipe)].some(
    (ch) => ch.trim() && !fonts.covers(ch.codePointAt(0)!),
  );
  if (needsMore) await fonts.load(Object.values(FACES).flat(), source);

  const photos = new Map<string, PdfImage>();
  const jpegs = await Promise.all(
    photoSources(recipe).map(async (src) => {
      try {
        return [src, await photoJpeg(src)] as const;
      } catch (err) {
        console.warn('Recipe PDF: left out a photo that could not be read', err);
        return null;
      }
    }),
  );
  for (const entry of jpegs) {
    if (!entry) continue;
    try {
      photos.set(entry[0], pdf.addJpeg(entry[1]));
    } catch (err) {
      console.warn('Recipe PDF: left out a photo that could not be read', err);
    }
  }
  const sizeOf = (src: string): ImageSize | null => photos.get(src) ?? null;

  for (const page of layoutRecipePdf(recipe, fonts.measure, sizeOf)) {
    const ops = page.marks.map((mark) => drawMark(mark, fonts, pdf, photos)).filter(Boolean);
    pdf.addPage(PAGE.width, PAGE.height, ops.join('\n'));
  }

  return pdf.save({
    title: recipe.title,
    author: recipe.author,
    creator: recipe.labels.footer,
    language: recipe.language === 'pl' ? 'pl-PL' : 'en-US',
  });
}
