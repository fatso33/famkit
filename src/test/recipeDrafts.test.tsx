import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import App from '../App';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { CurrentUserContext } from '../hooks/useCurrentUser';
import { UI_TEXT } from '../i18n/translations';
import { Recipe, RecipeDraft } from '../types/recipe';
import {
  draftFor,
  draftVersion,
  editDraftId,
  newRecipeDrafts,
  parseDraft,
} from '../utils/recipeDrafts';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;
const ola = { email: 'ola@example.com', name: 'Ola Nowak' };

const babka: Recipe = {
  id: 'babka',
  name: 'Babka',
  author: 'Ola Nowak',
  authorMode: 'auto',
  ownerEmail: ola.email,
  ownerName: ola.name,
  category: 'cakes',
  heroImage: '',
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g', name: 'Flour', note: '' }],
  steps: [{ num: 1, text: 'Knead.' }],
  version: 1,
  createdAt: 1000,
};

const storedDrafts = (): unknown[] =>
  (JSON.parse(localStorage.getItem('family_kitchen_drafts') || '{}') as Record<string, unknown[]>)[
    ola.email
  ] ?? [];
const storedRecipe = () =>
  (JSON.parse(localStorage.getItem('wandas_recipes') || '[]') as Recipe[]).find(
    (r) => r.id === 'babka',
  );

const heading = () => screen.getByRole('heading', { level: 1 });
const editor = () =>
  screen.queryByRole('dialog', {
    name: new RegExp(`${t.editorTitleEdit}|${t.editorTitleNew}`, 'i'),
  });
const depth = () => (window.history.state as { famkitDepth?: number } | null)?.famkitDepth ?? 0;

async function swipeBack() {
  const popped = new Promise((resolve) =>
    window.addEventListener('popstate', resolve, { once: true }),
  );
  await act(async () => {
    window.history.back();
    await popped;
  });
  // Lets the app line history up again (a sheet opening takes a step of its own).
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
}

/** Settles history changes the app makes on its own (the menu's entry giving way). */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

function openMenuItem(name: string) {
  fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
  const menu = screen.getByRole('dialog', { name: t.menu });
  fireEvent.click(within(menu).getByRole('button', { name }));
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
}

const renderApp = () =>
  render(
    <CurrentUserContext value={ola}>
      <App />
    </CurrentUserContext>,
  );

function chooseSave(name: RegExp) {
  fireEvent.click(within(editor()!).getByRole('button', { name: t.save }));
  const choices = screen.getByRole('dialog', { name: t.saveChoices });
  fireEvent.click(within(choices).getByRole('button', { name }));
}

describe('draft helpers', () => {
  const draft = (extra: Partial<RecipeDraft>): RecipeDraft => ({
    id: 'd',
    recipe: { ...babka, id: 'd' },
    language: 'en',
    savedAt: 0,
    ...extra,
  });

  it("numbers a draft by the version it becomes, and finds a recipe's own", () => {
    expect(draftVersion(null)).toBe(1);
    expect(draftVersion({ version: 3 })).toBe(4);
    expect(draftVersion({})).toBe(2);
    const edit = draft({ id: editDraftId('babka'), recipeId: 'babka' });
    const older = draft({ id: 'a', savedAt: 1 });
    const newer = draft({ id: 'b', savedAt: 2 });
    expect(draftFor([older, edit], 'babka')).toBe(edit);
    expect(draftFor([older], 'babka')).toBeNull();
    expect(newRecipeDrafts([older, edit, newer]).map((d) => d.id)).toEqual(['b', 'a']);
  });

  it('reads a stored draft field by field, and refuses what is not one', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft({ id: 'x' })).toBeNull();
    const parsed = parseDraft({
      id: 'x',
      recipeId: 'babka',
      baseVersion: 2,
      language: 'fr',
      savedAt: 'soon',
      recipe: { name: 7, steps: [{ num: 1, text: 'Mix.' }, 'junk'], category: '' },
    });
    expect(parsed).toMatchObject({
      id: 'x',
      recipeId: 'babka',
      baseVersion: 2,
      language: 'en',
      savedAt: 0,
      recipe: { id: 'babka', name: '', category: '', ingredients: [], steps: [{ text: 'Mix.' }] },
    });
  });
});

