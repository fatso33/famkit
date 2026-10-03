import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { StartSheet } from '../components/recipe-form/StartSheet';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { UI_TEXT } from '../i18n/translations';
import { ImportError, fetchRecipePage, fetchRecipePhoto } from '../services/recipeImport';
import { recipeFromPage, readImportedPage } from '../utils/recipeImport';

// Only the fetching is mocked: the page that comes back is read by the real code.
vi.mock('../services/recipeImport', async (original) => ({
  ...(await original<typeof import('../services/recipeImport')>()),
  isRecipeImportAvailable: true,
  fetchRecipePage: vi.fn(),
  fetchRecipePhoto: vi.fn(),
}));

const t = UI_TEXT.en;
const noop = vi.fn();
const PHOTO = 'data:image/jpeg;base64,AAAA';

const page = {
  url: 'https://www.example.com/pierogi',
  lang: 'en',
  jsonLd: [
    JSON.stringify({
      '@type': 'Recipe',
      name: 'Pierogi Ruskie',
      image: 'https://www.example.com/pierogi.jpg',
      recipeIngredient: ['500 g flour', '1 kg potatoes'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Make the dough.' },
        { '@type': 'HowToStep', text: 'Fill and boil.' },
      ],
    }),
  ],
  meta: { image: '', siteName: 'Example' },
};

// Named for its stage ("A new recipe", "Paste text"…): the only dialog there is.
const sheet = () => screen.getByRole('dialog');
const choice = (name: string) =>
  within(sheet()).getByRole('button', { name: (n) => n.startsWith(name) });

const renderSheet = (canImport = true) => {
  const handlers = { onType: vi.fn(), onPasted: vi.fn(), onImported: vi.fn(), onClose: vi.fn() };
  render(<StartSheet canImport={canImport} {...handlers} t={t} />);
  return handlers;
};

