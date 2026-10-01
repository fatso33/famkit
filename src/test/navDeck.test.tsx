import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../App';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { UI_TEXT } from '../i18n/translations';
import { Make } from '../types/make';
import { Recipe } from '../types/recipe';
import { WIDE_SCREEN } from '../hooks/useWideScreen';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateDocuments: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;

const pierogi: Recipe = {
  ...WANDAS_CHEESE_BREAD,
  id: 'pierogi',
  name: 'Pierogi ruskie',
  author: 'Babcia Zosia',
  category: 'mains',
  createdAt: 50,
};

const make = (id: string, title: string, ownerName: string): Make => ({
  id,
  recipeId: WANDAS_CHEESE_BREAD.id,
  title,
  photo: 'data:image/jpeg;base64,AAAA',
  ownerEmail: `${id}@example.com`,
  ownerName,
  createdAt: 100,
  updatedAt: 100,
});

const tabs = () => screen.getByRole('navigation', { name: t.pages });
const tab = (name: string) => within(tabs()).getByRole('button', { name });
const deck = (name: string) => screen.getByRole('dialog', { name });
const queryDeck = (name: string) => screen.queryByRole('dialog', { name });
const onCounter = () => screen.queryByRole('heading', { name: t.freshInBox });

/** jsdom runs no CSS animations: finish a deck's fold back into its tab by hand. */
const finishFolding = () => {
  const folding = document.querySelector('.nav-deck.is-closing');
  if (folding) fireEvent.animationEnd(folding);
};