describe('saving drafts', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    await waitFor(() => expect(depth()).toBe(0));
  });

  it("keeps an edit as a draft the family doesn't see, then saves it to the vault", async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    openMenuItem(t.editRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Babka Wielkanocna' },
    });

    // Closing with changes offers to keep them.
    fireEvent.click(within(editor()!).getByRole('button', { name: t.closeDialog }));
    const leave = screen.getByRole('alertdialog', { name: t.leaveTitle });
    fireEvent.click(within(leave).getByRole('button', { name: t.saveDraft(2) }));
    await waitFor(() => expect(editor()).toBeNull());

    // The recipe is as it was; the draft waits on its page.
    expect(heading()).toHaveTextContent('Babka');
    expect(storedRecipe()?.name).toBe('Babka');
    expect(storedDrafts()).toHaveLength(1);
    const chip = screen.getByRole('button', { name: /Draft v2.*Continue/ });

    // Carrying on opens the draft, and saving it to the vault makes version 2.
    fireEvent.click(chip);
    expect(within(editor()!).getByLabelText(t.recipeTitle)).toHaveValue('Babka Wielkanocna');
    expect(within(editor()!).getByText(t.draftLabel(2))).toBeInTheDocument();
    chooseSave(/^Save to Vault/);
    await waitFor(() => expect(editor()).toBeNull());

    expect(heading()).toHaveTextContent('Babka Wielkanocna');
    expect(storedRecipe()).toMatchObject({ name: 'Babka Wielkanocna', version: 2 });
    expect(storedDrafts()).toEqual([]);
    expect(screen.queryByRole('button', { name: /Draft v2/ })).toBeNull();
  });

  it('opens Edit on the draft when there is one', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    openMenuItem(t.editRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Babka Drożdżowa' },
    });
    chooseSave(/^Save draft v2/);
    await waitFor(() => expect(editor()).toBeNull());

    openMenuItem(t.editRecipe);
    expect(within(editor()!).getByLabelText(t.recipeTitle)).toHaveValue('Babka Drożdżowa');
  });

  it('keeps an unfinished new recipe as a draft in the vault, until discarded', async () => {
    renderApp();
    openMenuItem(t.addRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Pierniczki' },
    });
    // Unfinished (no category, ingredients or steps), but a draft needs none of them.
    chooseSave(/^Save draft v1/);
    await waitFor(() => expect(editor()).toBeNull());
    // Saved for real, so the copy kept on this phone goes.
    expect(localStorage.getItem('family_kitchen_recipe_draft')).toBeNull();

    expect(screen.getByRole('heading', { name: t.yourDrafts })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.draftNamed('Pierniczki') }));
    expect(within(editor()!).getByLabelText(t.recipeTitle)).toHaveValue('Pierniczki');

    fireEvent.click(within(editor()!).getByRole('button', { name: t.discardDraft }));
    const sheet = screen.getByRole('alertdialog', { name: t.discardDraft });
    fireEvent.click(within(sheet).getByRole('button', { name: t.discardDraft }));
    await waitFor(() => expect(editor()).toBeNull());
    expect(screen.queryByRole('heading', { name: t.yourDrafts })).toBeNull();
    expect(storedDrafts()).toEqual([]);
  });

  it('still checks what the vault needs when saving to it', () => {
    renderApp();
    openMenuItem(t.addRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Pierniczki' },
    });
    chooseSave(/^Save to Vault/);
    expect(editor()).toBeInTheDocument();
    const alerts = within(editor()!).getAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toContain(t.categoryRequired);
    expect(screen.queryByRole('dialog', { name: t.saveChoices })).toBeNull();
  });
});

