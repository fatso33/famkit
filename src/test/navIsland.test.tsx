import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../App';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { UI_TEXT } from '../i18n/translations';
import { finishMenuClosing } from './menu';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;

const actionsButton = () => screen.getByRole('button', { name: /^(open|close) menu$/i });
const island = () => document.querySelector<HTMLElement>('.nav-island')!;
const tabs = () => screen.getByRole('navigation', { name: t.pages });
const tab = (name: string) => within(tabs()).getByRole('button', { name });

const openPanel = () => {
  fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
  return screen.getByRole('dialog', { name: t.menu });
};

/** Unfolds the preferences drawer, where the language, theme and text size live. */
const openPreferences = (panel: HTMLElement) => {
  const toggle = within(panel).getByRole('button', { name: t.preferences });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
};

/** jsdom runs no CSS animations, so finish the exit animation by hand. */
const finishClosing = () => {
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
};

const openRecipe = () =>
  fireEvent.click(screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name }));

describe('the navigation island', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([WANDAS_CHEESE_BREAD]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('holds the three main pages as tabs, the current one marked, under short labels', () => {
    render(<App initialPage="recipes" />);
    const buttons = within(tabs()).getAllByRole('button');

    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      t.counter,
      t.recipeVault,
      t.makes,
    ]);
    expect(buttons.map((b) => b.textContent)).toEqual([t.navCounter, t.navRecipes, t.navMakes]);
    expect(tab(t.recipeVault)).toHaveAttribute('aria-current', 'page');
    expect(tab(t.counter)).not.toHaveAttribute('aria-current');
  });

  it('switches pages on its tabs, with a light tick of the phone', async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    render(<App initialPage="recipes" />);

    fireEvent.click(tab(t.makes));
    await act(async () => {});
    expect(screen.getByRole('heading', { name: t.makes, level: 1 })).toBeInTheDocument();
    expect(tab(t.makes)).toHaveAttribute('aria-current', 'page');
    expect(vibrate).toHaveBeenCalledOnce();

    // The current page's own tab doesn't tick, and returns to the page's top.
    fireEvent.click(tab(t.makes));
    expect(vibrate).toHaveBeenCalledOnce();
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('opens and closes its actions panel from the button beside the pill', () => {
    render(<App initialPage="recipes" />);
    expect(document.querySelector('.app-header')).toBeNull();
    expect(actionsButton()).toHaveAttribute('aria-expanded', 'false');

    openPanel();
    expect(actionsButton()).toHaveAttribute('aria-expanded', 'true');
    expect(actionsButton()).toHaveAccessibleName(t.closeMenu);
    expect(island()).toHaveAttribute('data-menu', 'open');

    fireEvent.click(actionsButton());
    finishClosing();
    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
    expect(island()).not.toHaveAttribute('data-menu');
  });

  it("offers each page's own actions: Add Recipe on the Recipe Box, Add Make on Makes", async () => {
    render(<App initialPage="recipes" />);
    let panel = openPanel();
    expect(within(panel).getByText(t.recipeVault)).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: t.addMake })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: t.addRecipe }));
    finishClosing();
    expect(screen.getByRole('dialog', { name: t.editorTitleNew })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });

    fireEvent.click(tab(t.makes));
    await act(async () => {});
    panel = openPanel();
    expect(within(panel).queryByRole('button', { name: t.addRecipe })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: t.addMake }));
    finishClosing();
    expect(screen.getByRole('dialog', { name: t.addMake })).toBeInTheDocument();
  });

  it('keeps the preferences folded until asked, under Settings', () => {
    render(<App initialPage="recipes" />);
    const panel = openPanel();
    const toggle = within(panel).getByRole('button', { name: t.preferences });
    const drawer = document.getElementById(toggle.getAttribute('aria-controls') ?? '');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toHaveAttribute('inert');
    openPreferences(panel);
    expect(drawer).not.toHaveAttribute('inert');
    fireEvent.click(toggle);
    expect(drawer).toHaveAttribute('inert');
  });

  it('switches language without a toast, since the whole page changes', () => {
    render(<App initialPage="recipes" />);
    const panel = openPanel();
    openPreferences(panel);
    fireEvent.click(within(panel).getByRole('button', { name: t.languageToggle }));

    expect(screen.getByRole('heading', { name: UI_TEXT.pl.vaultTitle, level: 1 })).toBeVisible();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('opens Settings, which has a back button to the page it came from', async () => {
    render(<App initialPage="makes" />);
    const panel = openPanel();
    fireEvent.click(within(panel).getByRole('button', { name: t.settings }));
    await finishMenuClosing();

    expect(screen.getByRole('heading', { name: t.settings, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(t.translationInfo)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    // No tab is the page, and the panel has no Settings of its own here.
    expect(within(tabs()).queryByRole('button', { current: 'page' })).toBeNull();
    expect(within(openPanel()).queryByRole('button', { name: t.settings })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    finishClosing();

    fireEvent.click(screen.getByRole('button', { name: t.goBack }));
    expect(screen.getByRole('heading', { name: t.makes, level: 1 })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the actions button', () => {
    render(<App initialPage="recipes" />);
    openPanel();

    fireEvent.keyDown(window, { key: 'Escape' });
    finishClosing();

    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
    expect(actionsButton()).toHaveFocus();
  });

  it('closes when keyboard focus leaves it for the page behind', () => {
    render(<App initialPage="recipes" />);
    openPanel();
    const card = screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name });

    act(() => card.focus());
    finishClosing();

    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
    expect(card).toHaveFocus();
  });

  it('stays open when focus moves between its own controls or to the island', () => {
    render(<App initialPage="recipes" />);
    const panel = openPanel();

    act(() => within(panel).getByRole('button', { name: t.settings }).focus());
    act(() => tab(t.makes).focus());
    act(() => actionsButton().focus());

    expect(panel).not.toHaveClass('is-closing');
  });

  it("holds a recipe's Download, Remix, Add Make and (on its own row) Edit, under its name", () => {
    render(<App initialPage="recipes" />);
    openRecipe();
    expect(screen.queryByRole('button', { name: t.editRecipe })).toBeNull();

    const panel = openPanel();
    const actions = within(panel).getByRole('list', { name: WANDAS_CHEESE_BREAD.name });
    const keys = within(actions).getAllByRole('button');
    expect(keys.map((b) => b.textContent)).toEqual([
      t.downloadRecipe,
      t.remixRecipe,
      t.addMake,
      t.editRecipe,
    ]);
    expect(keys.map((b) => b.parentElement!.classList.contains('is-wide'))).toEqual([
      false,
      false,
      false,
      true,
    ]);

    fireEvent.click(within(actions).getByRole('button', { name: t.editRecipe }));
    finishClosing();
    expect(screen.getByRole('dialog', { name: t.editorTitleEdit })).toBeInTheDocument();
  });

  it("lights the Recipe Box's tab on a recipe, its tin holding the card, which takes it back", () => {
    render(<App initialPage="recipes" />);
    expect(island()).not.toHaveAttribute('data-recipe');
    openRecipe();

    expect(island()).toHaveAttribute('data-recipe');
    expect(tab(t.recipeVault)).toHaveAttribute('aria-current', 'page');
    fireEvent.click(tab(t.recipeVault));
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();
    expect(island()).not.toHaveAttribute('data-recipe');
  });

  it('leaves a recipe for another tab straight away', async () => {
    render(<App initialPage="recipes" />);
    openRecipe();
    fireEvent.click(tab(t.makes));
    await act(async () => {});
    expect(screen.getByRole('heading', { name: t.makes, level: 1 })).toBeInTheDocument();
    expect(island()).toHaveAttribute('data-back', 'in');
  });

  it("closes the actions panel when a tab is chosen, rather than keeping the old page's actions", async () => {
    render(<App initialPage="recipes" />);
    openRecipe();
    const panel = openPanel();
    expect(within(panel).getByRole('button', { name: t.editRecipe })).toBeInTheDocument();

    fireEvent.click(tab(t.makes));
    await act(async () => {});
    expect(panel).toHaveClass('is-closing');
    finishClosing();
    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
    expect(screen.getByRole('heading', { name: t.makes, level: 1 })).toBeInTheDocument();
  });

  it('keeps the back button out while the panel is open, where it closes only the panel', () => {
    render(<App initialPage="recipes" />);
    openRecipe();
    const panel = openPanel();

    // The actions button is named Close menu too; the back button is the one without a panel.
    const back = screen
      .getAllByRole('button', { name: t.closeMenu })
      .find((button) => !button.hasAttribute('aria-expanded'))!;
    expect(back).toBeDefined();
    act(() => back.focus());
    expect(panel).not.toHaveClass('is-closing');

    fireEvent.click(back);
    expect(panel).toHaveClass('is-closing');
    finishClosing();
    expect(
      screen.getByRole('heading', { name: WANDAS_CHEESE_BREAD.name, level: 1 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();
  });

  it('shrinks to the current page while the page scrolls down, and opens on a tap', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    render(<App initialPage="recipes" />);
    const scrollTo = (y: number) => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
      fireEvent.scroll(window);
    };

    now = 5000;
    scrollTo(400);
    expect(island()).toHaveAttribute('data-compact');
    // A tap only opens it out again, without changing page.
    fireEvent.click(tab(t.makes));
    expect(island()).not.toHaveAttribute('data-compact');
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();

    scrollTo(700);
    expect(island()).toHaveAttribute('data-compact');
    scrollTo(500);
    expect(island()).not.toHaveAttribute('data-compact');
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('opens out again on the next page, even one of the same kind as where it shrank', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    render(<App initialPage="recipes" />);
    openRecipe();
    now = 5000;
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true });
    fireEvent.scroll(window);
    expect(island()).toHaveAttribute('data-compact');

    // Back to the box, then another recipe (the same one will do): it opens at its top.
    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    expect(island()).not.toHaveAttribute('data-compact');
    openRecipe();
    expect(island()).not.toHaveAttribute('data-compact');
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('switches to dark mode from the sun and moon pill', () => {
    render(<App initialPage="recipes" />);
    const panel = openPanel();
    openPreferences(panel);
    const dark = within(panel).getByRole('switch', { name: t.darkMode });
    const wasDark = dark.getAttribute('aria-checked') === 'true';

    fireEvent.click(dark);
    expect(dark).toHaveAttribute('aria-checked', String(!wasDark));
    expect(document.documentElement).toHaveAttribute('data-theme', wasDark ? 'light' : 'dark');
  });

  it('spreads the new theme out from the pill, as on the splash', () => {
    // A browser's view transition: snapshots, applies the change, then animates.
    const start = vi.fn((update: () => void) => {
      update();
      return { ready: new Promise(() => {}), finished: new Promise(() => {}) };
    });
    document.startViewTransition = start as unknown as typeof document.startViewTransition;
    render(<App initialPage="recipes" />);
    const panel = openPanel();
    openPreferences(panel);
    const dark = within(panel).getByRole('switch', { name: t.darkMode });
    const wasDark = dark.getAttribute('aria-checked') === 'true';

    fireEvent.click(dark);
    expect(start).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.themeSwap).toBe('');
    expect(document.documentElement).toHaveAttribute('data-theme', wasDark ? 'light' : 'dark');
    Reflect.deleteProperty(document, 'startViewTransition');
    delete document.documentElement.dataset.themeSwap;
  });
});
