import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { IngredientsTable } from '../components/recipe-detail/IngredientsTable';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { formFromRecipe, formToRecipe, headingRow, rowsToIngredients } from '../utils/recipeForm';
import { ingredientGroups } from '../utils/recipeMethod';
import { buildTranslation, pieceHash, recipePieces } from '../utils/translationPieces';
import { overlayTranslation, sourceHash, translatableContent } from '../utils/recipeTranslation';
import { diffRecipes } from '../utils/recipeVersions';

const t = UI_TEXT.en;
const labels = { bakingSection: t.bakingOptions, bakingPaths: t.legacyBakingPaths };

const curry: Recipe = {
  id: 'recipe-1',
  name: 'Curry',
  author: 'Raye',
  category: 'mains',
  heroImage: '',
  yieldHeader: 'Servings: 4',
  ingredients: [
    { text: 'rice - 2 cups', name: 'rice', note: '' },
    { text: 'soy sauce - 1 tbsp', name: 'soy sauce', note: '', section: 'For the Sauce' },
    { text: 'mirin - 1 tbsp', name: 'mirin', note: '' },
    { text: 'green onion', name: 'green onion', note: '', section: 'For Serving' },
  ],
  steps: [{ num: 1, text: 'Cook.' }],
};

describe('ingredient headings', () => {
  it('groups the rows under the headings they start', () => {
    const groups = ingredientGroups(curry.ingredients);
    expect(groups.map((g) => [g.heading, g.rows.map((r) => r.idx)])).toEqual([
      ['', [0]],
      ['For the Sauce', [1, 2]],
      ['For Serving', [3]],
    ]);
  });

  it('opens in the editor as heading rows, and saves back exactly as it was', () => {
    const form = formFromRecipe(curry, labels);
    expect(form.ingredientRows.map((r) => (r.heading ? `# ${r.name}` : r.name))).toEqual([
      'rice',
      '# For the Sauce',
      'soy sauce',
      'mirin',
      '# For Serving',
      'green onion',
    ]);
    expect(formToRecipe(form).ingredients).toEqual(curry.ingredients);
  });

  it('moves a heading with its row, and drops a heading with nothing under it', () => {
    const form = formFromRecipe(curry, labels);
    const [rice, sauce, soy, mirin, serving, onion] = form.ingredientRows;
    const ingredients = rowsToIngredients([
      sauce,
      rice,
      soy,
      headingRow('  '),
      mirin,
      onion,
      serving,
    ]);
    expect(ingredients.map((i) => [i.name, i.section])).toEqual([
      ['rice', 'For the Sauce'],
      ['soy sauce', undefined],
      ['mirin', undefined],
      ['green onion', undefined],
    ]);
  });

  it('is its own piece to translate, and keeps its place in the translation', () => {
    const pieces = recipePieces(translatableContent(curry));
    expect(pieces.filter((p) => p.kind === 'heading').map((p) => p.key)).toEqual([
      'ingredients:1:section',
      'ingredients:3:section',
    ]);

    const polish = new Map([
      ['For the Sauce', 'Na sos'],
      ['For Serving', 'Do podania'],
    ]);
    const { content, pieceSources } = buildTranslation(translatableContent(curry), (p) =>
      p.kind === 'heading' ? polish.get(p.text) : undefined,
    );
    expect(content.ingredients?.map((i) => i.section)).toEqual([
      undefined,
      'Na sos',
      undefined,
      'Do podania',
    ]);
    const heading = pieces.find((p) => p.key === 'ingredients:1:section')!;
    expect(pieceSources['ingredients:1:section']).toBe(pieceHash(heading));

    // A translation can't add a heading the original doesn't have.
    const shown = overlayTranslation(curry, {
      ingredients: content.ingredients!.map((i) => ({ ...i, section: 'Extra' })),
    });
    expect(shown.ingredients.map((i) => i.section)).toEqual([
      undefined,
      'Extra',
      undefined,
      'Extra',
    ]);
  });

  it("leaves older recipes' fingerprints alone, and changes when a heading does", () => {
    const plain: Recipe = { ...curry, ingredients: [{ text: 'Flour - 2 cups' }] };
    // The fingerprint is of the JSON, which leaves out a row's missing heading.
    expect(JSON.stringify(translatableContent(plain))).not.toContain('section');
    const renamed = {
      ...curry,
      ingredients: curry.ingredients.map((i, k) => (k === 1 ? { ...i, section: 'Sauce' } : i)),
    };
    expect(sourceHash(renamed)).not.toBe(sourceHash(curry));
    expect([...diffRecipes(renamed, curry, false).ingredients]).toEqual([1]);
  });
});

