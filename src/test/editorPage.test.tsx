import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { CurrentUser, CurrentUserContext } from '../hooks/useCurrentUser';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { bylinePart, saveKey } from './editorHelpers';

const t = UI_TEXT.en;
const ola: CurrentUser = { email: 'ola@example.com', name: 'Ola Nowak' };

const recipe: Recipe = {
  id: 'r1',
  name: 'Babka',
  author: 'Ola',
  category: 'cakes',
  heroImage: '',
  yieldHeader: '',
  ingredients: [{ text: 'Flour - 500 g' }],
  steps: [{ num: 1, text: 'Knead.' }],
  version: 4,
};

const renderEditor = (props: Partial<React.ComponentProps<typeof AddRecipeModal>> = {}) => {
  const onSave = vi.fn();
  render(
    <CurrentUserContext value={ola}>
      <AddRecipeModal onClose={vi.fn()} onSave={onSave} t={t} {...props} />
    </CurrentUserContext>,
  );
  return onSave;
};

describe('the editor laid out as the recipe page', () => {
  beforeEach(() => localStorage.clear());

  it('offers the note, tip and source as keys until they are added', async () => {
    renderEditor();
    expect(screen.queryByLabelText(t.crucialNote)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.addCrucialNote }));
    const note = screen.getByLabelText(t.crucialNote);
    await waitFor(() => expect(note).toHaveFocus());

    // Left empty, it goes back to being a key.
    fireEvent.blur(note);
    expect(screen.queryByLabelText(t.crucialNote)).toBeNull();
    expect(screen.getByRole('button', { name: t.addCrucialNote })).toBeInTheDocument();

    // Written in, it stays.
    fireEvent.click(screen.getByRole('button', { name: t.addKitchenTip }));
    fireEvent.change(screen.getByLabelText(t.kitchenTip), { target: { value: 'Warm milk.' } });
    fireEvent.blur(screen.getByLabelText(t.kitchenTip));
    expect(screen.getByLabelText(t.kitchenTip)).toHaveValue('Warm milk.');
    expect(screen.getByRole('button', { name: t.sourceLabel })).toBeInTheDocument();
  });

  it('opens a recipe with its note, tip and source already shown', () => {
    renderEditor({
      initialRecipe: { ...recipe, notes: 'No air fryer.', tips: 'Warm milk.', sourceText: 'Book' },
    });
    expect(screen.getByLabelText(t.crucialNote)).toHaveValue('No air fryer.');
    expect(screen.getByLabelText(t.kitchenTip)).toHaveValue('Warm milk.');
    expect(screen.getByLabelText(t.sourceLabel)).toHaveValue('Book');
    expect(screen.queryByRole('button', { name: t.addCrucialNote })).toBeNull();
  });

  it('asks what changed as an edit saves, and Keep editing saves nothing', () => {
    const onSave = renderEditor({ initialRecipe: recipe });
    expect(screen.queryByLabelText(t.changeNoteLabel(4))).toBeNull();

    fireEvent.click(saveKey(t));
    let sheet = screen.getByRole('dialog', { name: t.savingVersion(5) });
    expect(within(sheet).getByLabelText(t.changeNoteLabel(4))).toHaveFocus();
    fireEvent.click(within(sheet).getByRole('button', { name: t.keepEditing }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(saveKey(t));
    sheet = screen.getByRole('dialog', { name: t.savingVersion(5) });
    const note = within(sheet).getByLabelText(t.changeNoteLabel(4));
    fireEvent.change(note, { target: { value: 'More butter' } });
    // Enter saves, like the key.
    fireEvent.keyDown(note, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][3]).toBe('More butter');
  });

  it('saves a new recipe at once, with no sheet', () => {
    const onSave = renderEditor({ initialRecipe: undefined });
    fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Babka' } });
    fireEvent.click(bylinePart(t, 'category'));
    fireEvent.click(screen.getByRole('option', { name: t.recipeCategories.cakes }));
    fireEvent.change(screen.getByLabelText(t.ingredientNameLabel(1)), {
      target: { value: 'Flour' },
    });
    fireEvent.change(screen.getByLabelText(t.stepInstructionLabel(1)), {
      target: { value: 'Bake.' },
    });
    expect(saveKey(t)).toHaveAccessibleName(t.save);
    fireEvent.click(saveKey(t));
    expect(screen.queryByRole('dialog', { name: /Saving version/ })).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('lifts the author when a typed name is what Save still needs', async () => {
    renderEditor({ initialRecipe: { ...recipe, author: '', authorMode: 'custom' } });
    expect(saveKey(t)).toHaveAccessibleName(t.saveMissing(1));
    fireEvent.click(saveKey(t));
    const popover = screen.getByRole('dialog', { name: t.authorLabel });
    await waitFor(() => expect(within(popover).getByLabelText(t.authorNameLabel)).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent(t.authorRequired);

    fireEvent.change(within(popover).getByLabelText(t.authorNameLabel), {
      target: { value: 'Babcia Zosia' },
    });
    expect(saveKey(t)).toHaveAccessibleName(t.save);
    fireEvent.click(within(popover).getByRole('button', { name: t.done }));
    expect(bylinePart(t, 'author')).toHaveAccessibleName(`${t.authorLabel}: Babcia Zosia`);
    expect(bylinePart(t, 'author')).toHaveFocus();
  });

  it('opens the times card without the cursor in a field, so no keyboard covers it', async () => {
    renderEditor({ initialRecipe: recipe });
    fireEvent.click(bylinePart(t, 'times'));
    const card = screen.getByRole('dialog', { name: t.recipeTime });
    await waitFor(() => expect(card).toHaveFocus());
    expect(within(card).getByLabelText(t.timeLabels.prep)).not.toHaveFocus();

    // A tapped author part opens the same way.
    fireEvent.click(within(card).getByRole('button', { name: t.done }));
    fireEvent.click(bylinePart(t, 'author'));
    await waitFor(() => expect(screen.getByRole('dialog', { name: t.authorLabel })).toHaveFocus());
  });

  it('keeps the name on one line', () => {
    renderEditor();
    const name = screen.getByLabelText(t.recipeTitle);
    fireEvent.change(name, { target: { value: 'Babka\nWielkanocna' } });
    expect(name).toHaveValue('Babka Wielkanocna');
  });

  it('offers Start over after the restored-work line, not in the row of keys', () => {
    localStorage.setItem('family_kitchen_recipe_draft', JSON.stringify({ title: 'Draft Babka' }));
    renderEditor();
    const line = screen.getByText(t.draftRestored).closest('.editor-bar-line') as HTMLElement;
    fireEvent.click(within(line).getByRole('button', { name: t.startOver }));
    expect(screen.getByRole('alertdialog', { name: t.startOver })).toBeInTheDocument();
  });
});
