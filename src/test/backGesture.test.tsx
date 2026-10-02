import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { goFromMenu } from './menu';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;

const babka: Recipe = {
  id: 'babka',
  name: 'Babka',
  author: 'Babcia Zosia',
  authorMode: 'custom',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g' }],
  steps: [
    {
      num: 1,
      text: 'Knead.',
      hasImage: true,
      imageSrc: 'data:image/jpeg;base64,DOUGH',
      imageCaption: 'Kneaded dough',
    },
  ],
  createdAt: 1000,
};

const heading = () => screen.getByRole('heading', { level: 1 });
const counter = () => document.getElementById('viewCounter');
const photo = () => screen.queryByRole('dialog', { name: t.photoZoomDialog });
const editor = () =>
  screen.queryByRole('dialog', {
    name: new RegExp(`${t.editorTitleEdit}|${t.editorTitleNew}`, 'i'),
  });
/** How many entries the app holds above the main page's. */
const depth = () => (window.history.state as { famkitDepth?: number } | null)?.famkitDepth ?? 0;

/** The phone's back gesture: the browser moves back in history, then tells the page. */
async function swipeBack() {
  const popped = new Promise((resolve) =>
    window.addEventListener('popstate', resolve, { once: true }),
  );
  await act(async () => {
    window.history.back();
    await popped;
  });
}

/** Settles any history change the app makes on its own, such as popping its entries. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

/** Waits for the app to line history up, which can take a few traversals. */
const historyAt = (entries: number) => waitFor(() => expect(depth()).toBe(entries));

const openMenuItem = (name: string) => goFromMenu(name, t);

const openBabka = () => fireEvent.click(screen.getByRole('button', { name: 'Babka' }));

