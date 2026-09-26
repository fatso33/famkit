import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../App';
import { DEFAULT_RECIPE } from '../data/defaultRecipe';
import { UI_TEXT } from '../i18n/translations';

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

/** jsdom runs no CSS animations, so finish the exit animation by hand. */
const finishClosing = () => {
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
};

describe('floating menu', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([DEFAULT_RECIPE]));
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

    expect(screen.getByRole('dialog', { name: new RegExp(t.addRecipe) })).toBeInTheDocument();
  });

  it('switches to the Makes page and swaps the page action', () => {
    render(<App />);
    fireEvent.click(within(openMenu()).getByRole('button', { name: t.makes }));
    finishClosing();

    expect(screen.getByRole('heading', { name: t.makes, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(t.makesEmptyTitle)).toBeInTheDocument();

    const menu = openMenu();
    expect(within(menu).getByRole('button', { name: t.addMake })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: t.addRecipe })).toBeNull();

    fireEvent.click(within(menu).getByRole('button', { name: t.addMake }));
    // Announced through the always-present live region, not a node that appears with its text.
    expect(screen.getByRole('status')).toHaveTextContent(t.comingSoonToast);
  });

  it('switches language without a toast, since the whole page changes', () => {
    render(<App />);
    fireEvent.click(within(openMenu()).getByRole('button', { name: t.languageToggle }));

    expect(screen.getByRole('heading', { name: UI_TEXT.pl.vaultTitle, level: 1 })).toBeVisible();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('opens the Settings page, which explains translation and asks for no API key', () => {
    render(<App />);
    fireEvent.click(within(openMenu()).getByRole('button', { name: t.settings }));
    finishClosing();

    expect(screen.getByRole('heading', { name: t.settings, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(t.translationInfo)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
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
    const card = screen.getByRole('button', { name: DEFAULT_RECIPE.name });

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

  it('offers Share on a recipe page, whose back pill returns to the vault', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: DEFAULT_RECIPE.name }));

    const menu = openMenu();
    expect(within(menu).getByRole('button', { name: t.shareRecipe })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: t.addRecipe })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    finishClosing();

    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();
  });
});
