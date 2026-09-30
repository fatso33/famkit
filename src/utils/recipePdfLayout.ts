import {
  Box,
  Column,
  FlowItem,
  Mark,
  MeasureText,
  Run,
  TextStyle,
  baselineIn,
  flow,
  offsetMarks,
  paragraph,
  stack,
} from './pdfFlow';
import {
  PrintExtras,
  PrintIngredient,
  PrintIngredientGroup,
  PrintList,
  PrintSection,
  PrintStep,
  PrintableRecipe,
  substepLabel,
} from './printableRecipe';

/**
 * The recipe PDF's design: a US letter page with ¾-inch margins, the title across the top, then
 * the ingredients in a narrow column beside the method, as in a cookbook. Where the ingredients
 * have ended, the method takes the page's whole width. It's printed ink: no filled areas, only
 * text, hairlines and (when chosen) the photos.
 */

export const PAGE = { width: 612, height: 792, margin: 54 };
const CONTENT = PAGE.width - PAGE.margin * 2;
const BOTTOM = PAGE.height - PAGE.margin - 6;
const INGREDIENTS_WIDTH = 164;
const COLUMN_GAP = 26;
const METHOD_X = PAGE.margin + INGREDIENTS_WIDTH + COLUMN_GAP;
const METHOD_WIDTH = CONTENT - INGREDIENTS_WIDTH - COLUMN_GAP;
/** The step numbers' gutter. */
const GUTTER = 24;
const HERO_MAX_HEIGHT = 250;

const S = {
  title: { font: 'serif', size: 27, ink: 'ink' },
  credit: { font: 'sans', size: 9.5, ink: 'muted' },
  creditLead: { font: 'sansBold', size: 9.5, ink: 'ink' },
  label: { font: 'sansBold', size: 7.5, ink: 'accent', tracking: 1.1 },
  quietLabel: { font: 'sansBold', size: 7, ink: 'muted', tracking: 1 },
  yield: { font: 'sans', size: 9, ink: 'muted' },
  groupHeading: { font: 'sansBold', size: 9.5, ink: 'ink' },
  ingredient: { font: 'sans', size: 9.5, ink: 'ink' },
  amount: { font: 'sansBold', size: 9.5, ink: 'ink' },
  small: { font: 'sans', size: 8.5, ink: 'muted' },
  body: { font: 'sans', size: 10, ink: 'ink' },
  number: { font: 'serif', size: 12.5, ink: 'accent' },
  pathLabel: { font: 'sansBold', size: 9.5, ink: 'accent' },
  subMark: { font: 'sansBold', size: 9, ink: 'muted' },
  bullet: { font: 'sansBold', size: 9, ink: 'accent' },
  footer: { font: 'sansBold', size: 7, ink: 'muted', tracking: 1 },
  pageNumber: { font: 'sans', size: 8, ink: 'muted' },
} satisfies Record<string, TextStyle>;

const LH = { title: 31, credit: 13.5, body: 14, ingredient: 13, small: 11.5, label: 11 };

export interface ImageSize {
  width: number;
  height: number;
}

export interface PdfPage {
  marks: Mark[];
}

interface Ctx {
  measure: MeasureText;
  imageSize: (src: string) => ImageSize | null;
  upper: (text: string) => string;
  /** The line over a fork's ways ("Choose one"). */
  chooseOne: string;
}

const text = (value: string, style: TextStyle): Run[] => [{ text: value, style }];

/** A tracked capital label ("INGREDIENTS") over a hairline, as the columns' and sections' heads. */
function headingBox(title: string, width: number, ctx: Ctx): Box {
  const label = paragraph(text(ctx.upper(title), S.label), width, LH.label, ctx.measure);
  const ruleY = label.height + 3;
  return {
    height: ruleY + 7,
    marks: [
      ...label.marks,
      { type: 'line', x1: 0, y1: ruleY, x2: width, y2: ruleY, ink: 'rule', weight: 0.5 },
    ],
  };
}

/** Text in a thin-ruled margin: a step's tip. */
function noteBox(note: string, width: number, ctx: Ctx): Box {
  const body = paragraph(text(note, S.small), width - 8, LH.small, ctx.measure);
  return {
    ...body,
    marks: [
      { type: 'line', x1: 0.5, y1: 1, x2: 0.5, y2: body.height - 1, ink: 'rule', weight: 1 },
      ...offsetMarks(body.marks, 8, 0),
    ],
  };
}

