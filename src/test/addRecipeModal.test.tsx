import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

const t = UI_TEXT.en;
const noop = vi.fn();

// The category field: its label, then what's picked.
const categoryField = () => screen.getByRole('button', { name: new RegExp(`^${t.categoryLabel}`) });

const recipe: Recipe = {
  id: 'custom-1',
  name: 'Aunt Ola Pierogi',
  author: 'Ola',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Knead gently.' }],
};

// Fills in what a new recipe needs, apart from its category.
function fillNewRecipe() {
  fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Żurek' } });
  // Nobody is signed in here, so the author is typed.
  fireEvent.change(screen.getByLabelText(t.authorNameLabel), { target: { value: 'Kasia' } });
  fireEvent.change(screen.getByLabelText(t.ingredientNameLabel(1)), {
    target: { value: 'Sourdough starter' },
  });
  fireEvent.change(screen.getByLabelText(t.stepInstructionLabel(1)), {
    target: { value: 'Simmer.' },
  });
}

describe('AddRecipeModal initial form', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
  });

  it('populates fields from the recipe being edited', () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);

    expect(screen.getByDisplayValue('Aunt Ola Pierogi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Flour')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2 cups')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Knead gently.')).toBeInTheDocument();
  });

  it('keeps the amount of a translated ingredient, which has a name but no quantity', () => {
    const translated: Recipe = {
      ...recipe,
      ingredients: [
        { name: 'Mąka', text: 'Mąka - 2 szklanki' },
        { name: 'Sól', text: 'Szczypta soli' },
      ],
    };
    render(<AddRecipeModal initialRecipe={translated} onClose={noop} onSave={noop} t={t} />);

    expect(screen.getByDisplayValue('Mąka')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2 szklanki')).toBeInTheDocument();
    // No separator: keep the whole line rather than dropping the amount.
    expect(screen.getByDisplayValue('Szczypta soli')).toBeInTheDocument();
  });

  it('restores a saved draft in create mode', () => {
    localStorage.setItem(
      'family_kitchen_recipe_draft',
      JSON.stringify({ title: 'Draft Babka', author: 'Wanda' }),
    );
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);

    expect(screen.getByDisplayValue('Draft Babka')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Wanda')).toBeInTheDocument();
  });

  it('keeps text typed just before closing in the draft (debounce is flushed on close)', () => {
    const { unmount } = render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);

    fireEvent.change(screen.getByLabelText(t.recipeTitle), {
      target: { value: 'Quick Babka' },
    });
    unmount(); // closed well within the 400ms debounce

    expect(JSON.parse(localStorage.getItem('family_kitchen_recipe_draft')!).title).toBe(
      'Quick Babka',
    );
  });

  it('asks a new recipe for its category, and saves the one picked', () => {
    const onSave = vi.fn();
    render(<AddRecipeModal onClose={noop} onSave={onSave} t={t} />);
    fillNewRecipe();

    // Saved without one, it says what's missing and saves nothing.
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.categoryRequired);

    fireEvent.click(categoryField());
    const list = screen.getByRole('listbox', { name: t.categoryLabel });
    fireEvent.click(within(list).getByRole('option', { name: t.recipeCategories.soups }));
    expect(categoryField()).toHaveAccessibleName(`${t.categoryLabel} ${t.recipeCategories.soups}`);

    fireEvent.click(screen.getByRole('button', { name: t.save }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ category: 'soups' });
  });

  it('says which fields a new recipe still needs, and saves nothing', () => {
    const onSave = vi.fn();
    render(<AddRecipeModal onClose={noop} onSave={onSave} t={t} />);

    fireEvent.click(screen.getByRole('button', { name: t.save }));

    expect(onSave).not.toHaveBeenCalled();
    const problems = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(problems).toEqual(
      expect.arrayContaining([t.titleRequired, t.ingredientsRequired, t.stepsRequired]),
    );
    expect(screen.getByLabelText(t.recipeTitle)).toHaveAttribute('aria-invalid', 'true');
  });

  it('opens an older recipe without a category unpicked, and saves it unchanged', () => {
    const onSave = vi.fn();
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={onSave} t={t} />);
    expect(categoryField()).toHaveAccessibleName(`${t.categoryLabel} ${t.chooseCategory}`);

    fireEvent.click(screen.getByRole('button', { name: t.save }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ category: 'family' });
  });

  it('opens a recipe on its category', () => {
    render(
      <AddRecipeModal
        initialRecipe={{ ...recipe, category: 'mains' }}
        onClose={noop}
        onSave={noop}
        t={t}
      />,
    );
    expect(categoryField()).toHaveAccessibleName(`${t.categoryLabel} ${t.recipeCategories.mains}`);

    fireEvent.click(categoryField());
    expect(screen.getByRole('option', { name: t.recipeCategories.mains })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('asks before closing an edit with changes, and closes one without', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <AddRecipeModal initialRecipe={recipe} onClose={onClose} onSave={noop} t={t} />,
    );
    fireEvent.click(screen.getByRole('button', { name: t.closeDialog }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    render(<AddRecipeModal initialRecipe={recipe} onClose={onClose} onSave={noop} t={t} />);
    fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Pierogi' } });
    fireEvent.click(screen.getByRole('button', { name: t.closeDialog }));
    const ask = screen.getByRole('alertdialog', { name: t.discardTitle });
    fireEvent.click(within(ask).getByRole('button', { name: t.keepEditing }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Pierogi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t.closeDialog }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: t.discard }),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape like the ✕, asking first when an edit has changes', () => {
    const onClose = vi.fn();
    const { unmount } = render(<AddRecipeModal onClose={onClose} onSave={noop} t={t} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    render(<AddRecipeModal initialRecipe={recipe} onClose={onClose} onSave={noop} t={t} />);
    fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Pierogi' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('alertdialog', { name: t.discardTitle })).toBeInTheDocument();
    // Escape again closes only the question.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to the category field after a pick, while the list closes', () => {
    // A browser playing the list's exit animation, so it stays mounted for a moment.
    const exit = { animationName: 'fk-exit-popover', finished: new Promise<void>(() => {}) };
    HTMLElement.prototype.getAnimations = vi.fn(() => [exit] as unknown as Animation[]);
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);

    fireEvent.click(categoryField());
    fireEvent.click(screen.getByRole('option', { name: t.recipeCategories.soups }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(categoryField()).toHaveFocus();
  });

  it('adds pasted lines as ingredients or steps', () => {
    const onToast = vi.fn();
    render(<AddRecipeModal onClose={noop} onSave={noop} onToast={onToast} t={t} />);

    fireEvent.click(screen.getByRole('button', { name: t.paste }));
    let sheet = screen.getByRole('dialog', { name: t.pasteTitle });
    fireEvent.change(within(sheet).getByLabelText(t.pasteTextLabel), {
      target: { value: '2 cups flour\n1 tsp salt' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));
    expect(onToast).toHaveBeenLastCalledWith(t.pastedIngredients(2));
    expect(screen.getByLabelText(t.ingredientNameLabel(2))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t.paste }));
    sheet = screen.getByRole('dialog', { name: t.pasteTitle });
    fireEvent.click(within(sheet).getByRole('radio', { name: t.stepsHeading }));
    fireEvent.change(within(sheet).getByLabelText(t.pasteTextLabel), {
      target: { value: '1. Mix.\n2. Bake.' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));
    expect(onToast).toHaveBeenLastCalledWith(t.pastedSteps(2));
    expect(screen.getByLabelText(t.stepInstructionLabel(2))).toHaveValue('Bake.');
  });

  it('ignores drafts when editing and starts empty when creating without one', () => {
    localStorage.setItem('family_kitchen_recipe_draft', JSON.stringify({ title: 'Draft Babka' }));
    const { unmount } = render(
      <AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />,
    );
    expect(screen.queryByDisplayValue('Draft Babka')).not.toBeInTheDocument();
    unmount();

    localStorage.clear();
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    expect(screen.queryByDisplayValue('Aunt Ola Pierogi')).not.toBeInTheDocument();
  });
});