describe('back gesture', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    await historyAt(0);
  });

  it("leaves scroll to the app, so the browser can't undo the vault's remembered spot", () => {
    // Browsers restore each entry's saved scroll on back, which jumped a morphing photo mid-flight.
    expect(window.history.scrollRestoration).toBe('manual');
  });

  it('goes from a recipe back to the vault', async () => {
    render(<App initialPage="recipes" />);
    openBabka();
    expect(heading()).toHaveTextContent('Babka');

    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('goes from the Recipe Box home to My Counter, and only from there leaves the app', async () => {
    render(<App initialPage="recipes" />);
    // The Recipe Box holds an entry of its own, which back undoes.
    await historyAt(1);

    await swipeBack();
    expect(counter()).toBeInTheDocument();
    await historyAt(0);
    // Nothing animated it (no view transitions here), so no page motion is left marked.
    expect(document.documentElement.dataset.nav).toBeUndefined();
  });

  it('goes from Makes home to My Counter too', async () => {
    render(<App />);
    expect(counter()).toBeInTheDocument();
    await openMenuItem(t.makes);
    await settle();
    expect(heading()).toHaveTextContent(t.makes);
    expect(depth()).toBe(1);

    await swipeBack();
    expect(counter()).toBeInTheDocument();
    await historyAt(0);
  });

  it('folds the Recipe Box into its window as a card', async () => {
    const realRect = Element.prototype.getBoundingClientRect;
    // Everything on screen, so the window is there to fold into.
    Element.prototype.getBoundingClientRect = () =>
      ({ top: 300, bottom: 400, height: 100, width: 320, left: 0, right: 320 }) as DOMRect;
    let finish = () => {};
    let frameAtCapture = '';
    document.startViewTransition = vi.fn((update: () => void) => {
      frameAtCapture =
        document.querySelector<HTMLElement>('.vt-page-frame')!.style.viewTransitionName;
      update();
      return {
        finished: new Promise<void>((resolve) => (finish = resolve)),
        ready: Promise.resolve(),
      } as unknown as ViewTransition;
    }) as unknown as typeof document.startViewTransition;
    try {
      render(<App initialPage="recipes" />);
      await historyAt(1);

      await swipeBack();
      expect(counter()).toBeInTheDocument();
      expect(document.documentElement.dataset.nav).toBe('window-close');
      // The page's end of the card is the screen-sized frame, named as the old page is captured.
      expect(frameAtCapture).toBe('page-window');
      // The card is the old page's alone (WebKit draws one taken on the new page blank), shrinking
      // to the window's place.
      const frame = document.querySelector<HTMLElement>('.vt-page-frame')!;
      expect(frame.style.viewTransitionName).toBe('');
      const root = document.documentElement;
      expect(root.style.getPropertyValue('--win-top')).toBe('300px');
      expect(root.style.getPropertyValue('--win-bottom')).toBe(`${window.innerHeight - 400}px`);

      await act(async () => finish());
      expect(root.dataset.nav).toBeUndefined();
      expect(root.style.getPropertyValue('--win-top')).toBe('');
    } finally {
      Element.prototype.getBoundingClientRect = realRect;
      Reflect.deleteProperty(document, 'startViewTransition');
    }
  });

  it('closes a photo open on Makes first, then goes home', async () => {
    localStorage.setItem(
      'family_kitchen_makes',
      JSON.stringify([
        {
          id: 'make-1',
          recipeId: 'babka',
          title: 'Sunday babka',
          photo: 'data:image/jpeg;base64,BABKA',
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );
    render(<App initialPage="recipes" />);
    await openMenuItem(t.makes);
    // The menu's entry gives way to Makes' own.
    await settle();
    fireEvent.click(screen.getByRole('button', { name: t.viewMakePhoto('Sunday babka') }));
    expect(photo()).toBeInTheDocument();
    // Makes' own entry, and the photo's over it.
    await historyAt(2);

    await swipeBack();
    expect(photo()).toBeNull();
    expect(heading()).toHaveTextContent(t.makes);

    await swipeBack();
    expect(counter()).toBeInTheDocument();
  });

  it('goes from Settings back to Makes when it was opened from Makes', async () => {
    render(<App initialPage="recipes" />);
    await openMenuItem(t.makes);
    await openMenuItem(t.settings);
    expect(heading()).toHaveTextContent(t.settings);
    // The menu's own entry gives way to Settings', over Makes' own.
    await settle();
    expect(depth()).toBe(2);

    await swipeBack();
    expect(heading()).toHaveTextContent(t.makes);
  });

  it('goes from Settings back to the vault, not the recipe it was opened from', async () => {
    render(<App initialPage="recipes" />);
    openBabka();
    await openMenuItem(t.settings);
    await historyAt(2);

    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('closes an open menu first, then goes back to the vault', async () => {
    render(<App initialPage="recipes" />);
    openBabka();
    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    expect(depth()).toBe(3);

    await swipeBack();
    const panel = document.querySelector('.fk-menu-panel');
    if (panel) fireEvent.animationEnd(panel);
    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
    expect(heading()).toHaveTextContent('Babka');

    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('closes an open menu on My Counter instead of leaving the app', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    expect(depth()).toBe(1);

    await swipeBack();
    expect(screen.getByRole('button', { name: t.openMenu })).toBeInTheDocument();
    expect(counter()).toBeInTheDocument();
    await historyAt(0);
  });

  it("drops the menu's history entry when it's closed with a tap", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    expect(depth()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: t.closeMenu }));
    await historyAt(0);
  });

  it('closes a photo first, then goes back to the vault', async () => {
    render(<App initialPage="recipes" />);
    openBabka();
    fireEvent.click(screen.getByRole('button', { name: 'Kneaded dough' }));
    expect(photo()).toBeInTheDocument();
    expect(depth()).toBe(3);

    await swipeBack();
    expect(photo()).toBeNull();
    expect(heading()).toHaveTextContent('Babka');

    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it("drops its history entries when the app's own buttons close things", async () => {
    render(<App initialPage="recipes" />);
    openBabka();
    fireEvent.click(screen.getByRole('button', { name: 'Kneaded dough' }));
    fireEvent.click(within(photo()!).getByRole('button', { name: t.closePhotoPreview }));
    await historyAt(2);

    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    // Back on the Recipe Box's own entry, so the next back gesture goes home.
    await historyAt(1);
  });

  it('asks before going back from an edit with changes, keeping them meanwhile', async () => {
    render(<App initialPage="recipes" />);
    openBabka();
    await openMenuItem(t.editRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Babka Wielkanocna' },
    });
    await settle();

    // Nobody signed in, so no drafts: it asks before the changes go.
    await swipeBack();
    await settle();
    expect(screen.getByRole('alertdialog', { name: t.discardTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Babka Wielkanocna');

    // Back again answers "keep editing".
    await swipeBack();
    await settle();
    expect(screen.queryByRole('alertdialog', { name: t.discardTitle })).toBeNull();
    expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Babka Wielkanocna');

    // Closing the editor (its changes discarded) hands the gesture back to the recipe page.
    fireEvent.click(within(editor()!).getByRole('button', { name: t.closeDialog }));
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: t.discardTitle })).getByRole('button', {
        name: t.discard,
      }),
    );
    await historyAt(2);
    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('closes a new recipe on back, keeping what was typed on this phone', async () => {
    render(<App initialPage="recipes" />);
    await openMenuItem(t.addRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Pierniczki' },
    });
    await settle();
    await historyAt(2);

    await swipeBack();
    await settle();
    expect(editor()).toBeNull();
    expect(localStorage.getItem('family_kitchen_recipe_draft')).toContain('Pierniczki');
    await historyAt(1);
  });
});
