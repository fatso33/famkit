import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { translateRecipe } from '../services/gemini';
import { DEFAULT_RECIPE } from '../data/defaultRecipe';
import { Recipe } from '../types/recipe';
import { UI_TEXT } from '../i18n/translations';
import { sourceHash } from '../utils/recipeTranslation';

// Firebase is off in tests, so recipes stay local; only the translation call is mocked.
vi.mock('../services/gemini', () => ({
  isTranslationAvailable: true,
  translateRecipe: vi.fn(),
}));

const translate = vi.mocked(translateRecipe);
const offline = () =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('offline')), 5));
const settle = () => act(() => new Promise((r) => setTimeout(r, 50)));

// Last saved in the past, so this device may translate it straight away.
const customRecipe: Recipe = {
  id: 'custom-1',
  name: 'Aunt Ola Pierogi',
  author: 'Ola',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1,
  updatedAt: 1,
};

const withPolish = (r: Recipe): Recipe => ({
  ...r,
  translations: {
    pl: {
      name: 'Pierogi cioci Oli',
      yieldHeader: 'Na 1 porcję:',
      ingredients: [{ text: 'Mąka - 2 szklanki' }],
      steps: [{ num: 1, text: 'Wymieszaj.' }],
      sourceHash: sourceHash(r),
    },
  },
});

const seed = (...recipes: Recipe[]) =>
  localStorage.setItem('wandas_recipes', JSON.stringify([DEFAULT_RECIPE, ...recipes]));

const editOpenRecipe = (lang: 'en' | 'pl', changes: Record<string, string>) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(UI_TEXT[lang].editRecipe) }));
  for (const [from, to] of Object.entries(changes)) {
    fireEvent.change(screen.getByDisplayValue(from), { target: { value: to } });
  }
  fireEvent.click(screen.getByRole('button', { name: UI_TEXT[lang].saveChanges }));
};

describe('background recipe translation', () => {
  beforeEach(() => {
    translate.mockReset();
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it("translates an untranslated recipe once, and never sends Wanda's", async () => {
    seed(customRecipe);
    translate.mockResolvedValue({
      detectedLanguage: 'en',
      content: { name: 'Pierogi cioci Oli', steps: [{ num: 1, text: 'Wymieszaj.' }] },
    });
    localStorage.setItem('wandas_language', 'pl');
    render(<App />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0].id).toBe('custom-1');
    expect(screen.getByText('Pierogi cioci Oli')).toBeInTheDocument();
  });

  it('tries a failing translation once, then again when the phone comes back online', async () => {
    seed(customRecipe);
    translate.mockImplementation(offline);
    render(<App />);
    await settle();
    expect(translate).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('re-translates a recipe after its text is edited, and says when it is ready', async () => {
    seed(withPolish(customRecipe));
    translate.mockResolvedValue({ detectedLanguage: 'en', content: { name: 'Pierogi Oli' } });
    render(<App />);
    await settle();
    expect(translate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Aunt Ola Pierogi'));
    editOpenRecipe('en', { 'Aunt Ola Pierogi': "Aunt Ola's Pierogi" });
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0].name).toBe("Aunt Ola's Pierogi");
    expect(
      screen.getByText(UI_TEXT.en.translatedToast("Aunt Ola's Pierogi", 'pl')),
    ).toBeInTheDocument();
  });

  it('makes a Polish edit the new original and asks for English', async () => {
    seed(withPolish(customRecipe));
    translate.mockImplementation(offline);
    localStorage.setItem('wandas_language', 'pl');
    render(<App />);
    await settle();

    fireEvent.click(screen.getByText('Pierogi cioci Oli'));
    editOpenRecipe('pl', { 'Pierogi cioci Oli': 'Pierogi ruskie cioci Oli' });
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    const sent = translate.mock.calls[0][0];
    expect(sent.sourceLanguage).toBe('pl');
    expect(sent.name).toBe('Pierogi ruskie cioci Oli');
    expect(sent.steps[0].text).toBe('Wymieszaj.');
    expect(
      screen.getByText(UI_TEXT.pl.translationFailedToast('Pierogi ruskie cioci Oli')),
    ).toBeInTheDocument();
  });

  it('keeps the English original when a Polish reader changes only the author', async () => {
    seed(withPolish(customRecipe));
    localStorage.setItem('wandas_language', 'pl');
    render(<App />);
    await settle();

    fireEvent.click(screen.getByText('Pierogi cioci Oli'));
    editOpenRecipe('pl', { Ola: 'Ciocia Ola' });
    await settle();

    expect(translate).not.toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem('wandas_recipes')!) as Recipe[];
    const saved = stored.find((r) => r.id === 'custom-1')!;
    expect(saved.name).toBe('Aunt Ola Pierogi');
    expect(saved.author).toBe('Ciocia Ola');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pierogi cioci Oli');
  });
});

describe('Polish recipe page', () => {
  it('keeps step photos when showing the translation', () => {
    localStorage.clear();
    localStorage.setItem('wandas_language', 'pl');
    const photo = 'data:image/png;base64,STEP';
    const withPhoto = withPolish({
      ...customRecipe,
      steps: [{ num: 1, text: 'Mix.', hasImage: true, imageSrc: photo, imageCaption: 'Dough' }],
    });
    seed(withPhoto);
    render(<App />);

    fireEvent.click(screen.getByText('Pierogi cioci Oli'));
    expect(screen.getByText('Wymieszaj.')).toBeInTheDocument();
    const stepImages = screen
      .getAllByRole('img')
      .filter((img) => img.getAttribute('src') === photo);
    expect(stepImages).toHaveLength(1);
  });
});
