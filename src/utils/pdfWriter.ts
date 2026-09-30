import { TrueTypeFont } from './trueType';

/**
 * A small PDF writer: pages drawn with PDF's own operators, TrueType fonts embedded whole (so any
 * letter they have can be set, and copied back out as text), and JPEG photos as they are. Streams
 * are compressed with the platform's CompressionStream where there is one. It writes PDF 1.7
 * that any reader opens; it reads nothing back.
 */

const ascii = new TextEncoder();

/** A number as a PDF writes it: at most three decimals, no trailing zeros. */
export function num(n: number): string {
  const s = (Math.round(n * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/** Text as a PDF string in UTF-16 (for the document's title and author). */
function textString(text: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex}>`;
}

const hex4 = (n: number) => n.toString(16).padStart(4, '0');

/** A code point in UTF-16, as hex. */
function utf16(cp: number): string {
  if (cp < 0x10000) return hex4(cp);
  const v = cp - 0x10000;
  return hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff));
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer> | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A JPEG's size and colour model, from its frame header. */
export function jpegInfo(bytes: Uint8Array): { width: number; height: number; components: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG');
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1];
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    // Start-of-frame markers, the ones that aren't DHT, JPG or DAC.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        height: (bytes[at + 5] << 8) | bytes[at + 6],
        width: (bytes[at + 7] << 8) | bytes[at + 8],
        components: bytes[at + 9],
      };
    }
    at += 2 + length;
  }
  throw new Error('JPEG has no frame header');
}

interface Face {
  font: TrueTypeFont;
  name: string;
  /** Resource name on the pages ("F1"). */
  key: string;
  /** Glyphs set in it, with the character each stands for. */
  used: Map<number, number>;
}

export interface PdfImage {
  key: string;
  width: number;
  height: number;
}

export interface PdfInfo {
  title: string;
  author: string;
  creator: string;
  language: string;
}

export class PdfWriter {
  private faces: Face[] = [];
  private images: { key: string; bytes: Uint8Array<ArrayBuffer>; components: number }[] = [];
  private pages: { width: number; height: number; content: string }[] = [];

  /** Adds a font; `name` is its PostScript-style name (no spaces). */
  addFont(font: TrueTypeFont, name: string): number {
    this.faces.push({ font, name, key: `F${this.faces.length + 1}`, used: new Map() });
    return this.faces.length - 1;
  }

  fontKey(face: number): string {
    return this.faces[face].key;
  }

  /** The text as the font's glyph ids, for a Tj operator. Letters it lacks are left out. */
  encode(face: number, text: string): string {
    const f = this.faces[face];
    let hex = '';
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      const glyph = f.font.glyphs.get(cp);
      if (glyph === undefined) continue;
      f.used.set(glyph, cp);
      hex += hex4(glyph);
    }
    return `<${hex}>`;
  }

  addJpeg(bytes: Uint8Array<ArrayBuffer>): PdfImage {
    const { width, height, components } = jpegInfo(bytes);
    const key = `Im${this.images.length + 1}`;
    this.images.push({ key, bytes, components });
    return { key, width, height };
  }

  addPage(width: number, height: number, content: string) {
    this.pages.push({ width, height, content });
  }

  async save(info: PdfInfo): Promise<Uint8Array<ArrayBuffer>> {
    const objects: (string | Uint8Array)[][] = [];
    const reserve = () => objects.push([]);
    const set = (ref: number, ...parts: (string | Uint8Array)[]) => (objects[ref - 1] = parts);
    const stream = async (dict: string, data: Uint8Array<ArrayBuffer>, extra = '') => {
      const packed = await deflate(data);
      const body = packed ?? data;
      return [
        `<< /Length ${body.length}${packed ? ' /Filter /FlateDecode' : ''}${extra} ${dict}>>\nstream\n`,
        body,
        '\nendstream',
      ];
    };

    const catalog = reserve();
    const pagesRef = reserve();
    const infoRef = reserve();

    const fontRefs: string[] = [];
    for (const face of this.faces) {
      const { font } = face;
      const scale = 1000 / font.unitsPerEm;
      const type0 = reserve();
      const cid = reserve();
      const descriptor = reserve();
      const file = reserve();
      const toUnicode = reserve();
      const glyphs = [...face.used.keys()].sort((a, b) => a - b);
      const widths = glyphs.map((g) => `${g} [${num(font.advances[g] * scale)}]`).join(' ');
      set(
        type0,
        `<< /Type /Font /Subtype /Type0 /BaseFont /${face.name} /Encoding /Identity-H`,
        ` /DescendantFonts [${cid} 0 R] /ToUnicode ${toUnicode} 0 R >>`,
      );
      set(
        cid,
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${face.name}`,
        ' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>',
        ` /FontDescriptor ${descriptor} 0 R /CIDToGIDMap /Identity /DW 0 /W [${widths}] >>`,
      );
      set(
        descriptor,
        `<< /Type /FontDescriptor /FontName /${face.name} /Flags 32`,
        ` /FontBBox [${font.bbox.map((v) => num(v * scale)).join(' ')}]`,
        ` /ItalicAngle ${num(font.italicAngle)} /Ascent ${num(font.ascent * scale)}`,
        ` /Descent ${num(font.descent * scale)} /CapHeight ${num(font.capHeight * scale)}`,
        ` /StemV 80 /FontFile2 ${file} 0 R >>`,
      );
      set(file, ...(await stream('', font.bytes, ` /Length1 ${font.bytes.length}`)));
      const chars = glyphs.map((g) => `<${hex4(g)}> <${utf16(face.used.get(g)!)}>`);
      const blocks: string[] = [];
      for (let i = 0; i < chars.length; i += 100) {
        const block = chars.slice(i, i + 100);
        blocks.push(`${block.length} beginbfchar\n${block.join('\n')}\nendbfchar`);
      }
      const cmap = [
        '/CIDInit /ProcSet findresource begin',
        '12 dict begin',
        'begincmap',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
        '/CMapName /Adobe-Identity-UCS def',
        '/CMapType 2 def',
        '1 begincodespacerange',
        '<0000> <FFFF>',
        'endcodespacerange',
        ...blocks,
        'endcmap',
        'CMapName currentdict /CIDInit /ProcSet findresource /DefineResource pop',
        'end',
        'end',
      ].join('\n');
      set(toUnicode, ...(await stream('', ascii.encode(cmap))));
      fontRefs.push(`/${face.key} ${type0} 0 R`);
    }

    const imageRefs: string[] = [];
    for (const image of this.images) {
      const ref = reserve();
      const space =
        image.components === 1
          ? '/DeviceGray'
          : image.components === 4
            ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]'
            : '/DeviceRGB';
      const { width, height } = jpegInfo(image.bytes);
      set(
        ref,
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height}`,
        ` /ColorSpace ${space} /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
        image.bytes,
        '\nendstream',
      );
      imageRefs.push(`/${image.key} ${ref} 0 R`);
    }

    const resources =
      `<< /Font << ${fontRefs.join(' ')} >>` +
      (imageRefs.length > 0 ? ` /XObject << ${imageRefs.join(' ')} >>` : '') +
      ' >>';
    const pageRefs: number[] = [];
    for (const page of this.pages) {
      const ref = reserve();
      const content = reserve();
      set(
        ref,
        `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}]`,
        ` /Resources ${resources} /Contents ${content} 0 R >>`,
      );
      set(content, ...(await stream('', ascii.encode(page.content))));
      pageRefs.push(ref);
    }

    set(catalog, `<< /Type /Catalog /Pages ${pagesRef} 0 R /Lang (${info.language}) >>`);
    set(
      pagesRef,
      `<< /Type /Pages /Kids [${pageRefs.map((r) => `${r} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`,
    );
    const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    set(
      infoRef,
      `<< /Title ${textString(info.title)} /Author ${textString(info.author)}`,
      ` /Creator ${textString(info.creator)} /Producer ${textString(info.creator)}`,
      ` /CreationDate (D:${now}Z) >>`,
    );

    // The file: header, each object at a recorded offset, then the table of those offsets.
    const chunks: Uint8Array[] = [];
    let length = 0;
    const write = (part: string | Uint8Array) => {
      const bytes = typeof part === 'string' ? ascii.encode(part) : part;
      chunks.push(bytes);
      length += bytes.length;
    };
    // The second line's bytes above 127 mark the file as binary, as the format advises.
    write('%PDF-1.7\n%');
    write(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]));
    write('\n');
    const offsets: number[] = [];
    objects.forEach((parts, i) => {
      offsets.push(length);
      write(`${i + 1} 0 obj\n`);
      parts.forEach(write);
      write('\nendobj\n');
    });
    const xref = length;
    write(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    for (const offset of offsets) write(`${String(offset).padStart(10, '0')} 00000 n \n`);
    const id = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0'),
    ).join('');
    write(
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${infoRef} 0 R /ID [<${id}> <${id}>] >>\n`,
    );
    write(`startxref\n${xref}\n%%EOF\n`);

    const out = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}
