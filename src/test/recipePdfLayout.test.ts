import { describe, it, expect } from 'vitest';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { printableRecipe } from '../utils/printableRecipe';
import { PAGE, PdfPage, layoutRecipePdf } from '../utils/recipePdfLayout';
import { MeasureText } from '../utils/pdfFlow';

const t = UI_TEXT.en;
const measure: MeasureText = (text) => [...text].length * 5;

type Placed = { page: number; x: number; y: number; text: string };

/** Every line of text, in reading order down the pages (footers left out). */
function lines(pages: PdfPage[]): Placed[] {
  return pages
    .flatMap((p, page) =>
      p.marks.flatMap((m) => (m.type === 'text' ? [{ page, x: m.x, y: m.y, text: m.text }] : [])),
    )
    .filter((m) => m.y < PAGE.height - 40)
    .sort((a, b) => a.page - b.page || a.y - b.y);
}

const layout = (recipe: Recipe) =>
  lines(layoutRecipePdf(printableRecipe(recipe, 'en', t, { photos: false }), measure, () => null));

const indexOf = (placed: Placed[], text: string) => placed.findIndex((m) => m.text.includes(text));

describe('the crucial note and kitchen tip in the PDF', () => {
  it('puts the note across the page above the ingredients, and the tip after the method', () => {
    const placed = layout(WANDAS_CHEESE_BREAD);
    const note = placed[indexOf(placed, 'CRUCIAL NOTE')];
    const flour = placed[indexOf(placed, 'All-Purpose Flour')];
    expect(note).toBeDefined();
    expect(note.page).toBe(0);
    // At the page's left margin, past the box's accent bar.
    expect(note.x).toBe(PAGE.margin + 11);
    expect(note.y).toBeLessThan(flour.y);
    // The method column starts below the note too.
    const method = placed.filter((m) => m.page === 0 && m.x > flour.x + 100);
    expect(Math.min(...method.map((m) => m.y))).toBeGreaterThan(note.y);

    // Nothing but the tip itself comes after its label: not a step, not the baking options.
    const tip = indexOf(placed, 'KITCHEN TIP');
    expect(tip).toBeGreaterThan(indexOf(placed, 'BAKING OPTIONS'));
    const after = placed
      .slice(tip + 1)
      .map((m) => m.text)
      .join(' ');
    expect(after.replace(/\s+/g, ' ').trim()).toBe(
      'Use a non-stick spatula or similar tool for handling the dough.',
    );
  });

  it('shows only the one there is, or neither', () => {
    const noteOnly = layout({ ...WANDAS_CHEESE_BREAD, tips: '' });
    expect(indexOf(noteOnly, 'CRUCIAL NOTE')).toBeGreaterThanOrEqual(0);
    expect(indexOf(noteOnly, 'KITCHEN TIP')).toBe(-1);

    const tipOnly = layout({ ...WANDAS_CHEESE_BREAD, notes: undefined });
    expect(indexOf(tipOnly, 'CRUCIAL NOTE')).toBe(-1);
    expect(indexOf(tipOnly, 'KITCHEN TIP')).toBeGreaterThanOrEqual(0);
    // Without a note, the columns start right under the title, as before.
    const flour = (placed: Placed[]) => placed[indexOf(placed, 'All-Purpose Flour')].y;
    expect(flour(tipOnly)).toBeLessThan(flour(noteOnly));

    const neither = layout({ ...WANDAS_CHEESE_BREAD, notes: '  ', tips: undefined });
    expect(indexOf(neither, 'CRUCIAL NOTE')).toBe(-1);
    expect(indexOf(neither, 'KITCHEN TIP')).toBe(-1);
  });

  it('lets a note too long for the top lead the method instead of crowding out the page', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Line ${i + 1} of a very long note.`);
    const placed = layout({ ...WANDAS_CHEESE_BREAD, notes: long.join('\n') });
    const note = placed[indexOf(placed, 'CRUCIAL NOTE')];
    const flour = placed[indexOf(placed, 'All-Purpose Flour')];
    expect(note.x).toBeGreaterThan(flour.x);
    expect(note.y).toBeLessThanOrEqual(flour.y + 20);
    expect(indexOf(placed, 'Line 60 of')).toBeLessThan(indexOf(placed, 'KITCHEN TIP'));
  });
});
