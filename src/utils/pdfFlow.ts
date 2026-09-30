/**
 * A small page-layout engine for the recipe PDF: wraps styled text into lines and flows blocks
 * down columns, breaking to the next column where a block won't fit. It only measures and
 * places. The drawing, and the fonts that give text its width, are the caller's
 * (services/recipePdf). Lengths are PDF points, and y runs down the page from its top edge.
 */

export type FontKey = 'serif' | 'sans' | 'sansBold';
export type InkKey = 'ink' | 'muted' | 'accent' | 'rule';

export interface TextStyle {
  font: FontKey;
  size: number;
  ink: InkKey;
  /** Extra space after each character (letter-spacing), in points. */
  tracking?: number;
}

export interface Run {
  text: string;
  style: TextStyle;
}

/** Measures text as the fonts will draw it. */
export type MeasureText = (text: string, style: TextStyle) => number;

export type Mark =
  /** Text on one line; `y` is its baseline. */
  | { type: 'text'; x: number; y: number; text: string; style: TextStyle }
  /** A photo, from its top-left corner. */
  | { type: 'image'; x: number; y: number; width: number; height: number; src: string }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; ink: InkKey; weight: number };

/** Something laid out at a width: its height, and its marks from its own top-left corner. */
export interface Box {
  height: number;
  marks: Mark[];
  /**
   * Heights at which it may be split across columns, from its top, when it's too tall to fit
   * any column whole. None: it's never split.
   */
  breaks?: number[];
  /**
   * Heights at which it may be split whenever it doesn't fit the room left in a column (between
   * a fork's ways), rather than moving whole to the next column.
   */
  softBreaks?: number[];
}

export interface Line {
  segments: { text: string; style: TextStyle; x: number }[];
  width: number;
}

interface Token {
  text: string;
  style: TextStyle;
  kind: 'word' | 'space' | 'newline';
}

function tokenize(runs: Run[]): Token[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    for (const part of run.text.split(/(\n|[^\S\n]+)/)) {
      if (!part) continue;
      const kind = part === '\n' ? 'newline' : /^\s+$/.test(part) ? 'space' : 'word';
      tokens.push({ text: kind === 'space' ? ' ' : part, style: run.style, kind });
    }
  }
  return tokens;
}

/** Splits a word too long for a line into pieces that fit (at least one character each). */
function splitWord(word: Token, width: number, measure: MeasureText): Token[] {
  const pieces: Token[] = [];
  let piece = '';
  for (const ch of word.text) {
    if (piece && measure(piece + ch, word.style) > width) {
      pieces.push({ ...word, text: piece });
      piece = '';
    }
    piece += ch;
  }
  if (piece) pieces.push({ ...word, text: piece });
  return pieces;
}

/**
 * Wraps styled runs into lines no wider than `width`, breaking at spaces (and at "\n"). A word
 * wider than a whole line is broken between its letters. Spaces at the ends of lines are dropped.
 */
export function wrapRuns(runs: Run[], width: number, measure: MeasureText): Line[] {
  const lines: Token[][] = [[]];
  let lineWidth = 0;
  let pendingSpace: Token | null = null;

  const newLine = () => {
    lines.push([]);
    lineWidth = 0;
    pendingSpace = null;
  };

  for (const token of tokenize(runs)) {
    const line = lines[lines.length - 1];
    if (token.kind === 'newline') {
      newLine();
      continue;
    }
    if (token.kind === 'space') {
      if (line.length > 0) pendingSpace = token;
      continue;
    }
    const spaceWidth = pendingSpace ? measure(' ', pendingSpace.style) : 0;
    const wordWidth = measure(token.text, token.style);
    if (line.length > 0 && lineWidth + spaceWidth + wordWidth > width) newLine();
    const current = lines[lines.length - 1];
    const pieces = wordWidth > width ? splitWord(token, width, measure) : [token];
    pieces.forEach((piece, i) => {
      if (i > 0) newLine();
      const target = lines[lines.length - 1];
      if (pendingSpace && target === current && target.length > 0) {
        target.push(pendingSpace);
        lineWidth += spaceWidth;
      }
      pendingSpace = null;
      target.push(piece);
      lineWidth += measure(piece.text, piece.style);
    });
  }

  return lines.map((tokens) => {
    const segments: Line['segments'] = [];
    let x = 0;
    for (const token of tokens) {
      const last = segments[segments.length - 1];
      if (last && last.style === token.style) last.text += token.text;
      else segments.push({ text: token.text, style: token.style, x });
      x += measure(token.text, token.style);
    }
    return { segments, width: x };
  });
}

/** Where the baseline of a line sits below the line's top, centring capitals in the line. */
export function baselineIn(lineHeight: number, size: number): number {
  return (lineHeight + size * 0.68) / 2;
}

/** Wrapped text as a box, with a break allowed after every line. */
export function paragraph(
  runs: Run[],
  width: number,
  lineHeight: number,
  measure: MeasureText,
  align: 'left' | 'right' = 'left',
): Box {
  const lines = wrapRuns(runs, width, measure);
  const size = Math.max(...runs.map((r) => r.style.size));
  const marks: Mark[] = [];
  lines.forEach((line, i) => {
    const shift = align === 'right' ? width - line.width : 0;
    for (const seg of line.segments) {
      marks.push({
        type: 'text',
        x: seg.x + shift,
        y: i * lineHeight + baselineIn(lineHeight, size),
        text: seg.text,
        style: seg.style,
      });
    }
  });
  const breaks = lines.slice(1).map((_, i) => (i + 1) * lineHeight);
  return { height: lines.length * lineHeight, marks, breaks };
}