describe('the start sheet', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    vi.mocked(fetchRecipePage).mockReset();
    vi.mocked(fetchRecipePhoto).mockReset();
  });

  it('offers to type it, paste it, or read it off a website, and starts on the first', () => {
    renderSheet();
    expect(
      within(sheet())
        .getAllByRole('button')
        .map((b) => b.querySelector('.start-choice-name')?.textContent),
    ).toEqual([t.startType, t.startPaste, t.startWebsite]);
    expect(document.activeElement).toBe(choice(t.startType));
  });

  it('leaves out the website where websites can’t be read', () => {
    renderSheet(false);
    expect(
      within(sheet()).queryByRole('button', { name: (n) => n.startsWith(t.startWebsite) }),
    ).toBeNull();
  });

  it('opens an empty page out of Type it, and closes', () => {
    const { onType, onClose } = renderSheet();
    const key = choice(t.startType);
    fireEvent.click(key);
    expect(onType).toHaveBeenCalledWith(key);
    expect(onClose).toHaveBeenCalled();
  });

  it('turns into the paste panel, which hands its text on, and back to the choices', () => {
    const { onPasted, onClose } = renderSheet();
    fireEvent.click(choice(t.startPaste));
    expect(within(sheet()).getByRole('heading')).toHaveTextContent(t.startPaste);
    expect(document.activeElement).toBe(within(sheet()).getByLabelText(t.pasteTextLabel));

    fireEvent.click(within(sheet()).getByRole('button', { name: t.startBack }));
    expect(within(sheet()).getByRole('heading')).toHaveTextContent(t.startTitle);
    expect(document.activeElement).toBe(choice(t.startType));

    fireEvent.click(choice(t.startPaste));
    fireEvent.change(within(sheet()).getByLabelText(t.pasteTextLabel), {
      target: { value: '2 cups flour' },
    });
    fireEvent.click(within(sheet()).getByRole('button', { name: t.pasteAdd }));
    expect(onPasted).toHaveBeenCalledWith(
      { ingredients: '2 cups flour', steps: '' },
      within(sheet()).getByRole('button', { name: t.pasteAdd }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('reads the website, then hands the recipe on', async () => {
    vi.mocked(fetchRecipePage).mockResolvedValue(page);
    const { onImported } = renderSheet();
    fireEvent.click(choice(t.startWebsite));
    fireEvent.change(within(sheet()).getByLabelText(t.pasteUrlLabel), {
      target: { value: 'example.com/pierogi' },
    });
    fireEvent.click(within(sheet()).getByRole('button', { name: t.pasteAdd }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(fetchRecipePage).toHaveBeenCalledWith('https://example.com/pierogi');
    expect(onImported.mock.calls[0][0].form.title).toBe('Pierogi Ruskie');
  });

  it('says what went wrong, and stays, when the website can’t be read', async () => {
    vi.mocked(fetchRecipePage).mockRejectedValueOnce(new ImportError('refused'));
    const { onImported, onClose } = renderSheet();
    fireEvent.click(choice(t.startWebsite));
    fireEvent.change(within(sheet()).getByLabelText(t.pasteUrlLabel), {
      target: { value: 'example.com/pierogi' },
    });
    fireEvent.click(within(sheet()).getByRole('button', { name: t.pasteAdd }));
    expect(await within(sheet()).findByRole('alert')).toHaveTextContent(t.importErrors.refused);
    expect(onImported).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens nothing when closed while a website is still being read', async () => {
    let answer: (value: unknown) => void = () => {};
    vi.mocked(fetchRecipePage).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const { onImported, onClose } = renderSheet();
    fireEvent.click(choice(t.startWebsite));
    fireEvent.change(within(sheet()).getByLabelText(t.pasteUrlLabel), {
      target: { value: 'example.com/pierogi' },
    });
    fireEvent.click(within(sheet()).getByRole('button', { name: t.pasteAdd }));
    fireEvent.click(within(sheet()).getByRole('button', { name: t.cancel }));
    expect(onClose).toHaveBeenCalled();
    answer(page);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onImported).not.toHaveBeenCalled();
  });
});

describe('the editor, filled in from the start sheet', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(fetchRecipePhoto).mockReset();
    vi.mocked(fetchRecipePhoto).mockResolvedValue(PHOTO);
  });

  it('opens with the pasted text in it, and says what came in', () => {
    const onToast = vi.fn();
    render(
      <AddRecipeModal
        start={{ text: { ingredients: '2 cups flour\n3 eggs', steps: 'Mix.\nBake.' } }}
        onClose={noop}
        onSave={noop}
        onToast={onToast}
        t={t}
      />,
    );
    expect(screen.getByLabelText(t.ingredientNameLabel(1))).toHaveValue('flour');
    expect(screen.getByLabelText(t.ingredientNameLabel(2))).toHaveValue('eggs');
    expect(screen.getByLabelText(t.stepInstructionLabel(2))).toHaveValue('Bake.');
    expect(onToast).toHaveBeenCalledWith(t.pastedBoth(2, 2));
  });

  it('opens with the website’s recipe in it, and its photo follows', async () => {
    vi.mocked(fetchRecipePhoto).mockResolvedValue(PHOTO);
    const recipe = recipeFromPage(readImportedPage(page)!, {
      servings: t.importServings,
      time: t.totalTime,
    })!;
    const onToast = vi.fn();
    render(
      <AddRecipeModal
        start={{ page: recipe }}
        onClose={noop}
        onSave={noop}
        onToast={onToast}
        t={t}
      />,
    );
    expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Pierogi Ruskie');
    expect(onToast).toHaveBeenCalledWith(t.importDone);
    expect(fetchRecipePhoto).toHaveBeenCalledWith('https://www.example.com/pierogi.jpg');
    await waitFor(() =>
      expect(screen.getByAltText(t.photoPreviewAlt)).toHaveAttribute('src', PHOTO),
    );
  });

  it('puts a website’s recipe in place of a new one kept on this phone', () => {
    localStorage.setItem('family_kitchen_recipe_draft', JSON.stringify({ title: 'Old Babka' }));
    const recipe = recipeFromPage(readImportedPage(page)!, {
      servings: t.importServings,
      time: t.totalTime,
    })!;
    render(<AddRecipeModal start={{ page: recipe }} onClose={noop} onSave={noop} t={t} />);
    expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Pierogi Ruskie');
  });
});
