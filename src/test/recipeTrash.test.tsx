import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { chooseFromMenu } from './menu';
import { Recipe } from '../types/recipe';
import { restorableRecipes, timeAgo, withDeletedAt } from '../utils/recipeTrash';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;
const DAY = 24 * 3600_000;

const recipe = (id: string, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  author: 'Ola',
  ownerEmail: 'ola@example.com',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1000,
  ...extra,
});

describe('trash helpers', () => {
  const ola = { email: 'ola@example.com', name: 'Ola' };

  it('marks and unmarks a recipe as deleted', () => {
    const deleted = withDeletedAt(recipe('pierogi'), 5000);
    expect(deleted.deletedAt).toBe(5000);
    expect(withDeletedAt(deleted, undefined)).not.toHaveProperty('deletedAt');
  });

  it("lists only this person's deleted recipes, most recently deleted first", () => {
    const list = restorableRecipes(
      [
        recipe('kept'),
        recipe('older', { deletedAt: 1 }),
        recipe('newer', { deletedAt: 2 }),
        recipe('someone-elses', { deletedAt: 3, ownerEmail: 'peter@example.com' }),
      ],
      ola,
      true,
    );
    expect(list.map((r) => r.id)).toEqual(['newer', 'older']);
  });

  it('says when, in both languages', () => {
    const now = 100 * DAY;
    expect(timeAgo(now - 3 * DAY, now, 'en')).toBe('3 days ago');
    expect(timeAgo(now - DAY, now, 'en')).toBe('yesterday');
    expect(timeAgo(now - 3 * DAY, now, 'pl')).toBe('3 dni temu');
    expect(timeAgo(now - 5 * DAY, now, 'pl')).toBe('5 dni temu');
  });
});

describe('deleting and restoring recipes', () => {
  const stored = () => JSON.parse(localStorage.getItem('wandas_recipes')!) as Recipe[];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([recipe('Babka'), recipe('Pierogi', { version: 3 })]),
    );
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    render(<App />);
  });

  // Asks first, in a sheet naming the recipe; confirm=false keeps it.
  function deletePierogi(confirm = true) {
    fireEvent.click(screen.getByRole('button', { name: 'Pierogi' }));
    chooseFromMenu(UI_TEXT.en.editRecipe);
    fireEvent.click(screen.getByRole('button', { name: t.deleteRecipe }));
    const ask = screen.getByRole('alertdialog', { name: t.deleteRecipe });
    expect(ask).toHaveAccessibleDescription(t.confirmDeleteRecipe('Pierogi'));
    fireEvent.click(within(ask).getByRole('button', { name: confirm ? t.deleteRecipe : t.cancel }));
  }

  it('hides a deleted recipe without erasing it, or making a new version', () => {
    deletePierogi();

    expect(screen.queryByRole('button', { name: 'Pierogi' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Babka' })).toBeInTheDocument();
    const pierogi = stored().find((r) => r.id === 'Pierogi');
    expect(pierogi?.deletedAt).toEqual(expect.any(Number));
    expect(pierogi?.version).toBe(3);
  });

  it('keeps the recipe when the deletion is not confirmed', () => {
    deletePierogi(false);
    expect(stored().find((r) => r.id === 'Pierogi')).not.toHaveProperty('deletedAt');
  });

  it('brings it straight back with Undo', () => {
    deletePierogi();
    fireEvent.click(screen.getByRole('button', { name: t.undo }));

    expect(screen.getByRole('button', { name: 'Pierogi' })).toBeInTheDocument();
    expect(stored().find((r) => r.id === 'Pierogi')).not.toHaveProperty('deletedAt');
  });

  it('lists it under Deleted recipes in Settings, where it can be restored', () => {
    deletePierogi();
    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    fireEvent.click(screen.getByRole('button', { name: t.settings }));

    const toggle = screen.getByRole('button', { name: new RegExp(t.deletedRecipes) });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const list = screen.getByRole('list', { name: t.deletedRecipes });
    expect(within(list).getByText('Pierogi')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: t.restoreRecipeLabel('Pierogi') }));

    expect(screen.queryByRole('list', { name: t.deletedRecipes })).not.toBeInTheDocument();
    expect(screen.getByText(t.noDeletedRecipes)).toBeInTheDocument();
    expect(stored().find((r) => r.id === 'Pierogi')).not.toHaveProperty('deletedAt');
  });
});
