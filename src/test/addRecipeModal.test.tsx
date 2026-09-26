import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

const t = UI_TEXT.en;
const noop = vi.fn();

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

describe('AddRecipeModal initial form', () => {
  beforeEach(() => localStorage.clear());

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
