import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { Make } from '../types/make';
import { CurrentUserContext } from '../hooks/useCurrentUser';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateDocuments: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;
const ola = { email: 'ola@example.com', name: 'Ola Nowak' };

const recipe = (id: string, name: string, category: Recipe['category']): Recipe => ({
  id,
  name,
  author: 'Ola',
  category,
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1000,
});

const make = (id: string, recipeId: string, who: string, createdAt: number, extra = {}): Make => ({
  id,
  recipeId,
  title: id,
  photo: 'data:image/jpeg;base64,AAAA',
  ownerEmail: `${who.toLowerCase()}@example.com`,
  ownerName: who,
  ownerNameAsTyped: true,
  createdAt,
  updatedAt: createdAt,
  ...extra,
});

const MAKES = [
  make('Crusty loaf', 'bread', 'Kasia', 300),
  make('Big pot', 'zurek', 'Kasia', 200, {
    hearts: { 'ola@example.com': true, 'piotr@example.com': true },
  }),
  make('Second loaf', 'bread', 'Piotr', 100, { hearts: { 'piotr@example.com': true } }),
];

/** The makes the page shows, in order, by title. */
const shownMakes = () =>
  screen.queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

const openMenu = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
  return screen.getByRole('dialog', { name });
};
const choice = (menu: HTMLElement, label: string) =>
  within(menu).getByRole('button', { name: (name) => name.startsWith(`${label} `) });
const unfold = (menu: HTMLElement, label: string) => {
  fireEvent.click(choice(menu, label));
  return within(menu).getByRole('listbox', { name: label });
};
const option = (list: HTMLElement, label: string) =>
  within(list).getByRole('option', { name: (name) => name.startsWith(`${label} `) });
const closeMenu = () => {
  fireEvent.keyDown(window, { key: 'Escape' });
  act(() => {
    vi.runAllTimers();
  });
};

const renderMakes = () =>
  render(
    <CurrentUserContext value={ola}>
      <App initialPage="makes" />
    </CurrentUserContext>,
  );

describe('the Makes toolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([
        recipe('bread', 'Cheese Bread', 'breads'),
        recipe('zurek', 'Żurek', 'soups'),
      ]),
    );
    localStorage.setItem('family_kitchen_makes', JSON.stringify(MAKES));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('heads the page as the Recipe Box does, with a count of makes and cooks', () => {
    renderMakes();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.makes);
    expect(screen.getByText(t.makesCaption(3, 2))).toBeInTheDocument();
    // Filter and sort only: no search, no layout switch.
    expect(screen.getByRole('button', { name: t.filterMakes })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.sortMakes })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.openSearch })).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(t.recipeLayout) })).toBeNull();
    expect(shownMakes()).toEqual(['Crusty loaf', 'Big pot', 'Second loaf']);
  });

  it('filters by who made it, and the chip that shows it takes it off', () => {
    renderMakes();
    const menu = openMenu(t.filterMakes);
    const list = unfold(menu, t.filterMaker);
    expect(option(list, 'Kasia')).toHaveTextContent('2');
    fireEvent.click(option(list, 'Piotr'));
    expect(shownMakes()).toEqual(['Second loaf']);
    closeMenu();
    expect(screen.getByText(t.makesShown(1), { selector: '.vault-summary-count' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: t.removeFilter('Piotr') }));
    expect(shownMakes()).toHaveLength(3);
  });

  it("filters by the recipe's category and by the recipe itself", () => {
    renderMakes();
    const menu = openMenu(t.filterMakes);
    const categories = unfold(menu, t.categoryLabel);
    fireEvent.click(option(categories, t.recipeCategories.soups));
    expect(shownMakes()).toEqual(['Big pot']);
    fireEvent.click(option(categories, t.allCategories));
    fireEvent.click(option(unfold(menu, t.filterRecipe), 'Cheese Bread'));
    expect(shownMakes()).toEqual(['Crusty loaf', 'Second loaf']);
  });

  it('shows only the makes this person hearted', () => {
    renderMakes();
    const menu = openMenu(t.filterMakes);
    const hearted = within(menu).getByRole('switch', { name: new RegExp(t.heartedByMe) });
    expect(hearted).toHaveTextContent(t.heartedCaption(1));
    fireEvent.click(hearted);
    expect(shownMakes()).toEqual(['Big pot']);
    closeMenu();
    expect(screen.getByRole('button', { name: t.removeFilter(t.heartedByMe) })).toBeInTheDocument();
  });

  it('says when nothing matches, with a way back to every make', () => {
    renderMakes();
    const menu = openMenu(t.filterMakes);
    fireEvent.click(option(unfold(menu, t.filterMaker), 'Piotr'));
    fireEvent.click(option(unfold(menu, t.categoryLabel), t.recipeCategories.soups));
    expect(shownMakes()).toEqual([]);
    closeMenu();
    expect(screen.getByText(t.noMakesMatch)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.showAllMakes }));
    expect(shownMakes()).toHaveLength(3);
  });

  it('sorts by hearts, recipe or maker, turns round on a second tap, and remembers it', () => {
    const { unmount } = renderMakes();
    const menu = openMenu(t.sortMakes);
    fireEvent.click(choice(menu, t.makesSorts.hearts));
    expect(shownMakes()).toEqual(['Big pot', 'Second loaf', 'Crusty loaf']);
    fireEvent.click(choice(menu, t.makesSorts.recipe));
    expect(shownMakes()).toEqual(['Crusty loaf', 'Second loaf', 'Big pot']);
    const byMaker = choice(menu, t.makesSorts.maker);
    fireEvent.click(byMaker);
    expect(shownMakes()).toEqual(['Crusty loaf', 'Big pot', 'Second loaf']);
    fireEvent.click(byMaker);
    expect(byMaker).toHaveAccessibleName(`${t.makesSorts.maker} ${t.makesSortOrders.maker[1]}`);
    expect(shownMakes()).toEqual(['Second loaf', 'Crusty loaf', 'Big pot']);

    unmount();
    renderMakes();
    expect(shownMakes()).toEqual(['Second loaf', 'Crusty loaf', 'Big pot']);
  });
});