/**
 * Content with a photo at its right, the content wrapping in the width left beside it. The
 * content isn't split beside the photo.
 */
function withPhoto(
  photo: string | undefined,
  width: number,
  ctx: Ctx,
  content: (w: number) => Box,
) {
  const size = photo ? ctx.imageSize(photo) : null;
  if (!photo || !size) return content(width);
  const aspect = size.width / size.height;
  let w = Math.min(112, width * 0.34);
  let h = w / aspect;
  if (h > 126) {
    h = 126;
    w = h * aspect;
  }
  const box = content(width - w - 12);
  return {
    height: Math.max(box.height, h),
    marks: [
      ...box.marks,
      { type: 'image', x: width - w, y: 2, width: w, height: h, src: photo } as Mark,
    ],
    breaks: (box.breaks ?? []).filter((b) => b > h + 2),
  };
}

/** A step's text, then its tip. */
function withNote(main: Box, extras: PrintExtras, width: number, ctx: Ctx): Box {
  return extras.note ? stack([main, noteBox(extras.note, width, ctx)], 5) : main;
}

/** A numbered line of a list: its mark ("a)", "2.", "•") in a small hanging gutter. */
function markedLine(
  mark: string,
  body: string,
  width: number,
  ctx: Ctx,
  markStyle: TextStyle = S.subMark,
) {
  const hang = 14;
  const box = paragraph(text(body, S.body), width - hang, LH.body, ctx.measure);
  const markBox = paragraph(text(mark, markStyle), hang, LH.body, ctx.measure);
  return { ...box, marks: [...markBox.marks, ...offsetMarks(box.marks, hang, 0)] };
}

/** The step number, set on the first line's baseline. */
function numberMarks(n: number, baseline: number, ctx: Ctx): Mark[] {
  const label = String(n);
  const x = GUTTER - 8 - ctx.measure(label, S.number);
  return [{ type: 'text', x, y: baseline, text: label, style: S.number }];
}

function stepBox(step: PrintStep, width: number, ctx: Ctx): Box {
  if (step.kind === 'plain') {
    return withPhoto(step.photo, width, ctx, (w) =>
      withNote(paragraph(text(step.text, S.body), w, LH.body, ctx.measure), step, w, ctx),
    );
  }
  const inner = width - GUTTER;
  let content: Box;
  let firstBaseline: number;
  if (step.kind === 'step') {
    content = withPhoto(step.photo, inner, ctx, (w) => {
      const main = stack(
        [
          paragraph(text(step.text, S.body), w, LH.body, ctx.measure),
          ...step.substeps.map((sub, i) => markedLine(substepLabel(i), sub, w, ctx)),
        ],
        3,
      );
      return withNote(main, step, w, ctx);
    });
    firstBaseline = baselineIn(LH.body, S.body.size);
  } else {
    const paths = step.paths.map((path) => {
      const bar = 10;
      const body = withPhoto(path.photo, inner - bar, ctx, (w) => {
        const main = stack(
          [
            paragraph(text(path.label, S.pathLabel), w, LH.ingredient, ctx.measure),
            paragraph(text(path.text, S.body), w, LH.body, ctx.measure),
            ...path.steps.map((s, i) => markedLine(`${i + 1}.`, s, w, ctx)),
          ],
          2,
        );
        return withNote(main, path, w, ctx);
      });
      return {
        ...body,
        marks: [
          { type: 'line', x1: 0.5, y1: 2, x2: 0.5, y2: body.height, ink: 'accent', weight: 1 },
          ...offsetMarks(body.marks, bar, 0),
        ] as Mark[],
      };
    });
    const choose = paragraph(
      text(ctx.upper(ctx.chooseOne), S.quietLabel),
      inner,
      LH.label,
      ctx.measure,
    );
    content = stack([choose, ...paths], 7);
    // It may split only where a way starts, and never before the second: the first way stays
    // with the number.
    let wayTop = choose.height + 7;
    content.softBreaks = paths.slice(0, -1).map((path) => (wayTop += path.height + 7));
    firstBaseline = baselineIn(LH.label, S.quietLabel.size) + 1.5;
  }
  return {
    height: content.height,
    marks: [
      ...numberMarks(step.number, firstBaseline, ctx),
      ...offsetMarks(content.marks, GUTTER, 0),
    ],
    breaks: content.breaks,
    softBreaks: content.softBreaks,
  };
}

