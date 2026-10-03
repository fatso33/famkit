import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { CurrentUser, CurrentUserContext } from '../hooks/useCurrentUser';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { bylinePart, openBylinePart, pickCategory, saveRecipe } from './editorHelpers';

const t = UI_TEXT.en;
const ola: CurrentUser = { email: 'ola@example.com', name: 'Ola Nowak' };

const legacyRecipe: Recipe = {
  id: 'custom-1',
  name: 'Pierogi',
  author: 'Babcia Zosia',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Knead gently.' }],
};

function renderForm(user: CurrentUser | null, initialRecipe?: Recipe) {
  const onSave = vi.fn();
  render(
    <CurrentUserContext value={user}>
      <AddRecipeModal initialRecipe={initialRecipe} onClose={vi.fn()} onSave={onSave} t={t} />
    </CurrentUserContext>,
  );
  return onSave;
}

function fillAndSave() {
  fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'Babka' } });
  fireEvent.change(screen.getByLabelText(t.ingredientNameLabel(1)), {
    target: { value: 'Flour' },
  });
  fireEvent.change(screen.getByLabelText(t.stepInstructionLabel(1)), {
    target: { value: 'Bake.' },
  });
  pickCategory(t, 'cakes');
  saveRecipe(t);
}

describe('recipe author choice', () => {
  beforeEach(() => localStorage.clear());

  it('credits the signed-in family member by default', () => {
    const onSave = renderForm(ola);

    // The byline credits them; its popover has the choice. Shown by first name and initial.
    expect(bylinePart(t, 'author')).toHaveAccessibleName(`${t.authorLabel}: Ola N.`);
    openBylinePart(t, 'author');
    expect(screen.getByRole('radio', { name: 'Ola N.' })).toBeChecked();
    expect(screen.getByText(t.authorShownAs('Ola N.'))).toBeInTheDocument();
    expect(screen.queryByLabelText(t.authorNameLabel)).not.toBeInTheDocument();

    fillAndSave();
    expect(onSave.mock.calls[0][0]).toMatchObject({ author: 'Ola Nowak', authorMode: 'auto' });
  });

  it('shows a name from the family list as written, not shortened', () => {
    renderForm({ email: 'zosia@example.com', name: 'Ciocia Zosia', nameAsTyped: true });

    openBylinePart(t, 'author');
    expect(screen.getByRole('radio', { name: 'Ciocia Zosia' })).toBeChecked();
    expect(screen.getByText(t.authorShownAs('Ciocia Zosia'))).toBeInTheDocument();
  });

  it("takes a typed name for someone else's recipe", () => {
    const onSave = renderForm(ola);

    openBylinePart(t, 'author');
    fireEvent.click(screen.getByRole('radio', { name: t.authorSomeoneElse }));
    fireEvent.change(screen.getByLabelText(t.authorNameLabel), {
      target: { value: '  Babcia Zosia ' },
    });
    fillAndSave();

    expect(onSave.mock.calls[0][0]).toMatchObject({
      author: 'Babcia Zosia',
      authorMode: 'custom',
    });
  });

  it('opens an older recipe with its typed author on "Someone else"', () => {
    renderForm(ola, legacyRecipe);

    expect(bylinePart(t, 'author')).toHaveAccessibleName(`${t.authorLabel}: Babcia Zosia`);
    openBylinePart(t, 'author');
    expect(screen.getByRole('radio', { name: t.authorSomeoneElse })).toBeChecked();
    expect(screen.getByLabelText(t.authorNameLabel)).toHaveValue('Babcia Zosia');
  });

  it('asks for a name when nobody is signed in to credit', () => {
    renderForm(null);

    // Nobody to credit yet: the byline asks whose it is.
    expect(bylinePart(t, 'author')).toHaveAccessibleName(`${t.authorLabel}: ${t.whoseRecipe}`);
    openBylinePart(t, 'author');
    expect(screen.queryByRole('radio', { name: t.authorSomeoneElse })).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.authorNameLabel)).toBeRequired();
  });
});
