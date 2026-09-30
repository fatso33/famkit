import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { chooseFromMenu } from './menu';
import { Recipe } from '../types/recipe';
import { leavePhotosOut } from '../utils/deviceCopy';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateDocuments: vi.fn(() => new Promise(() => {})),
}));

const t = UI_TEXT.en;

// This device's copy, from a phone whose storage couldn't hold this recipe's photo.
const slimBabka: Recipe = leavePhotosOut({
  id: 'babka',
  name: 'Babka',
  author: 'Babcia Zosia',
  authorMode: 'custom',
  category: 'cakes',
  heroImage: 'data:image/jpeg;base64,HERO',
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g' }],
  steps: [{ num: 1, text: 'Bake.' }],
  version: 1,
  createdAt: 1000,
  updatedAt: 1000,
});

// A deleted recipe: the first to lose its photos in this device's copy.
const slimPierogi: Recipe = { ...slimBabka, id: 'pierogi', name: 'Pierogi', deletedAt: 2000 };

describe('a recipe whose photos are still on their way', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([slimBabka, slimPierogi]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    render(<App />);
  });

  it('keeps its photo frame empty in the vault, rather than showing the no-photo tile', () => {
    const card = screen.getByRole('button', { name: 'Babka' });
    expect(card.querySelector('.category-tile')).toBeNull();
    expect(card.querySelector('.photo-pending')).not.toBeNull();
  });

  it("doesn't open the editor, and says why", () => {
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    chooseFromMenu(UI_TEXT.en.editRecipe);

    expect(screen.queryByRole('dialog', { name: /edit recipe/i })).not.toBeInTheDocument();
    expect(screen.getByText(t.photosStillLoading)).toBeInTheDocument();
  });

  it("isn't restored from Settings yet, and doesn't claim to be", () => {
    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    fireEvent.click(screen.getByRole('button', { name: t.settings }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.deletedRecipes) }));
    const list = screen.getByRole('list', { name: t.deletedRecipes });
    fireEvent.click(within(list).getByRole('button', { name: t.restoreRecipeLabel('Pierogi') }));

    expect(screen.getByText(t.photosStillLoading)).toBeInTheDocument();
    expect(screen.queryByText(t.recipeRestored)).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('wandas_recipes')!) as Recipe[];
    expect(stored.find((r) => r.id === 'pierogi')?.deletedAt).toBe(2000);
  });
});
