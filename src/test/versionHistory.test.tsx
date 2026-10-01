import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { chooseFromMenu } from './menu';
import { Recipe } from '../types/recipe';

// Firebase is off in tests, so versions go through the on-device store: only Gemini is mocked.
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
  heroImage: 'data:image/jpeg;base64,HERO',
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g' }],
  steps: [{ num: 1, text: 'Bake.' }],
  version: 1,
  createdAt: 1000,
  updatedAt: 1000,
};

const stored = () => (JSON.parse(localStorage.getItem('wandas_recipes')!) as Recipe[])[0];

function openEditor() {
  chooseFromMenu(UI_TEXT.en.editRecipe);
  return screen.getByRole('dialog', { name: /edit recipe/i });
}

// The version under the editor's title, which drops down the list of versions.
const VERSION_BUTTON = /^Version \d+$/;
function openVersions(editor: HTMLElement) {
  fireEvent.click(within(editor).getByRole('button', { name: VERSION_BUTTON }));
}

function renameTo(name: string, note: string) {
  const editor = openEditor();
  fireEvent.change(within(editor).getByLabelText(t.recipeTitle), { target: { value: name } });
  fireEvent.change(within(editor).getByLabelText(/^What changed since v/), {
    target: { value: note },
  });
  fireEvent.click(within(editor).getByRole('button', { name: t.save }));
}

describe('version history', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    render(<App initialPage="recipes" />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
  });

  it('keeps each edit as a version, with its note, and never shows numbers on the recipe', () => {
    renameTo('Babka Wielkanocna', 'Easter name');

    expect(stored()).toMatchObject({ name: 'Babka Wielkanocna', version: 2 });
    expect(stored().changeNote).toBe('Easter name');
    expect(stored().versionIndex).toHaveLength(1);
    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument();
  });

  it('restores an earlier version with its changes highlighted, as a new version', async () => {
    renameTo('Babka Wielkanocna', 'Easter name');

    const editor = openEditor();
    openVersions(editor);
    const sheet = screen.getByRole('dialog', { name: t.versionHistory });
    expect(within(sheet).getByText(t.currentVersion)).toBeInTheDocument();
    expect(within(sheet).getByText('Easter name')).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole('button', { name: /version 1/i }));

    const banner = (await screen.findByText(/^Version 1 from/)).closest('[role="status"]');
    expect(banner).toHaveClass('restore-banner');
    expect(banner).toHaveTextContent(t.changesCount(1));
    const restoredEditor = screen.getByRole('dialog', { name: /edit recipe/i });
    expect(within(restoredEditor).getByLabelText(t.recipeTitle)).toHaveValue('Babka');
    expect(within(restoredEditor).getAllByText(t.restoredChip)).toHaveLength(1);
    expect(within(restoredEditor).getByLabelText(/^What changed since v/)).toHaveValue(
      t.restoredNote(1),
    );

    fireEvent.click(within(restoredEditor).getByRole('button', { name: t.save }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Babka');
    expect(stored()).toMatchObject({ name: 'Babka', version: 3, changeNote: t.restoredNote(1) });
    // Nothing was lost: the renamed version is kept too.
    expect(stored().versionIndex?.map((v) => v.version)).toEqual([2, 1]);
  });

  it('goes back to the current version with "Keep current"', async () => {
    renameTo('Babka Wielkanocna', '');
    const editor = openEditor();
    openVersions(editor);
    fireEvent.click(screen.getByRole('button', { name: /version 1/i }));
    fireEvent.click(await screen.findByRole('button', { name: t.keepCurrent }));

    expect(screen.queryByText(/^Version 1 from/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Babka Wielkanocna');
  });

  it('closes the version list when the version already shown is picked again', async () => {
    renameTo('Babka Wielkanocna', '');
    const editor = openEditor();
    openVersions(editor);
    fireEvent.click(screen.getByRole('button', { name: /version 1/i }));
    await screen.findByText(/^Version 1 from/);

    openVersions(screen.getByRole('dialog', { name: /edit recipe/i }));
    fireEvent.click(screen.getByRole('button', { name: /version 1/i }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: t.versionHistory })).not.toBeInTheDocument(),
    );
  });

  it('closes only the version list on Escape, leaving the editor open', () => {
    renameTo('Babka Wielkanocna', '');
    const editor = openEditor();
    openVersions(editor);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: t.versionHistory })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /edit recipe/i })).toBeInTheDocument();
  });

  it('offers no history for a recipe that was never edited', () => {
    const editor = openEditor();
    expect(within(editor).getByText(t.versionLabel(1))).toBeInTheDocument();
    expect(within(editor).queryByRole('button', { name: VERSION_BUTTON })).not.toBeInTheDocument();
  });
});