function ingredientBox(row: PrintIngredient, width: number, ctx: Ctx): Box {
  const amountWidth = row.amount ? ctx.measure(row.amount, S.amount) : 0;
  const beside = amountWidth <= width * 0.45;
  const nameWidth = beside && row.amount ? width - amountWidth - 8 : width;
  const name = paragraph(text(row.name, S.ingredient), nameWidth, LH.ingredient, ctx.measure);
  const parts: Box[] = [name];
  if (row.amount && beside) {
    name.marks.push({
      type: 'text',
      x: width - amountWidth,
      y: baselineIn(LH.ingredient, S.amount.size),
      text: row.amount,
      style: S.amount,
    });
  } else if (row.amount) {
    parts.push(paragraph(text(row.amount, S.amount), width, LH.ingredient, ctx.measure));
  }
  if (row.note) parts.push(paragraph(text(row.note, S.small), width, LH.small, ctx.measure));
  if (row.substitute) {
    parts.push(paragraph(text(row.substitute, S.small), width, LH.small, ctx.measure));
  }
  // A row is never split.
  return { ...stack(parts, 1), breaks: [] };
}

/** Rows kept together at a group's start and end, so no row is left alone. */
function rowItems(group: PrintIngredientGroup, ctx: Ctx): FlowItem[] {
  const n = group.rows.length;
  return group.rows.map((row, i) => ({
    space: i === 0 ? 0 : 6,
    keepWithNext: i < n - 1 && (n <= 4 || i === 0 || i === n - 2),
    layout: (w) => ingredientBox(row, w, ctx),
  }));
}

function ingredientItems(r: PrintableRecipe, ctx: Ctx): FlowItem[] {
  const groups = r.ingredients.filter((g) => g.rows.length > 0);
  if (groups.length === 0) return [];
  const items: FlowItem[] = [
    {
      space: 0,
      keepWithNext: true,
      layout: (w) => {
        const head = headingBox(r.labels.ingredients, w, ctx);
        if (!r.yieldText.trim()) return head;
        return stack([head, paragraph(text(r.yieldText, S.yield), w, LH.small, ctx.measure)], 0);
      },
    },
  ];
  groups.forEach((group, g) => {
    if (group.heading) {
      items.push({
        space: g === 0 ? 6 : 14,
        keepWithNext: true,
        layout: (w) =>
          paragraph(text(group.heading, S.groupHeading), w, LH.ingredient, ctx.measure),
      });
    }
    const rows = rowItems(group, ctx);
    rows[0].space = group.heading ? 4 : g === 0 ? 6 : 14;
    items.push(...rows);
  });
  return items;
}

function calloutBox(label: string, body: string, width: number, ctx: Ctx): Box {
  const content = stack(
    [
      paragraph(text(ctx.upper(label), S.label), width - 11, LH.label, ctx.measure),
      paragraph(text(body, S.body), width - 11, LH.body, ctx.measure),
    ],
    1,
  );
  return {
    ...content,
    marks: [
      {
        type: 'line',
        x1: 0.75,
        y1: 1,
        x2: 0.75,
        y2: content.height - 1,
        ink: 'accent',
        weight: 1.5,
      },
      ...offsetMarks(content.marks, 11, 0),
    ],
  };
}

function sectionItems(section: PrintSection, first: boolean, ctx: Ctx): FlowItem[] {
  return [
    {
      space: first ? 0 : 20,
      keepWithNext: section.steps.length > 0,
      layout: (w) => headingBox(section.heading, w, ctx),
    },
    ...section.steps.map((step, i) => ({
      space: i === 0 ? 2 : 10,
      layout: (w: number) => stepBox(step, w, ctx),
    })),
  ];
}

function listItems(list: PrintList, ctx: Ctx): FlowItem[] {
  const items: FlowItem[] = [
    { space: 20, keepWithNext: true, layout: (w) => headingBox(list.heading, w, ctx) },
  ];
  list.groups.forEach((group, g) => {
    if (group.label) {
      items.push({
        space: g === 0 ? 2 : 12,
        keepWithNext: true,
        layout: (w) => paragraph(text(group.label, S.pathLabel), w, LH.ingredient, ctx.measure),
      });
    }
    for (const item of group.items) {
      items.push({ space: 3, layout: (w) => markedLine('•', item, w, ctx, S.bullet) });
    }
  });
  return items;
}

