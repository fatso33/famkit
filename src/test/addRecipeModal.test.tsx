import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import {
  bylinePart,
  openBylinePart,
  saveKey,
  saveRecipe,
  typeAuthor,
  typeTime,
} from './editorHelpers';

const t = UI_TEXT.en;
const noop = vi.fn();

// The byline's category: its label, then what's picked.
const categoryField = () => bylinePart(t, 'category');

const recipe: Recipe = {
  id: 'custom-1',
  name: 'Aunt Ola Pierogi',
  author: 'Ola',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Knead gently.' }],
};

// Fills in what a new recipe needs, apart from its category.
function fillNewRecipe() {
  fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Żurek' } });
  // Nobody is signed in here, so the author is typed.
  typeAuthor(t, 'Kasia');
  fireEvent.click(screen.getByRole('button', { name: t.done }));
  fireEvent.change(screen.getByLabelText(t.ingredientNameLabel(1)), {
    target: { value: 'Sourdough starter' },
  });
  fireEvent.change(screen.getByLabelText(t.stepInstructionLabel(1)), {
    target: { value: 'Simmer.' },
  });
}

describe('AddRecipeModal initial form', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
  });

  it('populates fields from the recipe being edited', () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);

    expect(screen.getByDisplayValue('Aunt Ola Pierogi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Flour')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2 cups')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Knead gently.')).toBeInTheDocument();
  });

  it('keeps the amount of a translated ingredient, which has a name but no quantity', () => {
    const translated: Recipe = {
      ...recipe,
      ingredients: [
        { name: 'Mąka', text: 'Mąka - 2 szklanki' },
        { name: 'Sól', text: 'Szczypta soli' },
      ],
    };
    render(<AddRecipeModal initialRecipe={translated} onClose={noop} onSave={noop} t={t} />);

    expect(screen.getByDisplayValue('Mąka')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2 szklanki')).toBeInTheDocument();
    // No separator: keep the whole line rather than dropping the amount.
    expect(screen.getByDisplayValue('Szczypta soli')).toBeInTheDocument();
  });

  it('restores a saved draft in create mode', () => {
    localStorage.setItem(
      'family_kitchen_recipe_draft',
      JSON.stringify({ title: 'Draft Babka', author: 'Wanda' }),
    );
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);

    expect(screen.getByDisplayValue('Draft Babka')).toBeInTheDocument();
    expect(bylinePart(t, 'author')).toHaveAccessibleName(`${t.authorLabel}: Wanda`);
  });

  it('keeps text typed just before closing in the draft (debounce is flushed on close)', () => {
    const { unmount } = render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);

    fireEvent.change(screen.getByLabelText(t.recipeTitle), {
      target: { value: 'Quick Babka' },
    });
    unmount(); // closed well within the 400ms debounce

    expect(JSON.parse(localStorage.getItem('family_kitchen_recipe_draft')!).title).toBe(
      'Quick Babka',
    );
  });

  it('asks a new recipe for its category, and saves the one picked', () => {
    const onSave = vi.fn();
    render(<AddRecipeModal onClose={noop} onSave={onSave} t={t} />);
    fillNewRecipe();

    // Saved without one, it says what's missing, saves nothing, and opens the categories.
    expect(saveKey(t)).toHaveAccessibleName(t.saveMissing(1));
    fireEvent.click(saveKey(t));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.categoryRequired);

    const list = screen.getByRole('listbox', { name: t.categoryLabel });
    fireEvent.click(within(list).getByRole('option', { name: t.recipeCategories.soups }));
    expect(categoryField()).toHaveAccessibleName(`${t.categoryLabel} ${t.recipeCategories.soups}`);

    expect(saveKey(t)).toHaveAccessibleName(t.save);
    saveRecipe(t);
    expect(onSave.mock.calls[0][0]).toMatchObject({ category: 'soups' });
  });

  it('says which fields a new recipe still needs, and saves nothing', async () => {
    const onSave = vi.fn();
    render(<AddRecipeModal onClose={noop} onSave={onSave} t={t} />);

    // Name, author (nobody's signed in), category, an ingredient and a step.
    expect(saveKey(t)).toHaveAccessibleName(t.saveMissing(5));
    fireEvent.click(saveKey(t));

    expect(onSave).not.toHaveBeenCalled();
    const problems = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(problems).toEqual(
      expect.arrayContaining([t.titleRequired, t.ingredientsRequired, t.stepsRequired]),
    );
    expect(screen.getByLabelText(t.recipeTitle)).toHaveAttribute('aria-invalid', 'true');
    // The first thing missing, the name, takes the cursor.
    await waitFor(() => expect(screen.getByLabelText(t.recipeTitle)).toHaveFocus());
  });

  it('opens an older recipe without a category unpicked, and saves it unchanged', () => {
    const onSave = vi.fn();
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={onSave} t={t} />);
    expect(categoryField()).toHaveAccessibleName(`${t.categoryLabel} ${t.chooseCategory}`);

    saveRecipe(t);
    expect(onSave.mock.calls[0][0]).toMatchObject({ category: 'family' });
  });

  it('opens a recipe on its category', () => {
    render(
      <AddRecipeModal
        initialRecipe={{ ...recipe, category: 'mains' }}
        onClose={noop}
        onSave={noop}
        t={t}
      />,
    );
    expect(categoryField()).toHaveAccessibleName(`${t.categoryLabel} ${t.recipeCategories.mains}`);

    fireEvent.click(categoryField());
    expect(screen.getByRole('option', { name: t.recipeCategories.mains })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('asks before closing an edit with changes, and closes one without', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <AddRecipeModal initialRecipe={recipe} onClose={onClose} onSave={noop} t={t} />,
    );
    fireEvent.click(screen.getByRole('button', { name: t.closeDialog }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    render(<AddRecipeModal initialRecipe={recipe} onClose={onClose} onSave={noop} t={t} />);
    fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Pierogi' } });
    fireEvent.click(screen.getByRole('button', { name: t.closeDialog }));
    const ask = screen.getByRole('alertdialog', { name: t.discardTitle });
    fireEvent.click(within(ask).getByRole('button', { name: t.keepEditing }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Pierogi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t.closeDialog }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: t.discard }),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape like the ✕, asking first when an edit has changes', () => {
    const onClose = vi.fn();
    const { unmount } = render(<AddRecipeModal onClose={onClose} onSave={noop} t={t} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    render(<AddRecipeModal initialRecipe={recipe} onClose={onClose} onSave={noop} t={t} />);
    fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Pierogi' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('alertdialog', { name: t.discardTitle })).toBeInTheDocument();
    // Escape again closes only the question.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to the category field after a pick, while the list closes', () => {
    // A browser playing the list's exit animation, so it stays mounted for a moment.
    const exit = { animationName: 'fk-exit-popover', finished: new Promise<void>(() => {}) };
    HTMLElement.prototype.getAnimations = vi.fn(() => [exit] as unknown as Animation[]);
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);

    fireEvent.click(categoryField());
    fireEvent.click(screen.getByRole('option', { name: t.recipeCategories.soups }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(categoryField()).toHaveFocus();
  });

  it('adds pasted lines as ingredients or steps', () => {
    const onToast = vi.fn();
    render(<AddRecipeModal onClose={noop} onSave={noop} onToast={onToast} t={t} />);

    fireEvent.click(screen.getByRole('button', { name: t.paste }));
    let sheet = screen.getByRole('dialog', { name: t.pasteTitle });
    fireEvent.change(within(sheet).getByLabelText(t.pasteTextLabel), {
      target: { value: '2 cups flour\n1 tsp salt' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));
    expect(onToast).toHaveBeenLastCalledWith(t.pastedIngredients(2));
    expect(screen.getByLabelText(t.ingredientNameLabel(2))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t.paste }));
    sheet = screen.getByRole('dialog', { name: t.pasteTitle });
    fireEvent.click(within(sheet).getByRole('radio', { name: t.stepsHeading }));
    fireEvent.change(within(sheet).getByLabelText(t.pasteTextLabel), {
      target: { value: '1. Mix.\n2. Bake.' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));
    expect(onToast).toHaveBeenLastCalledWith(t.pastedSteps(2));
    expect(screen.getByLabelText(t.stepInstructionLabel(2))).toHaveValue('Bake.');
  });

  it('keeps a new recipe on this phone whatever is written first, not only a name', () => {
    const { unmount } = render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    fireEvent.change(screen.getByLabelText(t.descriptionLabel), {
      target: { value: 'Soft, with a crackly top' },
    });
    unmount();

    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    expect(screen.getByDisplayValue('Soft, with a crackly top')).toBeInTheDocument();
    expect(screen.getByText(t.draftRestored)).toBeInTheDocument();
  });

  it('asks for a name for an ingredient given only an amount, and saves nothing', () => {
    const onSave = vi.fn();
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={onSave} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: t.addIngredient }));
    fireEvent.change(screen.getByLabelText(t.ingredientAmountLabel(2)), {
      target: { value: '200 g' },
    });
    fireEvent.click(saveKey(t));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.ingredientNameRequired);
    expect(screen.getByLabelText(t.ingredientNameLabel(2))).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(t.ingredientNameLabel(1))).not.toHaveAttribute('aria-invalid');
  });

  it('starts a new recipe with no yield, rather than "For 1 loaf:"', () => {
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    expect(screen.getByLabelText(t.yieldHeader)).toHaveValue('');
  });

  it('suggests no time until there are steps, then offers their estimate as the cook time', () => {
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    expect(bylinePart(t, 'times')).toHaveAccessibleName(`${t.recipeTime}: ${t.addTimes}`);
    openBylinePart(t, 'times');
    expect(screen.getByText(t.timeFromSteps)).toBeInTheDocument();
    expect(screen.queryByText(t.estimatedTime(25))).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t.stepInstructionLabel(1)), {
      target: { value: 'Bake for 40 minutes.' },
    });
    fireEvent.click(screen.getByRole('button', { name: t.stepsSuggest(t.estimatedTime(40)) }));
    expect(screen.getByLabelText(t.timeLabels.cook)).toHaveValue(t.totalTime(40));
    expect(screen.queryByRole('button', { name: t.stepsSuggest(t.estimatedTime(40)) })).toBeNull();
  });

  it('saves typed times with the minutes they mean, in place of an older single total', () => {
    const onSave = vi.fn();
    render(
      <AddRecipeModal
        initialRecipe={{ ...recipe, manualMinutes: 90 }}
        onClose={noop}
        onSave={onSave}
        t={t}
      />,
    );
    // The byline shows the older total until a time is typed.
    expect(bylinePart(t, 'times')).toHaveAccessibleName(`${t.recipeTime}: ${t.totalTime(90)}`);
    openBylinePart(t, 'times');
    expect(screen.getByText(t.timeSetBefore(t.totalTime(90)))).toBeInTheDocument();
    typeTime(t, 'prep', '1 h 10');
    expect(screen.getAllByText(t.totalTime(70)).length).toBeGreaterThan(0);
    typeTime(t, 'rest', 'overnight');
    saveRecipe(t);

    const saved = onSave.mock.calls[0][0] as Recipe;
    expect(saved.times).toEqual({
      prep: { text: '1 h 10', minutes: 70 },
      rest: { text: 'overnight', minutes: 480 },
    });
    expect(saved.manualMinutes).toBeUndefined();
  });

  it('keeps an unsaved edit on this phone, and brings it back when the recipe is opened again', () => {
    const edited: Recipe = { ...recipe, updatedAt: 5 };
    const { unmount } = render(
      <AddRecipeModal initialRecipe={edited} onClose={noop} onSave={noop} t={t} />,
    );
    fireEvent.change(screen.getByLabelText(t.recipeTitle), {
      target: { value: 'Aunt Ola Pierogi, crispier' },
    });
    unmount(); // the app was closed mid-edit

    const onSave = vi.fn();
    render(<AddRecipeModal initialRecipe={edited} onClose={noop} onSave={onSave} t={t} />);
    expect(screen.getByDisplayValue('Aunt Ola Pierogi, crispier')).toBeInTheDocument();
    expect(screen.getByText(t.draftRestored)).toBeInTheDocument();

    // Saved, it counts as a text change (so it's translated), and the kept copy goes.
    saveRecipe(t);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Aunt Ola Pierogi, crispier' });
    expect(onSave.mock.calls[0][2]).toBe(true);
  });

  it('lets a kept edit go once the recipe has been saved since, or the edit is discarded', () => {
    const edited: Recipe = { ...recipe, updatedAt: 5 };
    const first = render(
      <AddRecipeModal initialRecipe={edited} onClose={noop} onSave={noop} t={t} />,
    );
    fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Old edit' } });
    first.unmount();

    // Saved from another phone meanwhile: the copy is out of date.
    const second = render(
      <AddRecipeModal
        initialRecipe={{ ...edited, updatedAt: 9 }}
        onClose={noop}
        onSave={noop}
        t={t}
      />,
    );
    expect(screen.getByDisplayValue('Aunt Ola Pierogi')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Newer edit' } });
    fireEvent.click(screen.getByRole('button', { name: t.closeDialog }));
    fireEvent.click(screen.getByRole('button', { name: t.discard }));
    second.unmount();

    render(
      <AddRecipeModal
        initialRecipe={{ ...edited, updatedAt: 9 }}
        onClose={noop}
        onSave={noop}
        t={t}
      />,
    );
    expect(screen.getByDisplayValue('Aunt Ola Pierogi')).toBeInTheDocument();
  });

  it('saves a recipe with many photos, since each is kept on its own', () => {
    const onSave = vi.fn();
    const photo = `data:image/jpeg;base64,${'A'.repeat(250 * 1024)}`;
    const photoFilled: Recipe = {
      ...recipe,
      heroImage: photo,
      steps: Array.from({ length: 8 }, (_, i) => ({
        num: i + 1,
        text: `Step ${i + 1}.`,
        hasImage: true,
        imageSrc: photo,
      })),
    };
    render(<AddRecipeModal initialRecipe={photoFilled} onClose={noop} onSave={onSave} t={t} />);
    saveRecipe(t);
    expect(onSave).toHaveBeenCalled();
  });

  it('says when a photo is too big for the cloud, and stays open to take it out', () => {
    const onSave = vi.fn();
    const onToast = vi.fn();
    // Past the cloud's limit for one photo (the editor's own photos are far smaller).
    const photo = `data:image/jpeg;base64,${'A'.repeat(1300 * 1024)}`;
    const heavy: Recipe = {
      ...recipe,
      heroImage: photo,
      steps: [{ num: 1, text: 'Step 1.', hasImage: true, imageSrc: photo }],
    };
    render(
      <AddRecipeModal
        initialRecipe={heavy}
        onClose={noop}
        onSave={onSave}
        onToast={onToast}
        t={t}
      />,
    );
    saveRecipe(t);
    expect(onSave).not.toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith(t.recipeTooBig, undefined, 'error');
    expect(document.querySelector('.editor-layer.is-closing')).toBeNull();
  });

  it('puts the app behind it out of reach while open, but not the toast after it', () => {
    const { rerender } = render(
      <div>
        <main>
          <button type="button">Behind</button>
        </main>
        <AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />
        <button type="button">Undo</button>
      </div>,
    );
    expect(screen.getByText('Behind').closest('[inert]')).not.toBeNull();
    expect(screen.getByText('Undo').closest('[inert]')).toBeNull();

    rerender(
      <div>
        <main>
          <button type="button">Behind</button>
        </main>
        <button type="button">Undo</button>
      </div>,
    );
    expect(screen.getByText('Behind').closest('[inert]')).toBeNull();
  });

  it('keeps focus in the preview, and gives it back to Preview when it closes', () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />);
    const previewKey = screen.getByRole('button', { name: t.preview });
    previewKey.focus();
    fireEvent.click(previewKey);

    // Everything under it is out of reach, so Tab can't land on the editor behind.
    expect(document.getElementById('recipeTitleInput')!.closest('[inert]')).not.toBeNull();
    expect(document.querySelector('.editor-save')!.closest('[inert]')).not.toBeNull();
    expect(document.activeElement).toHaveAccessibleName(t.backToEditing);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.editor-preview')).toBeNull();
    expect(document.getElementById('recipeTitleInput')!.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(previewKey);
  });

  it('ignores drafts when editing and starts empty when creating without one', () => {
    localStorage.setItem('family_kitchen_recipe_draft', JSON.stringify({ title: 'Draft Babka' }));
    const { unmount } = render(
      <AddRecipeModal initialRecipe={recipe} onClose={noop} onSave={noop} t={t} />,
    );
    expect(screen.queryByDisplayValue('Draft Babka')).not.toBeInTheDocument();
    unmount();

    localStorage.clear();
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    expect(screen.queryByDisplayValue('Aunt Ola Pierogi')).not.toBeInTheDocument();
  });
});
