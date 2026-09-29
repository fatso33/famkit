import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { CurrentUserContext } from '../hooks/useCurrentUser';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

// The drafts never come back: a slow connection just after launch, or a failing listener.
const saveDraftToCloud = vi.fn(() => Promise.resolve());
vi.mock('../services/drafts', () => ({
  subscribeToDrafts: () => () => undefined,
  saveDraftToCloud: (...args: unknown[]) => saveDraftToCloud(...(args as [])),
  deleteDraftFromCloud: () => Promise.resolve(),
}));

const t = UI_TEXT.en;
const ola = { email: 'ola@example.com', name: 'Ola Nowak' };

const babka: Recipe = {
  id: 'babka',
  name: 'Babka',
  author: 'Ola Nowak',
  authorMode: 'auto',
  ownerEmail: ola.email,
  category: 'cakes',
  heroImage: '',
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g', name: 'Flour', note: '' }],
  steps: [{ num: 1, text: 'Knead.' }],
  version: 1,
  createdAt: 1000,
};

const editor = () => screen.queryByRole('dialog', { name: new RegExp(t.editorTitleEdit, 'i') });

describe('editing before the drafts have loaded', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("offers no draft, which could replace one it hasn't seen (regression)", () => {
    render(
      <CurrentUserContext value={ola}>
        <App />
      </CurrentUserContext>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    const menu = screen.getByRole('dialog', { name: t.menu });
    fireEvent.click(within(menu).getByRole('button', { name: t.editRecipe }));
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Babka Wielkanocna' },
    });

    // Closing asks before the changes go, with no draft to keep them in.
    fireEvent.click(within(editor()!).getByRole('button', { name: t.closeDialog }));
    const sheet = screen.getByRole('alertdialog', { name: t.discardTitle });
    expect(within(sheet).queryByRole('button', { name: t.saveDraft(2) })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: t.keepEditing }));

    // Save goes straight to the vault.
    fireEvent.click(within(editor()!).getByRole('button', { name: t.save }));
    expect(screen.queryByRole('dialog', { name: t.saveChoices })).toBeNull();
    expect(saveDraftToCloud).not.toHaveBeenCalled();
  });
});