function methodItems(r: PrintableRecipe, ctx: Ctx): FlowItem[] {
  const items: FlowItem[] = r.callouts.map((c, i) => ({
    space: i === 0 ? 0 : 12,
    layout: (w) => calloutBox(c.label, c.text, w, ctx),
  }));
  const sections = r.method.filter((s) => s.steps.length > 0);
  sections.forEach((section, i) => {
    const [head, ...rest] = sectionItems(section, i === 0 && items.length === 0, ctx);
    if (i === 0 && items.length > 0) head.space = 22;
    items.push(head, ...rest);
  });
  for (const list of r.lists) items.push(...listItems(list, ctx));
  if (items.length > 0) items[0].space = 0;
  return items;
}

/** The title, the credits and (when chosen) the photo, across the top of the first page. */
function headerBox(r: PrintableRecipe, ctx: Ctx): Box {
  const title = paragraph(text(r.title, S.title), CONTENT, LH.title, ctx.measure);
  const creditRuns: Run[] = r.credits.flatMap((c, i) => [
    ...(i > 0 ? [{ text: '  ·  ', style: S.credit }] : []),
    { text: c, style: i === 0 ? S.creditLead : S.credit },
  ]);
  const credits = paragraph(creditRuns, CONTENT, LH.credit, ctx.measure);
  const top = stack([title, credits], 6);
  const size = r.photo ? ctx.imageSize(r.photo) : null;
  if (r.photo && size) {
    const aspect = size.width / size.height;
    const w = Math.min(CONTENT, HERO_MAX_HEIGHT * aspect);
    const h = w / aspect;
    const y = top.height + 16;
    return {
      height: y + h + 22,
      marks: [
        ...top.marks,
        { type: 'image', x: (CONTENT - w) / 2, y, width: w, height: h, src: r.photo },
      ],
    };
  }
  const ruleY = top.height + 13;
  return {
    height: ruleY + 20,
    marks: [
      ...top.marks,
      { type: 'line', x1: 0, y1: ruleY, x2: CONTENT, y2: ruleY, ink: 'rule', weight: 0.5 },
    ],
  };
}

function footerMarks(r: PrintableRecipe, page: number, pages: number, ctx: Ctx): Mark[] {
  const y = PAGE.height - 32;
  const marks: Mark[] = [
    { type: 'text', x: PAGE.margin, y, text: ctx.upper(r.labels.footer), style: S.footer },
  ];
  if (pages > 1) {
    const label = `${page + 1} / ${pages}`;
    const x = PAGE.width - PAGE.margin - ctx.measure(label, S.pageNumber);
    marks.push({ type: 'text', x, y, text: label, style: S.pageNumber });
  }
  return marks;
}

/**
 * Lays the recipe out on letter pages. `measure` gives text's width as the PDF's fonts set it
 * (letter-spacing included); `imageSize` a photo's pixel size, or null to leave it out.
 */
export function layoutRecipePdf(
  r: PrintableRecipe,
  measure: MeasureText,
  imageSize: (src: string) => ImageSize | null,
): PdfPage[] {
  const locale = r.language === 'pl' ? 'pl-PL' : 'en-US';
  const ctx: Ctx = {
    measure,
    imageSize,
    upper: (s) => s.toLocaleUpperCase(locale),
    chooseOne: r.labels.chooseOne,
  };

  const header = headerBox(r, ctx);
  const columnsTop = PAGE.margin + header.height;
  const top = (page: number) => (page === 0 ? columnsTop : PAGE.margin);

  const ingredients = flow(ingredientItems(r, ctx), (i) => ({
    x: PAGE.margin,
    top: top(i),
    bottom: BOTTOM,
    width: INGREDIENTS_WIDTH,
  }));
  const ingredientPages = ingredients.reduce((n, p) => Math.max(n, p.column + 1), 0);

  const methodColumn = (i: number): Column =>
    i < ingredientPages
      ? { x: METHOD_X, top: top(i), bottom: BOTTOM, width: METHOD_WIDTH }
      : { x: PAGE.margin, top: top(i), bottom: BOTTOM, width: CONTENT };
  const method = flow(methodItems(r, ctx), methodColumn);

  const count = Math.max(1, ingredientPages, ...method.map((p) => p.column + 1));
  const pages: PdfPage[] = Array.from({ length: count }, () => ({ marks: [] }));
  pages[0].marks.push(...offsetMarks(header.marks, PAGE.margin, PAGE.margin));
  for (const p of [...ingredients, ...method]) pages[p.column].marks.push(...p.marks);
  pages.forEach((page, i) => page.marks.push(...footerMarks(r, i, count, ctx)));
  return pages;
}
