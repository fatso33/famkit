import { act, fireEvent, screen, within } from '@testing-library/react';
import { UI_TEXT, UiTranslations } from '../i18n/translations';

/**
 * Opens the navigation island's actions panel and picks `name` (one of the current page's
 * actions such as "Edit Recipe", or Settings). jsdom runs no CSS animations, so the panel's exit
 * is finished by hand.
 */
export function chooseFromMenu(name: string | RegExp, t: UiTranslations = UI_TEXT.en) {
  fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
  const menu = screen.getByRole('dialog', { name: t.menu });
  fireEvent.click(within(menu).getByRole('button', { name }));
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
}

/**
 * Goes to a page: a main page by its tab on the navigation island, Settings from the actions
 * panel. The panel closes once the page change has started (a microtask later where nothing
 * animates), so this waits for that before finishing its exit.
 */
export async function goFromMenu(name: string | RegExp, t: UiTranslations = UI_TEXT.en) {
  const tabs = screen.getByRole('navigation', { name: t.pages });
  const tab = within(tabs).queryByRole('button', { name });
  if (tab) {
    fireEvent.click(tab);
    await act(async () => {});
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
  const menu = screen.getByRole('dialog', { name: t.menu });
  fireEvent.click(within(menu).getByRole('button', { name }));
  await finishMenuClosing();
}

/** Lets a panel that closes after a page change start closing, then finishes its exit. */
export async function finishMenuClosing() {
  await act(async () => {});
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
}
