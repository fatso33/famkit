import { describe, it, expect } from 'vitest';
import {
  Box,
  FlowItem,
  MeasureText,
  TextStyle,
  flow,
  paragraph,
  sliceBox,
  wrapRuns,
} from '../utils/pdfFlow';

// Every character is 5pt wide, so widths are easy to count.
const measure: MeasureText = (text) => [...text].length * 5;
const body: TextStyle = { font: 'sans', size: 10, ink: 'ink' };
const bold: TextStyle = { font: 'sansBold', size: 10, ink: 'ink' };
const lineText = (runs: Parameters<typeof wrapRuns>[0], width: number) =>
  wrapRuns(runs, width, measure).map((l) => l.segments.map((s) => s.text).join(''));

describe('wrapping text', () => {
  it('breaks at spaces, within the width, dropping spaces at line ends', () => {
    // 50pt holds 10 characters.
    expect(lineText([{ text: 'Knead the dough until smooth', style: body }], 50)).toEqual([
      'Knead the',
      'dough',
      'until',
      'smooth',
    ]);
  });

  it('keeps each style in its own segment, placed after the one before', () => {
    const [line] = wrapRuns(
      [
        { text: 'By Wanda', style: bold },
        { text: ' · Time', style: body },
      ],
      500,
      measure,
    );
    expect(line.segments).toEqual([
      { text: 'By Wanda', style: bold, x: 0 },
      { text: ' · Time', style: body, x: 40 },
    ]);
    expect(line.width).toBe(75);
  });

  it('breaks a word too long for any line between its letters', () => {
    expect(lineText([{ text: 'Supercalifragilistic', style: body }], 50)).toEqual([
      'Supercalif',
      'ragilistic',
    ]);
  });

  it('starts a new line at a line break in the text', () => {
    expect(lineText([{ text: 'One\nTwo', style: body }], 500)).toEqual(['One', 'Two']);
  });
});

/** A box `lines` lines of 10pt high, breakable after each, tagged so its pieces can be found. */
const lines = (tag: string, count: number): Box =>
  paragraph(
    [{ text: Array.from({ length: count }, (_, i) => `${tag}${i}`).join('\n'), style: body }],
    500,
    10,
    measure,
  );
const item = (box: Box, extra: Partial<FlowItem> = {}): FlowItem => ({
  space: 0,
  layout: () => box,
  ...extra,
});
const columns = (height: number) => () => ({ x: 0, top: 0, bottom: height, width: 500 });
/** Which column each piece of text went into. */
const where = (placed: ReturnType<typeof flow>) =>
  Object.fromEntries(
    placed.flatMap((p) =>
      p.marks.flatMap((m) => (m.type === 'text' ? [[m.text, p.column] as const] : [])),
    ),
  );

describe('flowing blocks down columns', () => {
  it('moves a block that does not fit to the next column whole', () => {
    const placed = flow([item(lines('a', 6)), item(lines('b', 3))], columns(80));
    expect(where(placed)).toMatchObject({ a0: 0, a5: 0, b0: 1, b2: 1 });
  });

  it('takes a heading kept with the next block along with it', () => {
    const placed = flow(
      [item(lines('a', 5)), item(lines('h', 1), { keepWithNext: true }), item(lines('b', 3))],
      columns(80),
    );
    expect(where(placed)).toMatchObject({ a4: 0, h0: 1, b0: 1 });
  });

  it('splits a block taller than a whole column at its last break that fits', () => {
    const placed = flow([item(lines('a', 12))], columns(80));
    expect(where(placed)).toMatchObject({ a0: 0, a7: 0, a8: 1, a11: 1 });
    // The rest starts at the top of the next column.
    const next = placed.find((p) => p.column === 1)!;
    const first = next.marks.find((m) => m.type === 'text' && m.text === 'a8');
    expect(first && first.type === 'text' && first.y).toBeLessThan(10);
  });

  it('splits at a soft break to fill the room left rather than leave it empty', () => {
    const fork = { ...lines('f', 6), softBreaks: [30] };
    const placed = flow([item(lines('a', 4)), item(fork)], columns(80));
    expect(where(placed)).toMatchObject({ a3: 0, f0: 0, f2: 0, f3: 1, f5: 1 });
  });

  it('adds the space above a block, but not at the top of a column', () => {
    const placed = flow([item(lines('a', 1)), item(lines('b', 1), { space: 15 })], columns(80));
    const y = (text: string) =>
      placed.flatMap((p) => p.marks).find((m) => m.type === 'text' && m.text === text)!;
    expect((y('b0') as { y: number }).y - (y('a0') as { y: number }).y).toBe(25);
  });
});

describe('slicing a box', () => {
  it('keeps what lies between the heights and cuts rules to fit', () => {
    const box: Box = {
      height: 40,
      marks: [
        { type: 'line', x1: 0, y1: 0, x2: 0, y2: 40, ink: 'rule', weight: 1 },
        { type: 'text', x: 0, y: 8, text: 'top', style: body },
        { type: 'text', x: 0, y: 28, text: 'bottom', style: body },
      ],
    };
    const lower = sliceBox(box, 20, 40);
    expect(lower.height).toBe(20);
    expect(lower.marks).toEqual([
      { type: 'line', x1: 0, y1: 0, x2: 0, y2: 20, ink: 'rule', weight: 1 },
      { type: 'text', x: 0, y: 8, text: 'bottom', style: body },
    ]);
  });
});
