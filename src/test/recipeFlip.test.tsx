import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;
const root = document.documentElement;

const babka: Recipe = {
  id: 'babka',
  name: 'Babka',
  author: 'Ola',
  category: 'cakes',
  heroImage: '',
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g' }],
  steps: [{ num: 1, text: 'Knead.' }],
  createdAt: 1000,
};

/** Browser view transitions, each finishing when the test says so. */
function playViewTransitions() {
  const running: { nav?: string; finish: () => Promise<void> }[] = [];
  document.startViewTransition = vi.fn((update: () => void) => {
    let resolve = () => {};
    const finished = new Promise<void>((r) => (resolve = r));
    update();
    // What the page is marked with once the update ran (it may change its mind in there).
    running.push({ nav: root.dataset.nav, finish: () => act(async () => resolve()) });
    return { finished, ready: Promise.resolve() } as unknown as ViewTransition;
  }) as unknown as typeof document.startViewTransition;
  return running;
}

/** Where every element sits on screen: a card at `top`, by default in full view. */
function placeCards(top = 300) {
  Element.prototype.getBoundingClientRect = function () {
    return { top, bottom: top + 90, height: 90, width: 320, left: 0, right: 320 } as DOMRect;
  };
}

const realRect = Element.prototype.getBoundingClientRect;
const card = () => screen.getByRole('button', { name: 'Babka' });
const backButton = () => screen.queryByRole('button', { name: t.backToRecipes });
const recipeHeading = () => screen.queryByRole('heading', { name: 'Babka', level: 1 });

describe('a recipe card flipping open and shut', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    placeCards();
  });

  afterEach(() => {
    vi.useRealTimers();
    Element.prototype.getBoundingClientRect = realRect;
    Reflect.deleteProperty(document, 'startViewTransition');
    delete root.dataset.nav;
    root.style.removeProperty('--flip-y');
  });

  /** Taps the card and lets it lift, which starts the flip. */
  const open = () => {
    fireEvent.click(card());
    act(() => {
      vi.advanceTimersByTime(200);
    });
  };

  it('lifts the card out of the box, flips it open, then offers the way back', async () => {
    const transitions = playViewTransitions();
    render(<App />);
    fireEvent.click(card());
    // Lifting first: the page hasn't changed yet.
    expect(card()).toHaveAttribute('data-lifted');
    expect(transitions).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(transitions[0].nav).toBe('flip-open');
    // Turned on the lifted card's middle line.
    expect(root.style.getPropertyValue('--flip-y')).toBe('345px');
    expect(recipeHeading()).toBeInTheDocument();
    expect(backButton()).toBeNull();

    await transitions[0].finish();
    expect(backButton()).toBeInTheDocument();
  });

  it('ignores a second tap while the card lifts', () => {
    const transitions = playViewTransitions();
    render(<App />);
    fireEvent.click(card());
    fireEvent.click(card());
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(transitions).toHaveLength(1);
  });

  it('folds the recipe onto its card, which flips home lifted and then drops into place', async () => {
    const transitions = playViewTransitions();
    render(<App />);
    open();
    await transitions[0].finish();

    fireEvent.click(backButton()!);
    expect(transitions[1].nav).toBe('flip-close');
    expect(recipeHeading()).toBeNull();
    // Shown lifted at once, as it left, while the recipe folds onto it.
    expect(card()).toHaveAttribute('data-lifted', 'landing');

    await transitions[1].finish();
    // Settling back behind the card in front, then at rest.
    expect(card()).toHaveAttribute('data-lifted', 'dropping');
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(card()).not.toHaveAttribute('data-lifted');
  });

  it('drops a card still shown lifted when another is opened before it settled', async () => {
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([babka, { ...babka, id: 'sernik', name: 'Sernik', createdAt: 2000 }]),
    );
    const transitions = playViewTransitions();
    render(<App />);
    open();
    await transitions[0].finish();
    fireEvent.click(backButton()!);
    expect(card()).toHaveAttribute('data-lifted', 'landing');

    // The return hasn't settled (its transition was cut short) when the next card is tapped.
    fireEvent.click(screen.getByRole('button', { name: 'Sernik' }));
    expect(card()).not.toHaveAttribute('data-lifted');
    expect(screen.getByRole('button', { name: 'Sernik' })).toHaveAttribute('data-lifted', '');
  });

  it('fades the box in instead where the card is out of sight', async () => {
    const transitions = playViewTransitions();
    render(<App />);
    open();
    await transitions[0].finish();

    placeCards(-2000);
    fireEvent.click(backButton()!);
    expect(transitions[1].nav).toBe('fade');
    expect(card()).not.toHaveAttribute('data-lifted');
  });

  it('opens straight away from a card out of sight', () => {
    const transitions = playViewTransitions();
    placeCards(-2000);
    render(<App />);
    fireEvent.click(card());
    expect(transitions[0].nav).toBe('forward');
    expect(recipeHeading()).toBeInTheDocument();
  });

  it('keeps the back button out beside the menu button while the menu is open', async () => {
    const transitions = playViewTransitions();
    render(<App />);
    open();
    await transitions[0].finish();

    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    // While the menu is open it closes the menu, and says so.
    expect(screen.getAllByRole('button', { name: t.closeMenu })).toHaveLength(2);
    expect(document.querySelector('.fab-group')).toHaveAttribute('data-back', 'shown');
    const menu = screen.getByRole('dialog', { name: t.menu });
    expect(within(menu).getByRole('button', { name: t.shareRecipe })).toBeInTheDocument();
  });

  it('shows the recipe and its back button at once where nothing animates', () => {
    render(<App />);
    fireEvent.click(card());
    expect(backButton()).toBeInTheDocument();

    fireEvent.click(backButton()!);
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();
  });
});
