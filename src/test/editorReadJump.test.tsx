import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  ingredients: [{ text: 'Flour - 2 cups' }, { text: 'Water - 1 cup' }],
  steps: [
    { num: 1, text: 'Knead gently.' },
    { num: 2, text: 'Rest for an hour.' },
  ],
};

const layer = () => document.getElementById('addRecipeModal')!;
const readKey = () => screen.getByRole('button', { name: t.read });
const scroller = () => document.querySelector<HTMLElement>('.editor-scroll')!;
const pills = () => screen.getByRole('navigation', { name: t.jumpTo, hidden: true });

describe('the Read key', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it('shows the page as the family will see it, then goes back to writing', async () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);
    expect(readKey()).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(readKey());
    // Pressed at once; the keys and prompts fade out, then are put away.
    expect(readKey()).toHaveAttribute('aria-pressed', 'true');
    expect(layer()).toHaveClass('is-reading-soon');
    await waitFor(() => expect(layer()).toHaveClass('is-reading'));

    fireEvent.click(readKey());
    expect(readKey()).toHaveAttribute('aria-pressed', 'false');
    expect(layer()).not.toHaveClass('is-reading');
    // Back, fading in.
    expect(layer()).toHaveClass('is-read-ending');
    await waitFor(() => expect(layer()).not.toHaveClass('is-read-ending'));
  });

  it('goes back to writing when a part of the page is tapped', async () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);
    fireEvent.click(readKey());
    await waitFor(() => expect(layer()).toHaveClass('is-reading'));

    fireEvent.focus(screen.getByLabelText(t.stepInstructionLabel(2)));
    expect(layer()).not.toHaveClass('is-reading');
    expect(readKey()).toHaveAttribute('aria-pressed', 'false');
  });

  it('puts the keyboard down and closes the open tools as it starts', async () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);
    const step = screen.getByLabelText(t.stepInstructionLabel(1));
    step.focus();
    fireEvent.focus(step);
    expect(step.closest('li')).toHaveClass('is-active');

    fireEvent.click(readKey());
    expect(document.activeElement).not.toBe(step);
    expect(step.closest('li')).not.toHaveClass('is-active');
  });

  it('marks empty rows and steps, which reading puts away', () => {
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    // A new recipe's first row and step have nothing in them yet.
    expect(screen.getByLabelText(t.ingredientNameLabel(1)).closest('li')).toHaveClass('is-blank');
    expect(screen.getByLabelText(t.stepInstructionLabel(1)).closest('li')).toHaveClass('is-blank');

    fireEvent.change(screen.getByLabelText(t.ingredientNameLabel(1)), {
      target: { value: 'Flour' },
    });
    expect(screen.getByLabelText(t.ingredientNameLabel(1)).closest('li')).not.toHaveClass(
      'is-blank',
    );
  });

  it('works at once with reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);
    fireEvent.click(readKey());
    expect(layer()).toHaveClass('is-reading');
    fireEvent.click(readKey());
    expect(layer()).not.toHaveClass('is-reading');
    expect(layer()).not.toHaveClass('is-read-ending');
  });
});

describe('the jump pills', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  // jsdom lays nothing out: every part sits at the top, so the page counts as scrolled into
  // the recipe from the first scroll. The screen is 600px tall.
  const scrollTo = (top: number) => {
    scroller().scrollTop = top;
    fireEvent.scroll(scroller());
  };
  const setUp = () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);
    Object.defineProperty(scroller(), 'clientHeight', { configurable: true, value: 600 });
    Object.defineProperty(scroller(), 'scrollHeight', { configurable: true, value: 3000 });
    scroller().scrollTo = vi.fn();
  };

  it('come out once the page is scrolled into the recipe, out of reach until then', () => {
    setUp();
    expect(pills()).toHaveAttribute('inert');
    scrollTo(100);
    expect(pills()).not.toHaveAttribute('inert');
    expect(
      within(pills())
        .getAllByRole('button')
        .map((pill) => pill.getAttribute('aria-label')),
    ).toEqual([t.ingredients, t.jumpMethod, t.jumpExtras]);
  });

  it('glide to the place tapped, which lights at once, and stay through the glide', () => {
    setUp();
    scrollTo(1200);
    fireEvent.click(within(pills()).getByRole('button', { name: t.ingredients }));
    expect(scroller().scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
    expect(within(pills()).getByRole('button', { name: t.ingredients })).toHaveAttribute(
      'aria-current',
      'location',
    );
    // The glide scrolls up a long way: the pills stay, and so does the bar.
    for (const top of [900, 500, 200, 60]) scrollTo(top);
    expect(pills()).toHaveAttribute('data-shown', 'true');
    expect(document.querySelector('.editor-bar')).toHaveClass('is-tucked');
  });

  it('stay through scrolling about, and go after a long run down the page', () => {
    vi.useFakeTimers();
    try {
      setUp();
      scrollTo(200);
      scrollTo(400);
      scrollTo(300);
      expect(pills()).toHaveAttribute('data-shown', 'true');
      // More than a screen and a half down without going up.
      for (let top = 300; top <= 1300; top += 100) scrollTo(top);
      expect(pills()).toHaveAttribute('data-shown', 'false');
      // Any scroll up brings them back.
      scrollTo(1250);
      expect(pills()).toHaveAttribute('data-shown', 'true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('jump at once with reduced motion', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    setUp();
    scrollTo(1200);
    fireEvent.click(within(pills()).getByRole('button', { name: t.jumpMethod }));
    expect(scroller().scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    await act(async () => {});
  });
});
