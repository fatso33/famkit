import { fireEvent, screen, within } from '@testing-library/react';
import { UiTranslations } from '../i18n/translations';
import { RecipeCategory } from '../types/recipe';
import { TimeKind } from '../utils/timeText';

/**
 * Driving the recipe editor as the family does: its Save key (which counts down what's still
 * needed), the sheet an edit asks what changed in, and the byline's parts with their popovers.
 */

const startsWith = (prefix: string) => (name: string) => name.startsWith(prefix);

/** The Save key, whatever it still counts ("Save" or "Save, 2 things still needed"). */
export const saveKey = (t: UiTranslations) =>
  screen.getByRole('button', {
    name: (name) => name === t.save || name.startsWith(`${t.save},`),
  });

/**
 * Saves: Save, then for an edit Save again in the sheet asking what changed (with `note` typed
 * there when given).
 */
export function saveRecipe(t: UiTranslations, note?: string) {
  fireEvent.click(saveKey(t));
  const sheet = document.querySelector<HTMLElement>('.editor-sheet.is-change-note');
  if (!sheet) return;
  if (note !== undefined) {
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: note } });
  }
  fireEvent.click(within(sheet).getByRole('button', { name: t.save }));
}

type BylinePart = 'author' | 'category' | 'times';

/** A byline part's key: whose recipe it is, its category or its times. */
export const bylinePart = (t: UiTranslations, part: BylinePart) =>
  screen.getByRole('button', {
    name: startsWith(
      part === 'author'
        ? `${t.authorLabel}:`
        : part === 'times'
          ? `${t.recipeTime}:`
          : t.categoryLabel,
    ),
  });

/** Opens a byline part's popover (leaves it open if it is). */
export function openBylinePart(t: UiTranslations, part: BylinePart) {
  const key = bylinePart(t, part);
  if (key.getAttribute('aria-expanded') !== 'true') fireEvent.click(key);
}

/** Credits someone else by name. */
export function typeAuthor(t: UiTranslations, name: string) {
  openBylinePart(t, 'author');
  const someoneElse = screen.queryByRole('radio', { name: t.authorSomeoneElse });
  if (someoneElse) fireEvent.click(someoneElse);
  fireEvent.change(screen.getByLabelText(t.authorNameLabel), { target: { value: name } });
}

export function pickCategory(t: UiTranslations, category: RecipeCategory) {
  openBylinePart(t, 'category');
  const list = screen.getByRole('listbox', { name: t.categoryLabel });
  fireEvent.click(within(list).getByRole('option', { name: t.recipeCategories[category] }));
}

/** Types a prep, cook or rest time. */
export function typeTime(t: UiTranslations, kind: TimeKind, text: string) {
  openBylinePart(t, 'times');
  fireEvent.change(screen.getByLabelText(t.timeLabels[kind]), { target: { value: text } });
}

/** Picks "Type it" on the sheet Add Recipe opens: the editor opens, empty. */
export function startTyping(t: UiTranslations) {
  const sheet = screen.getByRole('dialog', { name: t.startTitle });
  fireEvent.click(within(sheet).getByRole('button', { name: startsWith(t.startType) }));
}
