import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { chooseFromMenu } from './menu';
import { Recipe } from '../types/recipe';
import { saveRecipe } from './editorHelpers';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;

const recipe = (id: string, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  author: 'Ola',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1000,
  ...extra,
});

const card = (name: string) => screen.queryByRole('button', { name });
const editor = () => screen.queryByRole('dialog', { name: /edit recipe/i });

/**
 * jsdom runs no CSS animations, so layers close at once. This stands in for a browser that
 * is playing their exit animation, plus an endless one the close must not wait for.
 */
function playExitAnimations() {
  let finishExit = () => {};
  const exit = {
    animationName: 'fk-exit-sheet-down',
    finished: new Promise<void>((resolve) => (finishExit = resolve)),
  };
  const endless = { animationName: 'version-pulse', finished: new Promise<void>(() => {}) };
  HTMLElement.prototype.getAnimations = vi.fn(() => [exit, endless] as unknown as Animation[]);
  return { finishExit: () => act(async () => finishExit()) };
}

describe('motion', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([
        recipe('Babka', { category: 'breads' }),
        recipe('Pierogi', { createdAt: 2000 }),
      ]),
    );
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
  });

  it("returns to the vault's filter and scroll position after a recipe", () => {
    render(<App initialPage="recipes" />);
    fireEvent.click(screen.getByRole('button', { name: t.filterRecipes }));
    const filter = screen.getByRole('dialog', { name: t.filterRecipes });
    fireEvent.click(
      within(filter).getByRole('button', { name: (name) => name.startsWith(t.categoryLabel) }),
    );
    fireEvent.click(
      within(filter).getByRole('option', {
        name: (name) => name.startsWith(t.recipeCategories.breads),
      }),
    );
    expect(card('Pierogi')).toBeNull();

    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    fireEvent.click(card('Babka')!);
    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));

    expect(card('Babka')).toBeInTheDocument();
    expect(card('Pierogi')).toBeNull();
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'instant' });
    Reflect.deleteProperty(window, 'scrollY');
  });

  it('sets the remembered scroll on the vault itself, not on the recipe it replaces', () => {
    render(<App initialPage="recipes" />);
    Object.defineProperty(window, 'scrollY', { value: 1800, configurable: true });
    fireEvent.click(card('Babka')!);
    // A recipe page shorter than the vault can't scroll that far, so a jump made while it is
    // still showing lands short of the card that was opened.
    const vaultThere: boolean[] = [];
    window.scrollTo = vi.fn(() => {
      vaultThere.push(!!document.getElementById('viewGrid'));
    }) as unknown as typeof window.scrollTo;
    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));

    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 1800, behavior: 'instant' });
    expect(vaultThere.at(-1)).toBe(true);
    Reflect.deleteProperty(window, 'scrollY');
  });

  it('keeps the editor on screen until its exit animation ends', async () => {
    const { finishExit } = playExitAnimations();
    render(<App initialPage="recipes" />);
    fireEvent.click(card('Babka')!);
    chooseFromMenu(UI_TEXT.en.editRecipe);

    fireEvent.click(within(editor()!).getByRole('button', { name: t.closeDialog }));
    expect(editor()).toBeInTheDocument();

    await finishExit();
    expect(editor()).toBeNull();
  });

  it('morphs a step photo from exactly one element to exactly one other', async () => {
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([
        recipe('Babka', {
          steps: [
            { num: 1, text: 'Knead.', hasImage: true, imageSrc: 'data:,', imageCaption: 'Dough' },
          ],
        }),
      ]),
    );
    // What carries the morphing photo's name (index.css): the marked thumbnail, the viewer.
    const morphing = () =>
      [
        document.querySelector('.is-zoom-source') && 'thumbnail',
        document.querySelector('.zoomable-image') && 'viewer',
      ].filter(Boolean);
    // A browser snapshots before and after the update; a name on two elements cancels it.
    const snapshots: string[][] = [];
    document.startViewTransition = ((update: () => void) => {
      snapshots.push(morphing() as string[]);
      update();
      snapshots.push(morphing() as string[]);
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    }) as unknown as typeof document.startViewTransition;

    render(<App initialPage="recipes" />);
    snapshots.length = 0; // Only the photo's transitions matter here.
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    snapshots.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Dough' }));
    fireEvent.click(screen.getByRole('button', { name: t.closePhotoPreview }));
    await act(async () => {});

    expect(snapshots).toEqual([['thumbnail'], ['viewer'], ['viewer'], ['thumbnail']]);
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('still closes the editor when its exit animation stalls', async () => {
    playExitAnimations(); // Never finished, as when the app is backgrounded mid-close.
    render(<App initialPage="recipes" />);
    fireEvent.click(card('Babka')!);
    chooseFromMenu(UI_TEXT.en.editRecipe);
    fireEvent.click(within(editor()!).getByRole('button', { name: t.closeDialog }));

    await act(() => new Promise((resolve) => setTimeout(resolve, 1100)));
    expect(editor()).toBeNull();
  });

  it('slides the saved recipe away, rather than an emptied or new-recipe form', async () => {
    const { finishExit } = playExitAnimations();
    render(<App initialPage="recipes" />);
    fireEvent.click(card('Babka')!);
    chooseFromMenu(UI_TEXT.en.editRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Babka Wielkanocna' },
    });

    saveRecipe(t);
    // Still the same editor, with what was saved in it, while it slides away.
    expect(within(editor()!).getByLabelText(t.recipeTitle)).toHaveValue('Babka Wielkanocna');

    await finishExit();
    expect(editor()).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Babka Wielkanocna');
  });
});
