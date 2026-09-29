import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { CurrentUserContext } from '../hooks/useCurrentUser';
import { chooseFromMenu } from './menu';

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
  within(menu).getByRole('button', { name: (name) => name.startsWith(`${label} `) });

/** A field in the filter menu (Category, Author), named by its label and what's chosen. */
const field = (menu: HTMLElement, label: string) =>
  within(menu).getByRole('button', { name: (name) => name.startsWith(`${label} `) });

/** Unfolds a field in the filter menu and returns its options' list. */
const unfold = (menu: HTMLElement, label: string) => {
  fireEvent.click(field(menu, label));
  return within(menu).getByRole('listbox', { name: label });
};

const option = (list: HTMLElement, label: string) =>
  within(list).getByRole('option', { name: (name) => name.startsWith(`${label} `) });

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
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();
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

  it('filters by category from its drop-down, and the chip that shows it takes it off', () => {
    render(<App />);
    const menu = openMenu(t.filterRecipes);
    expect(field(menu, t.categoryLabel)).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBeNull();
    const list = unfold(menu, t.categoryLabel);
    expect(field(menu, t.categoryLabel)).toHaveAttribute('aria-expanded', 'true');
    // Each category offers how many recipes it holds.
    expect(option(list, t.recipeCategories.soups)).toHaveTextContent('1');
    expect(option(list, t.recipeCategories.breakfast)).toHaveTextContent('0');

    fireEvent.click(option(list, t.recipeCategories.soups));
    expect(shownRecipes()).toEqual(['Sunday Żurek']);
    // The list stays unfolded with the choice ticked, so a mistaken tap can be put right.
    expect(option(list, t.recipeCategories.soups)).toHaveAttribute('aria-selected', 'true');
    expect(field(menu, t.categoryLabel)).toHaveAccessibleName(
      `${t.categoryLabel} ${t.recipeCategories.soups}`,
    );
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByRole('dialog', { name: t.filterRecipes })).toBeInTheDocument();
    fireEvent.click(option(list, t.recipeCategories.drinks));
    expect(shownRecipes()).toEqual(['Plum Kompot']);

    // The field folds it back.
    fireEvent.click(field(menu, t.categoryLabel));
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => {
      vi.runAllTimers();
    });
    fireEvent.click(
      screen.getByRole('button', { name: t.removeFilter(t.recipeCategories.drinks) }),
    );
    expect(shownRecipes()).toHaveLength(3);
  });

  it('opens one drop-down at a time, and Escape folds it without closing the menu', () => {
    render(<App />);
    const menu = openMenu(t.filterRecipes);
    unfold(menu, t.categoryLabel);
    unfold(menu, t.filterAuthor);
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    expect(field(menu, t.categoryLabel)).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(field(menu, t.filterAuthor), { key: 'ArrowDown' });
    const everyone = within(menu).getByRole('option', { name: /^All authors/ });
    expect(everyone).toHaveFocus();
    fireEvent.keyDown(everyone, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('dialog', { name: t.filterRecipes })).toBeInTheDocument();
    expect(field(menu, t.filterAuthor)).toHaveFocus();
  });

  it('filters by author, each listed once however their name was typed', () => {
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([...RECIPES, recipe('Makowiec', { author: 'babcia zosia', createdAt: 500 })]),
    );
    render(<App />);
    const menu = openMenu(t.filterRecipes);
    const list = unfold(menu, t.filterAuthor);
    expect(
      within(list)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([`${t.allAuthors}4`, 'BZBabcia Zosia2', 'KKasia1', 'OOla1']);

    fireEvent.click(option(list, 'Babcia Zosia'));
    expect(shownRecipes()).toEqual(['Easter Babka', 'Makowiec']);
    fireEvent.click(screen.getByRole('button', { name: t.removeFilter('Babcia Zosia') }));
    expect(shownRecipes()).toHaveLength(4);
  });

  it("shows only the recipes not yet opened, keeping one opened from there until it's changed", () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Plum Kompot' }));
    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));

    const menu = openMenu(t.filterRecipes);
    const unseen = within(menu).getByRole('switch', { name: new RegExp(`^${t.unseen}`) });
    expect(unseen).toHaveTextContent(t.unseenCaption(2));
    fireEvent.click(unseen);
    expect(unseen).toBeChecked();
    expect(shownRecipes()).toEqual(['Sunday Żurek', 'Easter Babka']);
    fireEvent.keyDown(window, { key: 'Escape' });

    // Opened from the unseen list, it's still there on the way back...
    fireEvent.click(screen.getByRole('button', { name: 'Easter Babka' }));
    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    expect(shownRecipes()).toEqual(['Sunday Żurek', 'Easter Babka']);

    // ...until the filter next changes, and on this device next time too.
    fireEvent.click(screen.getByRole('button', { name: t.removeFilter(t.unseen) }));
    fireEvent.click(within(openMenu(t.filterRecipes)).getByRole('switch'));
    expect(shownRecipes()).toEqual(['Sunday Żurek']);
  });

  it('counts recipes this person added as seen, and says so when none are left', () => {
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify(RECIPES.map((r) => ({ ...r, ownerEmail: 'Ola@example.com' }))),
    );
    render(
      <CurrentUserContext.Provider value={{ email: 'ola@example.com', name: 'Ola' }}>
        <App />
      </CurrentUserContext.Provider>,
    );
    fireEvent.click(within(openMenu(t.filterRecipes)).getByRole('switch'));
    expect(shownRecipes()).toEqual([]);
    expect(screen.getByText(t.allSeen)).toBeInTheDocument();
  });

  it("doesn't say everything was opened when the rest of the filter already matches nothing", () => {
    render(<App />);
    const menu = openMenu(t.filterRecipes);
    fireEvent.click(option(unfold(menu, t.categoryLabel), t.recipeCategories.breakfast));
    fireEvent.click(within(menu).getByRole('switch'));
    expect(shownRecipes()).toEqual([]);
    expect(screen.getByText(t.noMatches)).toBeInTheDocument();
    expect(screen.queryByText(t.allSeen)).toBeNull();
  });

  it('keeps showing a chosen author whose last recipe was removed', () => {
    render(<App />);
    const menu = openMenu(t.filterRecipes);
    fireEvent.click(option(unfold(menu, t.filterAuthor), 'Kasia'));
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => {
      vi.runAllTimers();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sunday Żurek' }));
    chooseFromMenu(t.editRecipe);
    fireEvent.click(screen.getByRole('button', { name: t.deleteRecipe }));
    const ask = screen.getByRole('alertdialog', { name: t.deleteRecipe });
    fireEvent.click(within(ask).getByRole('button', { name: t.deleteRecipe }));
    act(() => {
      vi.runAllTimers();
    });

    expect(shownRecipes()).toEqual([]);
    const field = within(openMenu(t.filterRecipes)).getByRole('button', {
      name: (name) => name.startsWith(t.filterAuthor),
    });
    expect(field).toHaveAccessibleName(`${t.filterAuthor} kasia`);
  });

  it('closes a menu on Escape, handing focus back to its button', () => {
    render(<App />);
    openMenu(t.sortRecipes);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: t.sortRecipes })).toBeNull();
    expect(screen.getByRole('button', { name: t.sortRecipes })).toHaveFocus();
  });

  it('sorts by category first, then as chosen, and remembers the choice', () => {
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify(
        RECIPES.map((r) => (r.name === 'Plum Kompot' ? { ...r, updatedAt: 4000 } : r)),
      ),
    );
    const { unmount } = render(<App />);
    expect(shownRecipes()).toEqual(['Sunday Żurek', 'Easter Babka', 'Plum Kompot']);

    // Last added counts a recipe's new version as added.
    const menu = openMenu(t.sortRecipes);
    fireEvent.click(choice(menu, t.vaultSorts.changed));
    expect(shownRecipes()).toEqual(['Plum Kompot', 'Sunday Żurek', 'Easter Babka']);
    // The menu stays open for another choice.
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByRole('dialog', { name: t.sortRecipes })).toBeInTheDocument();
    fireEvent.click(choice(menu, t.vaultSorts.name));
    expect(shownRecipes()).toEqual(['Easter Babka', 'Plum Kompot', 'Sunday Żurek']);

    unmount();
    render(<App />);
    expect(shownRecipes()).toEqual(['Easter Babka', 'Plum Kompot', 'Sunday Żurek']);
  });

  it('turns the chosen sort round when it is tapped again, saying which way it now runs', () => {
    const { unmount } = render(<App />);
    const [aToZ, zToA] = t.vaultSortOrders.name;
    const menu = openMenu(t.sortRecipes);
    const byName = choice(menu, t.vaultSorts.name);
    fireEvent.click(byName);
    expect(byName).toHaveAttribute('aria-pressed', 'true');
    expect(byName).toHaveAccessibleName(`${t.vaultSorts.name} ${aToZ}`);
    fireEvent.click(byName);
    expect(byName).toHaveAccessibleName(`${t.vaultSorts.name} ${zToA}`);
    expect(shownRecipes()).toEqual(['Sunday Żurek', 'Plum Kompot', 'Easter Babka']);

    // Another sort starts the natural way round.
    const time = choice(menu, t.vaultSorts.time);
    expect(time).toHaveAccessibleName(`${t.vaultSorts.time} ${t.vaultSortOrders.time[0]}`);

    unmount();
    render(<App />);
    expect(shownRecipes()).toEqual(['Sunday Żurek', 'Plum Kompot', 'Easter Babka']);
  });

  it('heads each cook’s recipes with their name when sorted by cook', () => {
    render(<App />);
    fireEvent.click(choice(openMenu(t.sortRecipes), t.vaultSorts.cook));
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Babcia Zosia', 'Kasia', 'Ola']);
  });

  it('starts as a list, switching to cards and back with a tap anywhere on the switch', () => {
    const { unmount } = render(<App />);
    const layout = screen.getByRole('button', { name: `${t.recipeLayout}: ${t.layoutList}` });
    expect(document.querySelectorAll('.vault-row')).toHaveLength(3);
    expect(document.documentElement.dataset.vaultView).toBe('list');
    // Its list half is the one showing, so a tap there switches too.
    fireEvent.click(layout.querySelector('.vault-layout-icon.is-active')!);
    expect(layout).toHaveAccessibleName(`${t.recipeLayout}: ${t.layoutCards}`);
    expect(document.querySelectorAll('.vault-row')).toHaveLength(0);
    expect(document.documentElement.dataset.vaultView).toBe('cards');

    unmount();
    render(<App />);
    expect(document.querySelectorAll('.vault-row')).toHaveLength(0);

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
