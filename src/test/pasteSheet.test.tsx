import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { UI_TEXT } from '../i18n/translations';
import { CurrentUser, CurrentUserContext } from '../hooks/useCurrentUser';
import { ImportError, fetchRecipePage, fetchRecipePhoto } from '../services/recipeImport';
import { bylinePart, openBylinePart, pickCategory, saveRecipe } from './editorHelpers';

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
const ola: CurrentUser = { email: 'ola@example.com', name: 'Ola Nowak' };

const page = {
  url: 'https://www.example.com/pierogi',
  lang: 'en',
  jsonLd: [
    JSON.stringify({
      '@type': 'Recipe',
      name: 'Pierogi Ruskie',
      author: { name: 'Babcia Zosia' },
      image: 'https://www.example.com/pierogi.jpg',
      recipeYield: '30 pierogi',
      recipeIngredient: ['500 g flour', '1 kg potatoes (floury)'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Make the dough.' },
        { '@type': 'HowToStep', text: 'Fill and boil.' },
      ],
    }),
  ],
  meta: { image: '', siteName: 'Example' },
};

const openSheet = () => {
  fireEvent.click(screen.getByRole('button', { name: t.paste }));
  return screen.getByRole('dialog', { name: t.pasteTitle });
};

describe('pasting a recipe as text', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the ingredients and the steps in boxes of their own, and adds both', () => {
    const onToast = vi.fn();
    render(<AddRecipeModal onClose={noop} onSave={noop} onToast={onToast} t={t} />);
    const sheet = openSheet();
    fireEvent.click(within(sheet).getByRole('radio', { name: t.pasteFromText }));

    const box = () => within(sheet).getByLabelText(t.pasteTextLabel);
    fireEvent.change(box(), { target: { value: '2 cups flour (sifted)' } });
    fireEvent.click(within(sheet).getByRole('radio', { name: t.stepsHeading }));
    // The steps box starts empty: it isn't the ingredients box.
    expect(box()).toHaveValue('');
    fireEvent.change(box(), { target: { value: '1. Mix.\na) Slowly.\n2. Bake.' } });
    fireEvent.click(within(sheet).getByRole('radio', { name: t.ingredients }));
    expect(box()).toHaveValue('2 cups flour (sifted)');

    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));
    expect(onToast).toHaveBeenLastCalledWith(t.pastedBoth(1, 2));
    expect(screen.getByLabelText(t.ingredientNameLabel(1))).toHaveValue('flour');
    expect(screen.getByDisplayValue('sifted')).toBeInTheDocument();
    expect(screen.getByLabelText(t.stepInstructionLabel(1))).toHaveValue('Mix.');
    expect(screen.getByDisplayValue('Slowly.')).toBeInTheDocument();
    expect(screen.getByLabelText(t.stepInstructionLabel(2))).toHaveValue('Bake.');
  });
});