describe('the back gesture in the editor', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    await waitFor(() => expect(depth()).toBe(0));
  });

  it('closes an editor with nothing changed, like the ✕', async () => {
    renderApp();
    openMenuItem(t.addRecipe);
    await settle();
    await waitFor(() => expect(depth()).toBe(1));
    await swipeBack();
    expect(editor()).toBeNull();
    await waitFor(() => expect(depth()).toBe(0));
  });

  it('asks before closing with changes; back again keeps editing', async () => {
    renderApp();
    openMenuItem(t.addRecipe);
    await settle();
    await waitFor(() => expect(depth()).toBe(1));
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Pierniczki' },
    });

    await swipeBack();
    expect(screen.getByRole('alertdialog', { name: t.leaveTitle })).toBeInTheDocument();
    expect(editor()).toBeInTheDocument();

    await swipeBack();
    expect(screen.queryByRole('alertdialog', { name: t.leaveTitle })).toBeNull();
    expect(within(editor()!).getByLabelText(t.recipeTitle)).toHaveValue('Pierniczki');
    await waitFor(() => expect(depth()).toBe(1));

    // Letting the changes go closes it, and the next back leaves as usual.
    await swipeBack();
    const leave = screen.getByRole('alertdialog', { name: t.leaveTitle });
    fireEvent.click(within(leave).getByRole('button', { name: t.discard }));
    await waitFor(() => expect(editor()).toBeNull());
    await waitFor(() => expect(depth()).toBe(0));
    expect(localStorage.getItem('family_kitchen_recipe_draft')).toBeNull();
  });
});

describe("a fork path's photo", () => {
  it('comes back to its own path with Undo, even after another path went (regression)', () => {
    const forked: Recipe = {
      ...babka,
      steps: [
        {
          num: 1,
          text: 'Bake.',
          fork: {
            paths: [
              { label: 'Oven', text: 'Bake.' },
              { label: 'Pan', text: 'Fry.' },
              {
                label: 'Pot',
                text: 'Boil.',
                hasImage: true,
                imageSrc: 'data:image/jpeg;base64,POT',
              },
            ],
          },
        },
      ],
    };
    const onToast = vi.fn();
    render(
      <AddRecipeModal
        initialRecipe={forked}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToast={onToast}
        t={t}
      />,
    );
    const path = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));
    const photo = () => screen.queryByAltText(t.photoPreviewAlt);

    fireEvent.pointerUp(screen.getByRole('radio', { name: 'Pot' }));
    path('Pot');
    expect(photo()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.photo }));
    expect(photo()).toBeNull();
    const undo = onToast.mock.lastCall![1] as { onAction: () => void };

    // The pan path goes, so the pot path moves up one place.
    path('Pan');
    fireEvent.click(screen.getByRole('button', { name: t.removePath }));
    act(() => undo.onAction());

    path('Pot');
    expect(photo()).toBeInTheDocument();
    path('Oven');
    expect(photo()).toBeNull();
  });
});

describe('opening a step', () => {
  it('opens its tools on a finished tap or focus, never on a touch that may be a scroll', () => {
    render(<AddRecipeModal initialRecipe={babka} onClose={vi.fn()} onSave={vi.fn()} t={t} />);
    const field = screen.getByLabelText(t.stepInstructionLabel(1));
    const tools = () => screen.queryByRole('group', { name: t.stepTools(1) });

    fireEvent.pointerDown(field);
    expect(tools()).toBeNull();
    // The touch became a scroll: the browser cancels it, and nothing opens.
    fireEvent.pointerCancel(field);
    expect(tools()).toBeNull();

    fireEvent.pointerDown(field);
    fireEvent.pointerUp(field);
    expect(tools()).toBeInTheDocument();
  });
});