describe('the ingredient table on the recipe page', () => {
  const table = (recipe: Recipe) =>
    render(
      <IngredientsTable
        ingredients={recipe.ingredients}
        scale={1}
        onIncreaseScale={vi.fn()}
        onDecreaseScale={vi.fn()}
        yieldHeader={recipe.yieldHeader}
        language="en"
        t={t}
      />,
    );

  it('shows each heading over its rows', () => {
    table(curry);
    // Each says how many ingredients it holds; the bare number is shown, the words are read out.
    const headings = screen.getAllByRole('rowheader');
    // (jsdom spaces the spans apart; browsers don't.)
    expect(headings[0]).toHaveAccessibleName(/^For the Sauce ?, 2 ingredients$/);
    expect(headings[1]).toHaveAccessibleName(/^For Serving ?, 1 ingredient$/);
    const groups = screen.getAllByRole('rowgroup').slice(1);
    expect(groups.map((g) => within(g).getAllByRole('row').length)).toEqual([1, 3, 2]);
  });

  it('shows no yield for a recipe that gives none', () => {
    table({ ...curry, yieldHeader: '' });
    expect(screen.queryByText(t.for1Loaf)).not.toBeInTheDocument();
    expect(document.getElementById('yieldHeaderDisplay')).toBeNull();
  });
});

describe('ingredient headings in the editor', () => {
  beforeEach(() => localStorage.clear());

  it('adds a heading that is saved over the ingredient below it', () => {
    const onSave = vi.fn();
    const recipe: Recipe = { ...curry, ingredients: [curry.ingredients[0]] };
    render(<AddRecipeModal initialRecipe={recipe} onClose={vi.fn()} onSave={onSave} t={t} />);

    fireEvent.click(screen.getByRole('button', { name: t.addIngredientHeading }));
    fireEvent.change(screen.getByLabelText(t.ingredientHeadingLabel), {
      target: { value: 'For the Dressing' },
    });
    fireEvent.click(screen.getByRole('button', { name: t.addIngredient }));
    fireEvent.change(screen.getByLabelText(t.ingredientNameLabel(2)), {
      target: { value: 'Lime juice' },
    });
    // Headings don't count as ingredients.
    expect(screen.getByText(t.ingredientsCount(2))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t.save }));
    expect(onSave.mock.calls[0][0].ingredients).toEqual([
      curry.ingredients[0],
      { text: 'Lime juice', name: 'Lime juice', note: '', section: 'For the Dressing' },
    ]);
  });

  it('keeps an empty yield empty, rather than saving "For 1 loaf:"', () => {
    const onSave = vi.fn();
    render(
      <AddRecipeModal
        initialRecipe={{ ...curry, yieldHeader: '' }}
        onClose={vi.fn()}
        onSave={onSave}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    expect(onSave.mock.calls[0][0].yieldHeader).toBe('');
  });

  it('asks for an ingredient when there are only headings', () => {
    const onSave = vi.fn();
    render(
      <AddRecipeModal
        initialRecipe={{ ...curry, ingredients: [{ text: '' }] }}
        onClose={vi.fn()}
        onSave={onSave}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t.addIngredientHeading }));
    fireEvent.change(screen.getByLabelText(t.ingredientHeadingLabel), {
      target: { value: 'For the Sauce' },
    });
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(t.ingredientsRequired)).toBeInTheDocument();
  });
});
