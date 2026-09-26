import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('restores a saved draft in create mode', () => {
    localStorage.setItem('family_kitchen_recipe_draft', JSON.stringify({ title: 'Draft Babka', author: 'Wanda' }));
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);

    expect(screen.getByDisplayValue('Draft Babka')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Wanda')).toBeInTheDocument();
  });

  it('ignores drafts when editing and starts empty when creating without one', () => {
    localStorage.setItem('family_kitchen_recipe_draft', JSON.stringify({ title: 'Draft Babka' }));
    const { unmount } = render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);
    expect(screen.queryByDisplayValue('Draft Babka')).not.toBeInTheDocument();
    unmount();

    localStorage.clear();
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    expect(screen.queryByDisplayValue('Aunt Ola Pierogi')).not.toBeInTheDocument();
  });
});