describe('card decks on a tablet', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([WANDAS_CHEESE_BREAD, pierogi]));
    localStorage.setItem(
      'family_kitchen_makes',
      JSON.stringify([make('m1', 'Sunday loaves', 'Ola'), make('m2', 'Chili night', 'Raye')]),
    );
    // A tablet: only the wide-screen query matches (no less motion asked for).
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === WIDE_SCREEN,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('raises the Recipe Box deck over My Counter from its tab, and folds it away again', () => {
    render(<App />);
    expect(tab(t.recipeVault)).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(tab(t.recipeVault));
    const box = deck(t.recipeVault);
    expect(within(box).getByRole('button', { name: WANDAS_CHEESE_BREAD.name })).toBeVisible();
    expect(within(box).getByRole('button', { name: t.filterRecipes })).toBeInTheDocument();
    // No list/cards switch in the deck.
    expect(within(box).queryByRole('button', { name: /^Recipe layout/ })).toBeNull();
    // The page underneath stays My Counter, its tab still the current one.
    expect(onCounter()).toBeInTheDocument();
    expect(tab(t.counter)).toHaveAttribute('aria-current', 'page');
    expect(tab(t.recipeVault)).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(tab(t.recipeVault));
    finishFolding();
    expect(queryDeck(t.recipeVault)).toBeNull();
    expect(onCounter()).toBeInTheDocument();
  });

  it('closes on Escape, or a tap on the page around it', () => {
    render(<App />);
    fireEvent.click(tab(t.recipeVault));
    fireEvent.keyDown(window, { key: 'Escape' });
    finishFolding();
    expect(queryDeck(t.recipeVault)).toBeNull();

    fireEvent.click(tab(t.makes));
    const scrim = document.querySelector('.nav-deck-scrim')!;
    fireEvent.mouseDown(scrim);
    fireEvent.click(scrim);
    finishFolding();
    expect(queryDeck(t.makes)).toBeNull();
  });

  it('keeps the folding deck the one shown when tabs are tapped mid-swap', () => {
    render(<App />);
    // Makes tapped twice while the Recipe Box deck folds: the box carries on folding, and
    // Makes, closed again before it rose, never shows.
    fireEvent.click(tab(t.recipeVault));
    fireEvent.click(tab(t.makes));
    fireEvent.click(tab(t.makes));
    expect(deck(t.recipeVault)).toHaveClass('is-closing');
    expect(queryDeck(t.makes)).toBeNull();
    finishFolding();
    expect(queryDeck(t.recipeVault)).toBeNull();
    expect(queryDeck(t.makes)).toBeNull();

    // The Recipe Box tapped again as it folds for Makes: it rises again, and Makes never does.
    fireEvent.click(tab(t.recipeVault));
    fireEvent.click(tab(t.makes));
    fireEvent.click(tab(t.recipeVault));
    expect(deck(t.recipeVault)).not.toHaveClass('is-closing');
    expect(tab(t.recipeVault)).toHaveAttribute('aria-expanded', 'true');
    expect(queryDeck(t.makes)).toBeNull();
  });

  it('swaps one deck for the other, once the first has folded away', () => {
    render(<App />);
    fireEvent.click(tab(t.recipeVault));
    fireEvent.click(tab(t.makes));
    expect(tab(t.makes)).toHaveAttribute('aria-expanded', 'true');
    finishFolding();
    expect(queryDeck(t.recipeVault)).toBeNull();
    expect(deck(t.makes)).toBeInTheDocument();
  });

  it("opens no deck from a page's own tab: it returns to the top, as on a phone", () => {
    render(<App initialPage="recipes" />);
    expect(tab(t.recipeVault)).not.toHaveAttribute('aria-haspopup');

    fireEvent.click(tab(t.recipeVault));
    expect(queryDeck(t.recipeVault)).toBeNull();
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    // Makes still raises its deck over the Recipe Box.
    expect(tab(t.makes)).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens a recipe picked from the deck, and back returns to the page underneath', async () => {
    render(<App />);
    fireEvent.click(tab(t.recipeVault));
    fireEvent.click(within(deck(t.recipeVault)).getByRole('button', { name: pierogi.name }));
    await act(async () => {});

    expect(screen.getByRole('heading', { name: pierogi.name, level: 1 })).toBeInTheDocument();
    expect(queryDeck(t.recipeVault)).toBeNull();
    // On the recipe, the Recipe Box tab raises the deck again (to pick another).
    expect(tab(t.recipeVault)).toHaveAttribute('aria-haspopup', 'dialog');

    fireEvent.click(screen.getByRole('button', { name: t.goBack }));
    await act(async () => {});
    expect(onCounter()).toBeInTheDocument();
  });

  it('shares its filter with the Recipe Box, where "See all" opens', async () => {
    render(<App initialPage="makes" />);
    fireEvent.click(tab(t.recipeVault));
    const box = deck(t.recipeVault);
    fireEvent.click(within(box).getByRole('button', { name: t.openSearch }));
    fireEvent.change(within(box).getByRole('searchbox'), { target: { value: 'pier' } });
    expect(within(box).queryByRole('button', { name: WANDAS_CHEESE_BREAD.name })).toBeNull();
    expect(within(box).getByRole('button', { name: pierogi.name })).toBeInTheDocument();

    fireEvent.click(within(box).getByRole('button', { name: t.seeAllRecipes }));
    await act(async () => {});
    expect(queryDeck(t.recipeVault)).toBeNull();
    expect(tab(t.recipeVault)).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('searchbox')).toHaveValue('pier');
    expect(screen.queryByRole('button', { name: WANDAS_CHEESE_BREAD.name })).toBeNull();
  });

  it('finds makes in the Makes deck, and opens one on the Makes page', async () => {
    render(<App />);
    fireEvent.click(tab(t.makes));
    const makes = deck(t.makes);
    expect(within(makes).getAllByRole('button', { name: /^Open the make/ })).toHaveLength(2);

    fireEvent.change(within(makes).getByRole('searchbox', { name: t.searchMakes }), {
      target: { value: 'raye' },
    });
    expect(within(makes).getAllByRole('button', { name: /^Open the make/ })).toHaveLength(1);
    fireEvent.click(within(makes).getByRole('button', { name: t.clearSearch }));
    expect(within(makes).getAllByRole('button', { name: /^Open the make/ })).toHaveLength(2);

    fireEvent.click(within(makes).getByRole('button', { name: t.openMakeNamed('Chili night') }));
    await act(async () => {});
    expect(queryDeck(t.makes)).toBeNull();
    expect(screen.getByRole('heading', { name: t.makes, level: 1 })).toBeInTheDocument();
    expect(tab(t.makes)).toHaveAttribute('aria-current', 'page');
  });

  it('has no decks on a phone: the tabs go straight to their pages', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    render(<App />);
    expect(tab(t.recipeVault)).not.toHaveAttribute('aria-haspopup');
    fireEvent.click(tab(t.recipeVault));
    await act(async () => {});
    expect(queryDeck(t.recipeVault)).toBeNull();
    expect(tab(t.recipeVault)).toHaveAttribute('aria-current', 'page');
  });
});
