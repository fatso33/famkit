import { useState } from 'react';
import { Language, Recipe } from '../types/recipe';
import { UiTranslations } from '../i18n/translations';
import { ToastAction, ToastTone } from './useToast';
import { getLocalizedRecipe } from './useRecipes';
import { getStoredPathChoices } from '../services/storage';
import { saveFile } from '../services/fileSave';
import { loadRecipePdf } from '../services/recipePdfLoader';
import { hasPrintablePhotos, printableRecipe, recipePdfName } from '../utils/printableRecipe';
import { recipePhoto } from '../utils/vault';

type ShowToast = (message: string, tone?: ToastTone, action?: ToastAction) => void;

/**
 * Downloading a recipe as a PDF, from the menu on its page. A recipe with photos first asks
 * whether they go in (the sheet this returns `sheetFor`); one without is made at once. The file
 * is saved as the recipe's name, in the language it's shown in.
 */
export function useRecipeDownload(
  language: Language,
  t: UiTranslations,
  showToast: ShowToast,
  hideToast: () => void,
) {
  const [sheetFor, setSheetFor] = useState<Recipe | null>(null);

  const deliver = async (bytes: Uint8Array<ArrayBuffer>, fileName: string): Promise<void> => {
    try {
      const outcome = await saveFile(bytes, fileName, 'application/pdf');
      if (outcome === 'downloaded') showToast(t.pdfDownloading(fileName));
      // The share sheet needs a fresh tap: the toast's button gives it one.
      else if (outcome === 'needs-tap') {
        showToast(t.pdfReady(fileName), 'info', {
          label: t.savePdf,
          onAction: () => void deliver(bytes, fileName),
        });
      }
      // The share sheet took it, or was closed: nothing is being prepared any more.
      else hideToast();
    } catch (err) {
      console.warn('Recipe PDF: the file could not be saved', err);
      showToast(t.pdfFailed, 'error');
    }
  };

  const make = async (recipe: Recipe, photos: boolean): Promise<void> => {
    const shown = getLocalizedRecipe(recipe, language) ?? recipe;
    const content = printableRecipe(shown, language, t, {
      photos,
      choices: getStoredPathChoices(recipe.id),
    });
    const fileName = recipePdfName(content.title, t.pdfFallbackName);
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      const { buildRecipePdf } = await loadRecipePdf();
      bytes = await buildRecipePdf(content);
    } catch (err) {
      console.warn('Recipe PDF: it could not be made', err);
      showToast(t.pdfFailed, 'error');
      return;
    }
    await deliver(bytes, fileName);
  };

  /** The menu's Download: asks about photos when there are any, otherwise makes it now. */
  const start = (recipe: Recipe) => {
    if (hasPrintablePhotos(recipe) || recipe.photosOmitted) {
      // Fetched while the choice is being made, so the PDF is quick once it is.
      loadRecipePdf().catch((err: unknown) => console.warn('Recipe PDF: preloading failed', err));
      setSheetFor(recipe);
    } else {
      showToast(t.pdfPreparing, 'info');
      void make(recipe, false);
    }
  };

  /** The sheet's choice. */
  const choose = async (photos: boolean): Promise<void> => {
    if (!sheetFor) return;
    // This phone's quick-start copy is still waiting for the recipe's photos.
    if (photos && sheetFor.photosOmitted) {
      showToast(t.photosStillLoading, 'info');
      return;
    }
    await make(sheetFor, photos);
  };

  // What the sheet shows: the file it saves, and the recipe's photo.
  const sheet = sheetFor && {
    recipe: sheetFor,
    fileName: recipePdfName(
      (getLocalizedRecipe(sheetFor, language) ?? sheetFor).name,
      t.pdfFallbackName,
    ),
    photo: recipePhoto(sheetFor),
  };

  return { sheet, start, choose, close: () => setSheetFor(null) };
}
