import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../App';
import { translatePieces } from '../services/gemini';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { Recipe } from '../types/recipe';
import { UI_TEXT } from '../i18n/translations';
import { TranslationRejectedError, sourceHash } from '../utils/recipeTranslation';
import { answerFrom, dictionaryTranslator } from './translator';

// Firebase is off in tests, so recipes stay local; only the translation call is mocked.
vi.mock('../services/gemini', () => ({
  isTranslationAvailable: true,
  translatePieces: vi.fn(),
}));

const translate = vi.mocked(translatePieces);
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

// What the stand-in translator knows, into Polish.
const POLISH = {
  'Aunt Ola Pierogi': 'Pierogi cioci Oli',
  'For 1 batch:': 'Na 1 porcję:',
  'Flour - 2 cups': { text: 'Mąka - 2 szklanki' },
  'Mix.': 'Wymieszaj.',
};

const seed = (...recipes: Recipe[]) =>
  localStorage.setItem('wandas_recipes', JSON.stringify([WANDAS_CHEESE_BREAD, ...recipes]));

const editOpenRecipe = (lang: 'en' | 'pl', changes: Record<string, string>) => {
  // Edit is one of the recipe page's actions in the menu.
  fireEvent.click(screen.getByRole('button', { name: UI_TEXT[lang].openMenu }));
  const menu = screen.getByRole('dialog', { name: UI_TEXT[lang].menu });
  fireEvent.click(within(menu).getByRole('button', { name: UI_TEXT[lang].editRecipe }));
  for (const [from, to] of Object.entries(changes)) {
    fireEvent.change(screen.getByDisplayValue(from), { target: { value: to } });
  }
  fireEvent.click(screen.getByRole('button', { name: UI_TEXT[lang].save }));
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
    translate.mockImplementation(dictionaryTranslator(POLISH, 'en'));
    localStorage.setItem('wandas_language', 'pl');
    render(<App />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0].id).toBe('custom-1');
    expect(screen.getByText('Pierogi cioci Oli')).toBeInTheDocument();
  });

  it("doesn't swap a recipe's languages when the translator names the wrong one", async () => {
    // Wanda's English with no current Polish: the translator writes Polish but calls the
    // original Polish, which once stored her English as "Polish" and her Polish as "English".
    const { translations, ...untranslated } = WANDAS_CHEESE_BREAD;
    localStorage.setItem('wandas_recipes', JSON.stringify([untranslated]));
    translate.mockResolvedValue(answerFrom(untranslated as Recipe, translations!.pl!, 'pl'));
    render(<App />);
    await settle();

    // Asked once more straight away, like any unusable answer, then left for later.
    expect(translate).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Wanda's Cheese Bread")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('wandas_recipes')!) as Recipe[];
    expect(stored[0].sourceLanguage).not.toBe('pl');
    expect(stored[0].translations).toBeUndefined();
  });

  it('asks once more straight away when an answer is unusable, so one bad reply costs no wait', async () => {
    // Potato wedges: a blocked or garbled reply left it in English for hours behind the wait.
    seed(customRecipe);
    translate
      .mockRejectedValueOnce(new TranslationRejectedError('Translation response is not JSON'))
      .mockImplementation(dictionaryTranslator(POLISH, 'en'));
    localStorage.setItem('wandas_language', 'pl');
    render(<App />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate.mock.calls[1]).toEqual(translate.mock.calls[0]);
    expect(screen.getByText('Pierogi cioci Oli')).toBeInTheDocument();
    expect(localStorage.getItem('family_kitchen_translation_failures')).toBeNull();
  });

  it('waits before asking again when the second answer is unusable too', async () => {
    seed(customRecipe);
    translate.mockRejectedValue(new TranslationRejectedError('Translation response is not JSON'));
    render(<App />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(2);
    const failures = JSON.parse(localStorage.getItem('family_kitchen_translation_failures')!);
    expect(Object.values(failures)).toMatchObject([{ count: 1 }]);
  });

  it('asks only once when the connection is lost (that retries when back online)', async () => {
    seed(customRecipe);
    translate.mockImplementation(offline);
    render(<App />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('family_kitchen_translation_failures')).toBeNull();
  });

  it('asks once more for only the pieces an answer left out', async () => {
    seed(customRecipe);
    const { 'Mix.': _left, ...allButStep } = POLISH;
    translate
      .mockImplementationOnce(dictionaryTranslator(allButStep, 'en'))
      .mockImplementation(dictionaryTranslator({}, 'en'));
    render(<App />);
    await settle();

    // The left-out step, alone, once; the model leaving it out again doesn't loop.
    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate.mock.calls[1][1].map((p) => p.key)).toEqual(['steps:0:text']);
    expect(translate.mock.calls[1][2]).toBe('en');
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

  it('quietly re-translates a recipe after its text is edited', async () => {
    seed(withPolish(customRecipe));
    translate.mockImplementation(dictionaryTranslator({ "Aunt Ola's Pierogi": 'Pierogi Oli' }));
    render(<App />);
    await settle();
    expect(translate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Aunt Ola Pierogi'));
    editOpenRecipe('en', { 'Aunt Ola Pierogi': "Aunt Ola's Pierogi" });
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0].name).toBe("Aunt Ola's Pierogi");
    // Only the changed title is sent; the rest keeps its translation.
    expect(translate.mock.calls[0][1]).toEqual([
      { key: 'name', kind: 'title', text: "Aunt Ola's Pierogi" },
    ]);
    const stored = JSON.parse(localStorage.getItem('wandas_recipes')!) as Recipe[];
    const saved = stored.find((r) => r.id === 'custom-1')!;
    expect(saved.translations?.pl).toMatchObject({
      name: 'Pierogi Oli',
      steps: [{ text: 'Wymieszaj.' }],
      sourceHash: sourceHash(saved),
    });
    // Neither the save nor the finished translation interrupts with a toast.
    expect(screen.getByRole('status').textContent).toBe('');
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
    // Only the edited title needs English; the rest keeps its original English words.
    expect(translate.mock.calls[0][1].map((p) => p.key)).toEqual(['name']);
    expect(translate.mock.calls[0][2]).toBe('pl');
    // A failed background translation is logged, not shown; the reader still sees their edit.
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pierogi ruskie cioci Oli');
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
    const withCaption = {
      ...customRecipe,
      steps: [{ num: 1, text: 'Mix.', hasImage: true, imageSrc: photo, imageCaption: 'Dough' }],
    };
    const withPhoto: Recipe = {
      ...withCaption,
      translations: {
        pl: {
          ...withPolish(withCaption).translations!.pl!,
          steps: [{ num: 1, text: 'Wymieszaj.', imageCaption: 'Ciasto' }],
        },
      },
    };
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
