import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;

const recipe = (id: string, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  author: 'Ola',
  category: 'other',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1000,
  ...extra,
});

const RECIPES = [
  recipe('Sunday Żurek', { category: 'soups', author: 'Kasia', createdAt: 3000 }),
  recipe('Easter Babka', {
    category: 'cakes',
    author: 'Babcia Zosia',
    authorMode: 'custom',
    ownerName: 'Peter',
    createdAt: 2000,
  }),
  recipe('Plum Kompot', {
    category: 'drinks',
    ingredients: [{ text: 'Plums - 1 kg' }],
    createdAt: 1000,
  }),
];

/** The recipes the vault shows, in order (cards and rows are both named by their recipe). */
const shownRecipes = () =>
  screen
    .queryAllByRole('button')
    .filter((el) => el.hasAttribute('data-vault-item'))
    .map((el) => el.getAttribute('aria-label'));

const openMenu = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
  return screen.getByRole('dialog', { name });
};

const choice = (menu: HTMLElement, label: string) =>
  within(menu).getByRole('button', { name: (name) => name.startsWith(label) });

describe('the vault toolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify(RECIPES));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts the recipes and cooks under the title', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: `${t.vaultKicker} ${t.vaultTitle}`, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.vaultCaption(3, 3))).toBeInTheDocument();
  });

  it('searches names, cooks and ingredients, ignoring accents, until the search is closed', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: t.openSearch }));
    const field = screen.getByRole('searchbox', { name: t.openSearch });
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { value: 'zurek' } });
    expect(shownRecipes()).toEqual(['Sunday Żurek']);
    fireEvent.change(field, { target: { value: 'zosia' } });
    expect(shownRecipes()).toEqual(['Easter Babka']);
    fireEvent.change(field, { target: { value: 'plums' } });
    expect(shownRecipes()).toEqual(['Plum Kompot']);
    // Shown under the toolbar, and announced to screen readers.
    expect(screen.getAllByText(t.recipesShown(1))).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: t.closeSearch }));
    expect(field).toHaveValue('');
    expect(shownRecipes()).toHaveLength(3);
  });

  it('filters by category from its menu, and the chip that shows it takes it off', () => {
    render(<App />);
    const menu = openMenu(t.filterRecipes);
    // Each category offers how many recipes it holds.
    expect(choice(menu, t.recipeCategories.soups)).toHaveTextContent('1');
    expect(choice(menu, t.recipeCategories.breakfast)).toHaveTextContent('0');

    fireEvent.click(choice(menu, t.recipeCategories.soups));
    expect(shownRecipes()).toEqual(['Sunday Żurek']);
    expect(choice(menu, t.recipeCategories.soups)).toHaveAttribute('aria-pressed', 'true');
    // The menu closes itself a moment after the choice.
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.queryByRole('dialog', { name: t.filterRecipes })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t.removeFilter(t.recipeCategories.soups) }));
    expect(shownRecipes()).toHaveLength(3);
  });

  it('narrows to heirlooms with the switch in the filter menu', () => {
    render(<App />);
    const menu = openMenu(t.filterRecipes);
    const heirlooms = within(menu).getByRole('switch', { name: t.heirloomsOnly });
    fireEvent.click(heirlooms);
    expect(heirlooms).toBeChecked();
    expect(shownRecipes()).toEqual(['Easter Babka']);
  });

  it('closes a menu on Escape, handing focus back to its button', () => {
    render(<App />);
    openMenu(t.sortRecipes);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: t.sortRecipes })).toBeNull();
    expect(screen.getByRole('button', { name: t.sortRecipes })).toHaveFocus();
  });

  it('sorts newest first, then as chosen, and remembers the choice on this device', () => {
    const { unmount } = render(<App />);
    expect(shownRecipes()).toEqual(['Sunday Żurek', 'Easter Babka', 'Plum Kompot']);

    const menu = openMenu(t.sortRecipes);
    fireEvent.click(choice(menu, t.vaultSorts.az));
    expect(shownRecipes()).toEqual(['Easter Babka', 'Plum Kompot', 'Sunday Żurek']);

    unmount();
    render(<App />);
    expect(shownRecipes()).toEqual(['Easter Babka', 'Plum Kompot', 'Sunday Żurek']);
  });

  it('heads each cook’s recipes with their name when sorted by cook', () => {
    render(<App />);
    fireEvent.click(choice(openMenu(t.sortRecipes), t.vaultSorts.cook));
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Babcia Zosia', 'Kasia', 'Ola']);
  });

  it('switches to a list and back, remembering the layout, and a row opens its recipe', () => {
    const { unmount } = render(<App />);
    const layout = screen.getByRole('group', { name: t.recipeLayout });
    fireEvent.click(within(layout).getByRole('button', { name: t.layoutList }));
    expect(within(layout).getByRole('button', { name: t.layoutList })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.querySelectorAll('.vault-row')).toHaveLength(3);
    expect(document.documentElement.dataset.vaultView).toBe('list');

    unmount();
    render(<App />);
    expect(document.querySelectorAll('.vault-row')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Easter Babka' }));
    expect(screen.getByRole('heading', { name: 'Easter Babka', level: 1 })).toBeInTheDocument();
  });

  it('offers every recipe again when nothing matches', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: t.openSearch }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pizza' } });
    expect(screen.getByText(t.noMatches)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t.showAllRecipes }));
    expect(shownRecipes()).toHaveLength(3);
  });
});
