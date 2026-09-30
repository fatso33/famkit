/**
 * Just enough of a TrueType font for setting text in a PDF: which glyph each character uses,
 * how wide each glyph is, and the measurements a PDF's font description asks for. Reads the
 * static font files made for the recipe PDF (src/assets/fonts/pdf); anything a font lacks
 * (kerning, ligatures) isn't used, and the PDF sets the glyphs one after another.
 */

export interface TrueTypeFont {
  /** The raw file, embedded whole in the PDF. */
  bytes: Uint8Array<ArrayBuffer>;
  unitsPerEm: number;
  /** Glyph id for each character (by code point) the font has. */
  glyphs: Map<number, number>;
  /** Each glyph's advance width, in font units. */
  advances: number[];
  ascent: number;
  descent: number;
  capHeight: number;
  italicAngle: number;
  bbox: [number, number, number, number];
}

class Reader {
  private view: DataView;
  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  u16 = (at: number) => this.view.getUint16(at);
  i16 = (at: number) => this.view.getInt16(at);
  u32 = (at: number) => this.view.getUint32(at);
  i32 = (at: number) => this.view.getInt32(at);
  tag = (at: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => this.view.getUint8(at + i)));
}

function readCmap(r: Reader, at: number): Map<number, number> {
  const glyphs = new Map<number, number>();
  const count = r.u16(at + 2);
  const tables = Array.from({ length: count }, (_, i) => ({
    platform: r.u16(at + 4 + i * 8),
    encoding: r.u16(at + 6 + i * 8),
    offset: at + r.u32(at + 8 + i * 8),
  }));
  // Full Unicode (format 12) if there is one, else the Basic Multilingual Plane (format 4).
  const pick =
    tables.find((t) => t.platform === 3 && t.encoding === 10 && r.u16(t.offset) === 12) ??
    tables.find((t) => t.platform === 0 && r.u16(t.offset) === 12) ??
    tables.find((t) => t.platform === 3 && t.encoding === 1 && r.u16(t.offset) === 4) ??
    tables.find((t) => t.platform === 0 && r.u16(t.offset) === 4);
  if (!pick) throw new Error('Font has no Unicode character map');
  const o = pick.offset;
  if (r.u16(o) === 12) {
    const groups = r.u32(o + 12);
    for (let g = 0; g < groups; g++) {
      const start = r.u32(o + 16 + g * 12);
      const end = r.u32(o + 20 + g * 12);
      const first = r.u32(o + 24 + g * 12);
      for (let cp = start; cp <= end; cp++) glyphs.set(cp, first + cp - start);
    }
    return glyphs;
  }
  const segments = r.u16(o + 6) / 2;
  const ends = o + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  for (let s = 0; s < segments; s++) {
    const end = r.u16(ends + s * 2);
    const start = r.u16(starts + s * 2);
    const delta = r.i16(deltas + s * 2);
    const rangeAt = ranges + s * 2;
    const range = r.u16(rangeAt);
    for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
      let glyph: number;
      if (range === 0) glyph = (cp + delta) & 0xffff;
      else {
        const raw = r.u16(rangeAt + range + (cp - start) * 2);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph !== 0) glyphs.set(cp, glyph);
    }
  }
  return glyphs;
}

export function parseTrueType(input: ArrayBuffer | Uint8Array): TrueTypeFont {
  const bytes = new Uint8Array(input);
  const r = new Reader(bytes);
  const tables = new Map<string, number>();
  const count = r.u16(4);
  for (let i = 0; i < count; i++) tables.set(r.tag(12 + i * 16), r.u32(20 + i * 16));
  const table = (tag: string) => {
    const at = tables.get(tag);
    if (at === undefined) throw new Error(`Font has no ${tag} table`);
    return at;
  };

  const head = table('head');
  const hhea = table('hhea');
  const hmtx = table('hmtx');
  const glyphCount = r.u16(table('maxp') + 4);
  const metrics = r.u16(hhea + 34);
  const advances: number[] = [];
  for (let g = 0; g < glyphCount; g++) {
    advances.push(r.u16(hmtx + Math.min(g, metrics - 1) * 4));
  }
  const os2 = tables.get('OS/2');
  const ascent = r.i16(hhea + 4);
  const post = tables.get('post');
  return {
    bytes,
    unitsPerEm: r.u16(head + 18),
    glyphs: readCmap(r, table('cmap')),
    advances,
    ascent,
    descent: r.i16(hhea + 6),
    capHeight: os2 !== undefined && r.u16(os2) >= 2 ? r.i16(os2 + 88) : Math.round(ascent * 0.7),
    italicAngle: post !== undefined ? r.i32(post + 4) / 65536 : 0,
    bbox: [r.i16(head + 36), r.i16(head + 38), r.i16(head + 40), r.i16(head + 42)],
  };
}
