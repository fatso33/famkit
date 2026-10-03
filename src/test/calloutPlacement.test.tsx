import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecipeDetailView } from '../components/recipe-detail/RecipeDetailView';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { UI_TEXT } from '../i18n/translations';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { Recipe } from '../types/recipe';

const t = UI_TEXT.en;
const noop = vi.fn();

/** Whether `a` comes before `b` in the page's reading order. */
const before = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const page = (recipe: Recipe) =>
  render(
    <RecipeDetailView
      recipe={recipe}
      language="en"
      unroll={false}
      onPhotoOpenChange={noop}
      t={t}
    />,
  );

describe('the crucial note and kitchen tip on the recipe page', () => {
  beforeEach(() => localStorage.clear());

  it('shows the note before the ingredients and the tip after the whole method', () => {
    page(WANDAS_CHEESE_BREAD);
    const note = screen.getByText(t.crucialNote);
    const tip = screen.getByText(t.kitchenTip);
    const ingredients = screen.getByRole('heading', { name: t.ingredients });
    const steps = screen.getAllByText(/./, { selector: '.step-text' });
    const bakingOptions = screen.getByText(t.bakingOptions);

    expect(before(note, ingredients)).toBe(true);
    expect(before(steps[steps.length - 1], tip)).toBe(true);
    expect(before(bakingOptions, tip)).toBe(true);
    expect(screen.getByText('Will not work in an air fryer.')).toBeInTheDocument();
  });

  it('shows only the one there is, or neither', () => {
    const { unmount } = page({ ...WANDAS_CHEESE_BREAD, tips: '' });
    expect(screen.getByText(t.crucialNote)).toBeInTheDocument();
    expect(screen.queryByText(t.kitchenTip)).toBeNull();
    unmount();

    page({ ...WANDAS_CHEESE_BREAD, notes: undefined, tips: undefined });
    expect(screen.queryByText(t.crucialNote)).toBeNull();
    expect(screen.queryByText(t.kitchenTip)).toBeNull();
  });
});

describe('the crucial note and kitchen tip in the editor', () => {
  beforeEach(() => localStorage.clear());

  it('asks for the note before the ingredients and the tip after the method, as the page shows them', () => {
    render(
      <AddRecipeModal initialRecipe={WANDAS_CHEESE_BREAD} onClose={noop} onSave={noop} t={t} />,
    );
    const note = screen.getByLabelText(t.crucialNote);
    const tip = screen.getByLabelText(t.kitchenTip);
    const firstIngredient = screen.getByLabelText(t.ingredientNameLabel(1));
    const steps = screen.getAllByLabelText(/^Instruction for step \d+$/);

    expect(before(note, firstIngredient)).toBe(true);
    expect(steps.length).toBeGreaterThan(0);
    expect(before(steps[steps.length - 1], tip)).toBe(true);
  });
});