describe('adding a recipe from a website', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(fetchRecipePage).mockReset();
    vi.mocked(fetchRecipePhoto).mockReset();
  });

  it('fills the form from the page, then its photo, and saves where it came from', async () => {
    vi.mocked(fetchRecipePage).mockResolvedValue(page);
    vi.mocked(fetchRecipePhoto).mockResolvedValue(PHOTO);
    const onToast = vi.fn();
    const onSave = vi.fn();
    render(
      <CurrentUserContext value={ola}>
        <AddRecipeModal onClose={noop} onSave={onSave} onToast={onToast} t={t} />
      </CurrentUserContext>,
    );
    // Typed for someone else before the import: the import credits whoever adds it.
    openBylinePart(t, 'author');
    fireEvent.click(screen.getByRole('radio', { name: t.authorSomeoneElse }));
    fireEvent.click(screen.getByRole('button', { name: t.done }));

    const sheet = openSheet();
    fireEvent.change(within(sheet).getByLabelText(t.pasteUrlLabel), {
      target: { value: 'www.example.com/pierogi' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));

    await waitFor(() => expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Pierogi Ruskie'));
    expect(fetchRecipePage).toHaveBeenCalledWith('https://www.example.com/pierogi');
    expect(onToast).toHaveBeenCalledWith(t.importDone);
    expect(screen.queryByRole('dialog', { name: t.pasteTitle })).not.toBeInTheDocument();
    // Credited to whoever adds it, not to the site's author.
    expect(bylinePart(t, 'author')).toHaveAccessibleName(`${t.authorLabel}: Ola N.`);
    expect(screen.getByLabelText(t.ingredientNameLabel(2))).toHaveValue('potatoes');
    expect(screen.getByDisplayValue('floury')).toBeInTheDocument();
    expect(screen.getByLabelText(t.stepInstructionLabel(2))).toHaveValue('Fill and boil.');
    await waitFor(() =>
      expect(screen.getByAltText(t.photoPreviewAlt)).toHaveAttribute('src', PHOTO),
    );
    expect(fetchRecipePhoto).toHaveBeenCalledWith('https://www.example.com/pierogi.jpg');

    pickCategory(t, 'mains');
    saveRecipe(t);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Pierogi Ruskie',
      author: 'Ola Nowak',
      authorMode: 'auto',
      heroImage: PHOTO,
      sourceUrl: 'https://www.example.com/pierogi',
      yieldHeader: '30 pierogi:',
    });
  });

  it('says so, and changes nothing, when the page has no recipe or can’t be fetched', async () => {
    vi.mocked(fetchRecipePage).mockResolvedValueOnce({ ...page, jsonLd: [] });
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    fireEvent.change(screen.getByLabelText(t.recipeTitle), { target: { value: 'My own' } });

    const sheet = openSheet();
    const add = within(sheet).getByRole('button', { name: t.pasteAdd });
    const field = within(sheet).getByLabelText(t.pasteUrlLabel);
    // Something's written already: the sheet warns that a page would replace it.
    expect(within(sheet).getByText(t.pasteWebsiteReplaces, { exact: false })).toBeInTheDocument();

    fireEvent.change(field, { target: { value: 'not an address' } });
    fireEvent.click(add);
    expect(within(sheet).getByRole('alert')).toHaveTextContent(t.importErrors.badAddress);
    expect(fetchRecipePage).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: 'https://www.example.com/news' } });
    fireEvent.click(add);
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(t.importErrors.noRecipe);

    vi.mocked(fetchRecipePage).mockRejectedValueOnce(new ImportError('refused'));
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));
    await waitFor(() =>
      expect(within(sheet).getByRole('alert')).toHaveTextContent(t.importErrors.refused),
    );
    expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('My own');
  });

  it('still brings in the photo when another address is tried, and fails, meanwhile', async () => {
    let deliverPhoto: (photo: string) => void = () => {};
    vi.mocked(fetchRecipePage).mockResolvedValueOnce(page);
    vi.mocked(fetchRecipePhoto).mockReturnValue(
      new Promise<string>((resolve) => {
        deliverPhoto = resolve;
      }),
    );
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    let sheet = openSheet();
    fireEvent.change(within(sheet).getByLabelText(t.pasteUrlLabel), {
      target: { value: 'https://www.example.com/pierogi' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));
    await waitFor(() => expect(screen.getByLabelText(t.recipeTitle)).toHaveValue('Pierogi Ruskie'));
    expect(screen.getByText(t.importPhotoLoading)).toBeInTheDocument();

    // A second page, with no recipe on it: the form keeps the first recipe.
    vi.mocked(fetchRecipePage).mockResolvedValueOnce({ ...page, jsonLd: [] });
    sheet = openSheet();
    fireEvent.change(within(sheet).getByLabelText(t.pasteUrlLabel), {
      target: { value: 'https://www.example.com/news' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteAdd }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(t.importErrors.noRecipe);

    deliverPhoto(PHOTO);
    await waitFor(() =>
      expect(screen.getByAltText(t.photoPreviewAlt)).toHaveAttribute('src', PHOTO),
    );
    expect(screen.queryByText(t.importPhotoLoading)).not.toBeInTheDocument();
  });

  it('puts the copied address in the field from the Paste button', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue(' https://www.example.com/pierogi ') },
    });
    render(<AddRecipeModal onClose={noop} onSave={noop} t={t} />);
    const sheet = openSheet();
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteUrlFromClipboard }));
    await waitFor(() =>
      expect(within(sheet).getByLabelText(t.pasteUrlLabel)).toHaveValue(
        'https://www.example.com/pierogi',
      ),
    );

    // Where the clipboard can't be read, the field says how to paste by hand.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: t.pasteUrlFromClipboard }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(t.clipboardUnavailable);
  });
});