/** Moves a box's marks by (dx, dy). */
export function offsetMarks(marks: Mark[], dx: number, dy: number): Mark[] {
  return marks.map((m) =>
    m.type === 'line'
      ? { ...m, x1: m.x1 + dx, x2: m.x2 + dx, y1: m.y1 + dy, y2: m.y2 + dy }
      : { ...m, x: m.x + dx, y: m.y + dy },
  );
}

/** Stacks boxes one under another with `gap` between them, keeping each one's breaks. */
export function stack(boxes: Box[], gap = 0, indent = 0): Box {
  const marks: Mark[] = [];
  const breaks: number[] = [];
  let y = 0;
  boxes.forEach((box, i) => {
    if (i > 0) {
      y += gap;
      breaks.push(y);
    }
    marks.push(...offsetMarks(box.marks, indent, y));
    for (const b of box.breaks ?? []) breaks.push(y + b);
    y += box.height;
  });
  return { height: y, marks, breaks };
}

/** The part of a box between two heights, moved up to start at 0. */
export function sliceBox(box: Box, from: number, to: number): Box {
  const marks: Mark[] = [];
  for (const m of box.marks) {
    if (m.type === 'line') {
      const top = Math.min(m.y1, m.y2);
      const bottom = Math.max(m.y1, m.y2);
      if (bottom <= from || top >= to) {
        // A rule lying exactly on the top edge belongs to the part above.
        if (!(top === bottom && top >= from && top < to)) continue;
      }
      const clip = (y: number) => Math.min(Math.max(y, from), to) - from;
      marks.push({ ...m, y1: clip(m.y1), y2: clip(m.y2) });
    } else if (m.type === 'image' ? m.y >= from && m.y < to : m.y > from && m.y <= to) {
      marks.push({ ...m, y: m.y - from });
    }
  }
  const within = (list: number[] = []) =>
    list.filter((b) => b > from && b < to).map((b) => b - from);
  return {
    height: to - from,
    marks,
    breaks: within(box.breaks),
    softBreaks: within(box.softBreaks),
  };
}

export interface FlowItem {
  /** Space above it, unless it starts a column. */
  space: number;
  /** Keep it in the same column as the item after it. */
  keepWithNext?: boolean;
  layout: (width: number) => Box;
}

/** The lowest of the break heights that fits in `room`, or 0 when none does. */
function lowest(breaks: number[] = [], room: number): number {
  return Math.max(0, ...breaks.filter((b) => b <= room));
}

export interface Column {
  x: number;
  top: number;
  bottom: number;
  width: number;
}

export interface Placed {
  /** Which column (0, 1, …) it went into. */
  column: number;
  marks: Mark[];
}

/**
 * Flows items down columns: each goes under the one before, and one that won't fit starts the
 * next column, taking with it the items it's kept with. Only something too tall for a whole
 * column is split, at the lowest break that fits.
 */
export function flow(items: FlowItem[], column: (index: number) => Column): Placed[] {
  const placed: Placed[] = [];
  let index = 0;
  let col = column(0);
  let y = col.top;
  let empty = true;

  const nextColumn = () => {
    index += 1;
    col = column(index);
    y = col.top;
    empty = true;
  };
  const place = (box: Box, space: number) => {
    if (!empty) y += space;
    placed.push({ column: index, marks: offsetMarks(box.marks, col.x, y) });
    y += box.height;
    empty = false;
  };

  // Items still to place; a split item's remainder goes back on the front.
  const queue: { item: FlowItem; box?: Box }[] = items.map((item) => ({ item }));
  while (queue.length > 0) {
    let end = 0;
    while (end < queue.length - 1 && queue[end].item.keepWithNext) end += 1;
    const chain = queue.slice(0, end + 1);
    const boxes = chain.map((c) => c.box ?? c.item.layout(col.width));
    const height = boxes.reduce(
      (sum, box, i) => sum + box.height + (i === 0 && empty ? 0 : chain[i].item.space),
      0,
    );
    if (y + height <= col.bottom) {
      boxes.forEach((box, i) => place(box, chain[i].item.space));
      queue.splice(0, chain.length);
      continue;
    }
    if (!empty) {
      // Something that may be split between its parts fills the room left, rather than
      // leaving it empty.
      const [only] = boxes;
      const room = col.bottom - y - chain[0].item.space;
      const soft = chain.length === 1 && lowest(only.softBreaks, room);
      if (soft) {
        place(sliceBox(only, 0, soft), chain[0].item.space);
        queue[0] = { item: { ...chain[0].item, space: 0 }, box: sliceBox(only, soft, only.height) };
      }
      nextColumn();
      continue;
    }
    // Too tall for a whole column: place what fits, and carry the rest on.
    const [first] = boxes;
    if (y + first.height <= col.bottom) {
      place(first, chain[0].item.space);
      queue.shift();
      continue;
    }
    const room = col.bottom - y;
    const cut = lowest([...(first.breaks ?? []), ...(first.softBreaks ?? [])], room);
    if (!cut) {
      // Nowhere to break it: it overflows the column rather than being lost.
      place(first, 0);
      queue.shift();
      continue;
    }
    place(sliceBox(first, 0, cut), 0);
    queue[0] = { item: { ...chain[0].item, space: 0 }, box: sliceBox(first, cut, first.height) };
    nextColumn();
  }
  return placed;
}
