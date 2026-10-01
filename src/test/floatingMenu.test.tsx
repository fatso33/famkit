import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const menuButton = () => screen.getByRole('button', { name: /^(open|close) menu$/i });

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
  return screen.getByRole('dialog', { name: t.menu });
};

/** Unfolds the preferences drawer, where the toggles and the Settings link live. */
const openPreferences = (menu: HTMLElement) => {
  const toggle = within(menu).getByRole('button', { name: t.preferences });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
};

/** jsdom runs no CSS animations, so finish the exit animation by hand. */
const finishClosing = () => {
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
};

describe('floating menu', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([WANDAS_CHEESE_BREAD]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  it('replaces the top banner and toggles open and closed', () => {
    render(<App />);
    expect(document.querySelector('.app-header')).toBeNull();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');

    openMenu();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton()).toHaveAccessibleName(t.closeMenu);

    fireEvent.click(menuButton());
    finishClosing();
    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
  });

  it('marks the current page and offers Add Recipe on the vault', () => {
    render(<App />);
    const menu = openMenu();

    expect(within(menu).getByRole('button', { name: t.recipeVault })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(within(menu).getByRole('button', { name: t.addRecipe }));
    finishClosing();

    expect(screen.getByRole('dialog', { name: t.editorTitleNew })).toBeInTheDocument();
  });

  it('switches to the Makes page and swaps the page action', async () => {
    render(<App />);
    fireEvent.click(within(openMenu()).getByRole('button', { name: t.makes }));
    await finishMenuClosing();

    expect(screen.getByRole('heading', { name: t.makes, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(t.makesEmptyTitle)).toBeInTheDocument();

    const menu = openMenu();
    expect(within(menu).getByRole('button', { name: t.addMake })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: t.addRecipe })).toBeNull();

    fireEvent.click(within(menu).getByRole('button', { name: t.addMake }));
    finishClosing();
    expect(screen.getByRole('dialog', { name: t.addMake })).toBeInTheDocument();
  });

  it('switches language without a toast, since the whole page changes', () => {
    render(<App />);
    const menu = openMenu();
    openPreferences(menu);
    fireEvent.click(within(menu).getByRole('button', { name: t.languageToggle }));

    const pl = UI_TEXT.pl;
    const plHeading = pl.vaultTitle;
    expect(screen.getByRole('heading', { name: plHeading, level: 1 })).toBeVisible();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('opens the Settings page, which explains translation and asks for no API key', () => {
    render(<App />);
    const menu = openMenu();
    openPreferences(menu);
    fireEvent.click(within(menu).getByRole('button', { name: t.settings }));
    finishClosing();

    expect(screen.getByRole('heading', { name: t.settings, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(t.translationInfo)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('lists the current page last, holding its own actions', () => {
    render(<App />);
    const pages = within(openMenu()).getByRole('navigation', { name: t.pages });
    const items = within(pages).getAllByRole('button');

    expect(items.map((b) => b.textContent)).toEqual([t.makes, t.recipeVault, t.addRecipe]);
    const current = within(pages).getByRole('button', { name: t.recipeVault });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(within(pages).getByRole('list', { name: t.recipeVault })).toContainElement(
      within(pages).getByRole('button', { name: t.addRecipe }),
    );
  });

  it('keeps the preferences folded until asked, above the pages', () => {
    render(<App />);
    const menu = openMenu();
    const toggle = within(menu).getByRole('button', { name: t.preferences });
    const drawer = document.getElementById(toggle.getAttribute('aria-controls') ?? '');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toHaveAttribute('inert');
    expect(
      toggle.compareDocumentPosition(within(menu).getByRole('navigation', { name: t.pages })),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    openPreferences(menu);
    expect(drawer).not.toHaveAttribute('inert');
    // Settings leads the drawer, above the toggles.
    const [first] = within(drawer!).getAllByRole('button');
    expect(first).toHaveAccessibleName(t.settings);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toHaveAttribute('inert');
  });

  it('shows Settings as the current page while on it, not in the preferences', async () => {
    render(<App />);
    let menu = openMenu();
    openPreferences(menu);
    fireEvent.click(within(menu).getByRole('button', { name: t.settings }));
    await finishMenuClosing();

    menu = openMenu();
    const pages = within(menu).getByRole('navigation', { name: t.pages });
    expect(
      within(pages)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([t.recipeVault, t.makes, t.settings]);
    expect(within(pages).getByRole('button', { name: t.settings })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(menu).getAllByRole('button', { name: t.settings })).toHaveLength(1);
  });

  it('closes on Escape and returns focus to the menu button', () => {
    render(<App />);
    openMenu();

    fireEvent.keyDown(window, { key: 'Escape' });
    finishClosing();

    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
    expect(menuButton()).toHaveFocus();
  });

  it('closes when keyboard focus leaves it for the page behind', () => {
    render(<App />);
    openMenu();
    const card = screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name });

    // Shift+Tab out of the menu onto content hidden behind the scrim.
    act(() => card.focus());
    finishClosing();

    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
    expect(card).toHaveFocus();
  });

  it('stays open when focus moves between its own controls or to the menu button', () => {
    render(<App />);
    const menu = openMenu();

    act(() => within(menu).getByRole('button', { name: t.makes }).focus());
    act(() => menuButton().focus());

    expect(screen.getByRole('dialog', { name: t.menu })).not.toHaveClass('is-closing');
  });

  it('offers Remix on a recipe page, whose back pill returns to the vault', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name }));

    const menu = openMenu();
    expect(within(menu).getByRole('button', { name: t.remixRecipe })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: t.addRecipe })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    finishClosing();

    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    const heading = t.vaultTitle;
    expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  });

  it("holds Download, Remix, Add Make and (last, on its own row) Edit in the recipe page's card", () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name }));
    expect(screen.queryByRole('button', { name: t.editRecipe })).toBeNull();

    const pages = within(openMenu()).getByRole('navigation', { name: t.pages });
    const actions = within(pages).getByRole('list', { name: t.recipeVault });
    const keys = within(actions).getAllByRole('button');
    expect(keys.map((b) => b.textContent)).toEqual([
      t.downloadRecipe,
      t.remixRecipe,
      t.addMake,
      t.editRecipe,
    ]);
    // Only Edit takes a row of its own, under the others.
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

  it('keeps the back button out while the menu is open, where it closes only the menu', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name }));
    const menu = openMenu();

    // The menu button is named Close menu too; the back button is the one without a menu of its own.
    const back = screen
      .getAllByRole('button', { name: t.closeMenu })
      .find((button) => !button.hasAttribute('aria-expanded'))!;
    expect(back).toBeDefined();
    // Focus reaching it doesn't count as leaving the menu.
    act(() => back.focus());
    expect(menu).not.toHaveClass('is-closing');

    fireEvent.click(back);
    expect(menu).toHaveClass('is-closing');
    finishClosing();
    expect(screen.queryByRole('dialog', { name: t.menu })).toBeNull();
    // Still on the recipe, whose back button now goes back to the vault.
    expect(
      screen.getByRole('heading', { name: WANDAS_CHEESE_BREAD.name, level: 1 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();
  });

  it('switches to dark mode from the sun and moon pill', () => {
    render(<App />);
    const menu = openMenu();
    openPreferences(menu);
    const dark = within(menu).getByRole('switch', { name: t.darkMode });
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
    render(<App />);
    const menu = openMenu();
    openPreferences(menu);
    const dark = within(menu).getByRole('switch', { name: t.darkMode });
    const wasDark = dark.getAttribute('aria-checked') === 'true';

    fireEvent.click(dark);
    expect(start).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.themeSwap).toBe('');
    expect(document.documentElement).toHaveAttribute('data-theme', wasDark ? 'light' : 'dark');
    Reflect.deleteProperty(document, 'startViewTransition');
    delete document.documentElement.dataset.themeSwap;
  });
});
