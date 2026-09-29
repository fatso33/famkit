import { fireEvent, screen, within } from '@testing-library/react';
import { UI_TEXT, UiTranslations } from '../i18n/translations';

/**
 * Opens the floating menu and picks `name` (a page, or one of the current page's actions such
 * as "Edit Recipe"). jsdom runs no CSS animations, so the menu's exit is finished by hand.
 */
export function chooseFromMenu(name: string | RegExp, t: UiTranslations = UI_TEXT.en) {
  fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
  const menu = screen.getByRole('dialog', { name: t.menu });
  fireEvent.click(within(menu).getByRole('button', { name }));
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
}
