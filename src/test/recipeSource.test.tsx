import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Recipe } from '../types/recipe';
import { UI_TEXT } from '../i18n/translations';
import { RecipeSource } from '../components/recipe-detail/RecipeSource';
import { RecipeDetailView } from '../components/recipe-detail/RecipeDetailView';
import { RecipeSourceField } from '../components/recipe-form/RecipeSourceField';
import {
  localizeRecipe,
  overlayTranslation,
  resolveEdit,
  sourceHash,
  translatableContent,
} from '../utils/recipeTranslation';
import { buildTranslation, recipePieces } from '../utils/translationPieces';
import { diffRecipes } from '../utils/recipeVersions';
import { printableRecipe } from '../utils/printableRecipe';
import { layoutRecipePdf } from '../utils/recipePdfLayout';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

const t = UI_TEXT.en;

const babka: Recipe = {
  id: 'babka',
  name: 'Babka drożdżowa',
  author: 'Ola',
  category: 'cakes',
  heroImage: '',
  yieldHeader: '',
  ingredients: [{ text: 'Mąka - 500 g', name: 'Mąka', qty: 500, unit: 'g' }],
  steps: [{ num: 1, text: 'Piecz 50 minut.' }],
  sourceLanguage: 'pl',
};
const fromSite = { ...babka, sourceUrl: 'https://www.smittenkitchen.com/2024/03/chocolate-babka/' };
const fromNotebook = { ...babka, sourceText: 'Zeszyt cioci Oli' };

describe('where a recipe is from, in translation', () => {
  it("adds nothing to the fingerprint of a recipe with no words for it, so nothing's re-sent", () => {
    expect('source' in translatableContent(babka)).toBe(false);
    expect(sourceHash(fromSite)).toBe(sourceHash(babka));
    expect(sourceHash({ ...babka, sourceText: '  ' })).toBe(sourceHash(babka));
  });

  it('sends words as one short piece, and never a web address', () => {
    expect(
      recipePieces(translatableContent(fromNotebook)).filter((p) => p.kind === 'source'),
    ).toEqual([{ key: 'source', kind: 'source', text: 'Zeszyt cioci Oli' }]);
    expect(recipePieces(translatableContent(fromSite)).some((p) => p.kind === 'source')).toBe(
      false,
    );
  });

  it("shows the translation's words, and the original's until there are any", () => {
    const { content } = buildTranslation(translatableContent(fromNotebook), (p) =>
      p.kind === 'source' ? "Aunt Ola's notebook" : undefined,
    );
    expect(content.source).toBe("Aunt Ola's notebook");
    expect(overlayTranslation(fromNotebook, content).sourceText).toBe("Aunt Ola's notebook");
    expect(overlayTranslation(fromNotebook, { name: 'Babka' }).sourceText).toBe('Zeszyt cioci Oli');
    expect(localizeRecipe(fromSite, 'en').sourceUrl).toBe(fromSite.sourceUrl);
  });
});

describe('where a recipe is from, when it is edited', () => {
  // A link isn't text to translate, so an edit that changes only the link changes no words.
  it('keeps a link added, changed or removed in an edit that changes no words', () => {
    const save = (original: Recipe, edited: Recipe) =>
      resolveEdit(original, edited, 'pl', false).sourceUrl;
    expect(save(babka, fromSite)).toBe(fromSite.sourceUrl);
    expect(save(fromSite, { ...fromSite, sourceUrl: 'https://example.com/babka' })).toBe(
      'https://example.com/babka',
    );
    expect(save(fromSite, { ...fromSite, sourceUrl: undefined })).toBeUndefined();
  });
});

describe('where a recipe is from, in its versions', () => {
  it('is marked when restoring would change it, and an odd record does no harm', () => {
    expect(diffRecipes(fromNotebook, fromSite, false).fields.has('source')).toBe(true);
    expect(diffRecipes(fromSite, fromSite, false).fields.has('source')).toBe(false);
    const odd = { ...babka, sourceText: 12 as unknown as string };
    expect(() => diffRecipes(babka, odd, false)).not.toThrow();
  });
});

