import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

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

function openMenuItem(name: string) {
  fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
  const menu = screen.getByRole('dialog', { name: t.menu });
  fireEvent.click(within(menu).getByRole('button', { name }));
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
}

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
    render(<App />);
    openBabka();
    expect(heading()).toHaveTextContent('Babka');

    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('leaves the app from Makes, since it is a main page', async () => {
    render(<App />);
    openMenuItem(t.makes);
    await settle();

    expect(heading()).toHaveTextContent(t.makes);
    expect(depth()).toBe(0);
  });

  it('goes from Settings back to Makes when it was opened from Makes', async () => {
    render(<App />);
    openMenuItem(t.makes);
    openMenuItem(t.settings);
    expect(heading()).toHaveTextContent(t.settings);

    await swipeBack();
    expect(heading()).toHaveTextContent(t.makes);
  });

  it('goes from Settings back to the vault, not the recipe it was opened from', async () => {
    render(<App />);
    openBabka();
    openMenuItem(t.settings);

    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('closes a photo first, then goes back to the vault', async () => {
    render(<App />);
    openBabka();
    fireEvent.click(screen.getByRole('button', { name: 'Kneaded dough' }));
    expect(photo()).toBeInTheDocument();
    expect(depth()).toBe(2);

    await swipeBack();
    expect(photo()).toBeNull();
    expect(heading()).toHaveTextContent('Babka');

    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it("drops its history entries when the app's own buttons close things", async () => {
    render(<App />);
    openBabka();
    fireEvent.click(screen.getByRole('button', { name: 'Kneaded dough' }));
    fireEvent.click(within(photo()!).getByRole('button', { name: t.closePhotoPreview }));
    await historyAt(1);

    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    // Back on the main page's own entry, so the next back gesture leaves the app as usual.
    await historyAt(0);
  });

  it('keeps the recipe editor open, with its changes, when going back', async () => {
    render(<App />);
    openBabka();
    openMenuItem(t.editRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Babka Wielkanocna' },
    });

    await swipeBack();
    await settle();
    expect(editor()).toBeInTheDocument();
    expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Babka Wielkanocna');

    // And again: every swipe is absorbed while the draft is open.
    await swipeBack();
    await settle();
    expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Babka Wielkanocna');

    // Closing the editor (its changes discarded) hands the gesture back to the recipe page.
    fireEvent.click(within(editor()!).getByRole('button', { name: t.closeDialog }));
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: t.discardTitle })).getByRole('button', {
        name: t.discard,
      }),
    );
    await historyAt(1);
    await swipeBack();
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('keeps a new recipe draft open when going back from the vault', async () => {
    render(<App />);
    openMenuItem(t.addRecipe);
    expect(editor()).toBeInTheDocument();

    await swipeBack();
    await settle();
    expect(editor()).toBeInTheDocument();
  });
});
