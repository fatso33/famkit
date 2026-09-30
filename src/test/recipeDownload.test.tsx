import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import App from '../App';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { PrintableRecipe } from '../utils/printableRecipe';
import { chooseFromMenu } from './menu';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

// Only the I/O is mocked: making the PDF (pdf-lib and fonts) and handing it to the phone.
const { pdf, buildRecipePdf, saveFile } = vi.hoisted(() => {
  const pdf = new Uint8Array([37, 80, 68, 70]);
  return {
    pdf,
    buildRecipePdf: vi.fn(async (_content: PrintableRecipe) => pdf),
    saveFile: vi.fn(async (..._args: unknown[]) => 'downloaded'),
  };
});
vi.mock('../services/recipePdfLoader', () => ({
  loadRecipePdf: () => Promise.resolve({ buildRecipePdf }),
}));
vi.mock('../services/fileSave', () => ({ saveFile }));

const t = UI_TEXT.en;

const openRecipe = (recipe: Recipe = WANDAS_CHEESE_BREAD) => {
  localStorage.setItem('wandas_recipes', JSON.stringify([recipe]));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: recipe.name }));
};

/** The sheet closes with an exit animation, which jsdom doesn't run. */
const finishSheet = () => {
  const layer = document.querySelector('.editor-sheet-layer');
  if (layer) fireEvent.animationEnd(layer);
};

describe('downloading a recipe as a PDF', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    buildRecipePdf.mockClear();
    saveFile.mockClear();
    saveFile.mockResolvedValue('downloaded');
  });

  it('asks whether the photos go in, then downloads the recipe named for itself', async () => {
    openRecipe();
    chooseFromMenu(t.downloadRecipe);

    const sheet = screen.getByRole('dialog', { name: t.downloadTitle });
    expect(sheet).toHaveTextContent(t.downloadFileName("Wanda's Cheese Bread.pdf"));
    fireEvent.click(within(sheet).getByRole('button', { name: new RegExp(t.downloadTextOnly) }));

    await waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(saveFile).toHaveBeenCalledWith(pdf, "Wanda's Cheese Bread.pdf", 'application/pdf');
    const content = buildRecipePdf.mock.calls[0][0];
    expect(content.title).toBe("Wanda's Cheese Bread");
    expect(content.photo).toBeUndefined();
    expect(
      await screen.findByText(t.pdfDownloading("Wanda's Cheese Bread.pdf")),
    ).toBeInTheDocument();
    finishSheet();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t.downloadTitle })).toBeNull());
  });

  it('puts the photos in when asked', async () => {
    openRecipe();
    chooseFromMenu(t.downloadRecipe);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.downloadWithPhotos) }));
    await waitFor(() => expect(buildRecipePdf).toHaveBeenCalled());
    expect(buildRecipePdf.mock.calls[0][0].photo).toBe(WANDAS_CHEESE_BREAD.heroImage);
  });

  it('shows the choice being made while the PDF is made', async () => {
    let finish = () => {};
    buildRecipePdf.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve(pdf))),
    );
    openRecipe();
    chooseFromMenu(t.downloadRecipe);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.downloadWithPhotos) }));

    const making = await screen.findByRole('button', { name: new RegExp(t.downloadPreparing) });
    expect(making).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: new RegExp(t.downloadTextOnly) })).toBeDisabled();
    finish();
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
  });

  it('makes a recipe with no photos at once, without asking', async () => {
    openRecipe({
      ...WANDAS_CHEESE_BREAD,
      heroImage: '',
      steps: WANDAS_CHEESE_BREAD.steps.map(({ hasImage: _h, imageSrc: _s, ...step }) => step),
    });
    chooseFromMenu(t.downloadRecipe);
    expect(screen.queryByRole('dialog', { name: t.downloadTitle })).toBeNull();
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(buildRecipePdf.mock.calls[0][0].photo).toBeUndefined();
  });

  it('says so when the PDF cannot be made', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildRecipePdf.mockRejectedValueOnce(new Error('font fetch failed'));
    openRecipe();
    chooseFromMenu(t.downloadRecipe);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.downloadTextOnly) }));
    expect(await screen.findByText(t.pdfFailed)).toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('offers a Save button when the share sheet needs a fresh tap', async () => {
    saveFile.mockResolvedValueOnce('needs-tap');
    openRecipe();
    chooseFromMenu(t.downloadRecipe);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.downloadTextOnly) }));

    expect(await screen.findByText(t.pdfReady("Wanda's Cheese Bread.pdf"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.savePdf }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
  });

  it('closes on Cancel without making anything', () => {
    openRecipe();
    chooseFromMenu(t.downloadRecipe);
    fireEvent.click(screen.getByRole('button', { name: t.cancel }));
    finishSheet();
    expect(screen.queryByRole('dialog', { name: t.downloadTitle })).toBeNull();
    expect(buildRecipePdf).not.toHaveBeenCalled();
  });
});