describe('Adapted from, at the foot of the recipe', () => {
  afterEach(() => vi.restoreAllMocks());

  it('names the site, and asks before opening its page in the browser', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<RecipeSource recipe={fromSite} t={t} />);
    expect(screen.getByText(t.adaptedFrom)).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: 'smittenkitchen.com' });
    expect(chip).toHaveAttribute('aria-haspopup', 'dialog');

    fireEvent.click(chip);
    expect(open).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: t.sourceOpenTitle });
    expect(dialog).toHaveAccessibleDescription(t.sourceOpenBody);
    expect(within(dialog).getByText('/2024/03/chocolate-babka')).toBeInTheDocument();
    // The safe choice has focus, so a stray Enter opens nothing.
    expect(within(dialog).getByRole('button', { name: t.sourceNotNow })).toHaveFocus();

    fireEvent.click(within(dialog).getByRole('button', { name: t.sourceOpen }));
    expect(open).toHaveBeenCalledWith(fromSite.sourceUrl, '_blank', 'noopener,noreferrer');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens nothing on "Not now"', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<RecipeSource recipe={fromSite} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'smittenkitchen.com' }));
    fireEvent.click(screen.getByRole('button', { name: t.sourceNotNow }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(open).not.toHaveBeenCalled();
  });

  it('shows words as written, beside a book, and as no link', () => {
    render(<RecipeSource recipe={fromNotebook} t={t} />);
    expect(screen.getByText('Zeszyt cioci Oli')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows nothing for no source, nor for an address that is not a web page', () => {
    const { container, rerender } = render(<RecipeSource recipe={babka} t={t} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<RecipeSource recipe={{ ...babka, sourceUrl: 'javascript:alert(1)' }} t={t} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<RecipeSource recipe={{ ...babka, sourceText: 7 as unknown as string }} t={t} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('comes last on the recipe page, after the kitchen tip', () => {
    render(
      <RecipeDetailView
        recipe={{ ...WANDAS_CHEESE_BREAD, sourceText: "Wanda's own card" }}
        language="en"
        unroll={false}
        onPhotoOpenChange={() => {}}
        t={t}
      />,
    );
    const tip = screen.getByText(t.kitchenTip);
    const source = screen.getByText(t.adaptedFrom);
    expect(tip.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("the editor's source field", () => {
  it('says how it will show: a link to the site, or the words as written', () => {
    const { rerender } = render(<RecipeSourceField value="" onChange={() => {}} t={t} />);
    const field = screen.getByLabelText(t.sourceLabel);
    expect(field).toHaveAccessibleDescription('');

    rerender(<RecipeSourceField value="www.allrecipes.com/recipe/1" onChange={() => {}} t={t} />);
    expect(field).toHaveAccessibleDescription(t.sourceAsLink('allrecipes.com'));

    rerender(<RecipeSourceField value="Aunt Ola's notebook" onChange={() => {}} t={t} />);
    expect(field).toHaveAccessibleDescription(t.sourceAsWords);
  });
});

describe('where a recipe is from, in the PDF', () => {
  const measure = (text: string) => [...text].length * 5;
  const lastLine = (recipe: Recipe) => {
    const pdf = printableRecipe(recipe, 'en', t, { photos: false });
    const pages = layoutRecipePdf(pdf, measure, () => null);
    const lines = pages
      .flatMap((p, page) => p.marks.map((m) => ({ page, m })))
      .flatMap(({ page, m }) =>
        m.type === 'text' && m.y < 750 ? [{ page, y: m.y, text: m.text }] : [],
      )
      .sort((a, b) => a.page - b.page || a.y - b.y);
    const y = lines[lines.length - 1];
    return lines
      .filter((l) => l.page === y.page && l.y === y.y)
      .map((l) => l.text)
      .join('');
  };

  it('ends with it: the address without https://, or the words', () => {
    expect(lastLine({ ...WANDAS_CHEESE_BREAD, sourceUrl: fromSite.sourceUrl })).toBe(
      'Adapted from www.smittenkitchen.com/2024/03/chocolate-babka',
    );
    expect(lastLine({ ...WANDAS_CHEESE_BREAD, sourceText: "Wanda's own card" })).toBe(
      "Adapted from Wanda's own card",
    );
    expect(printableRecipe(WANDAS_CHEESE_BREAD, 'en', t, { photos: false }).source).toBeUndefined();
  });
});
