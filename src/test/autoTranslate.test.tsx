import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../App';
import { translateDocuments } from '../services/gemini';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { Recipe } from '../types/recipe';
import { UI_TEXT } from '../i18n/translations';
import {
  TranslationQuotaError,
  TranslationRejectedError,
  resolveEdit,
  sourceHash,
} from '../utils/recipeTranslation';
import { EDIT_SETTLE_MS } from '../utils/translationQueue';
import { dictionaryTranslator, replyFrom } from './translator';
import { goFromMenu } from './menu';

// Firebase is off in tests, so recipes stay local; only the translation call is mocked.
vi.mock('../services/gemini', () => ({
  isTranslationAvailable: true,
  translateDocuments: vi.fn(),
}));

const translate = vi.mocked(translateDocuments);
const offline = () =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('offline')), 5));
const settle = () => act(() => new Promise((r) => setTimeout(r, 50)));
// Moves the clock on (in tests using fake timers).
const later = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('translates a make in the same request as a recipe, never one of its own', async () => {
    seed(customRecipe);
    // Shared long enough ago to have settled.
    localStorage.setItem(
      'family_kitchen_makes',
      JSON.stringify([
        {
          id: 'make-1',
          recipeId: 'custom-1',
          title: 'Sunday loaves',
          note: 'Doubled it.',
          photo: 'data:image/jpeg;base64,AAAA',
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );
    translate.mockImplementation(
      dictionaryTranslator(
        { ...POLISH, 'Sunday loaves': 'Niedzielne bochenki', 'Doubled it.': 'Podwoiłam.' },
        'en',
      ),
    );
    localStorage.setItem('wandas_language', 'pl');
    render(<App initialPage="recipes" />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0].map((doc) => doc.ref)).toEqual(['custom-1', 'make:make-1']);
    await goFromMenu(UI_TEXT.pl.makes, UI_TEXT.pl);
    expect(screen.getByRole('heading', { name: 'Niedzielne bochenki' })).toBeInTheDocument();
    expect(screen.getByText('Podwoiłam.')).toBeInTheDocument();
  });

  it('waits for a newly shared make to settle before translating it', async () => {
    seed(withPolish(customRecipe));
    const now = Date.now();
    localStorage.setItem(
      'family_kitchen_makes',
      JSON.stringify([
        {
          id: 'make-1',
          recipeId: 'custom-1',
          title: 'Sunday loaves',
          photo: 'data:image/jpeg;base64,AAAA',
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );
    translate.mockImplementation(dictionaryTranslator({ 'Sunday loaves': 'Niedzielne' }, 'en'));
    render(<App initialPage="recipes" />);
    await settle();

    // Nothing else is going, so it costs no request of its own yet.
    expect(translate).not.toHaveBeenCalled();
  });

  it("translates an untranslated recipe once, and never sends Wanda's", async () => {
    seed(customRecipe);
    translate.mockImplementation(dictionaryTranslator(POLISH, 'en'));
    localStorage.setItem('wandas_language', 'pl');
    render(<App initialPage="recipes" />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0].map((doc) => doc.ref)).toEqual(['custom-1']);
    expect(screen.getByText('Pierogi cioci Oli')).toBeInTheDocument();
  });

  it("doesn't swap a recipe's languages when the translator names the wrong one", async () => {
    // Wanda's English with no current Polish: the translator writes Polish but calls the
    // original Polish, which once stored her English as "Polish" and her Polish as "English".
    const { translations, ...untranslated } = WANDAS_CHEESE_BREAD;
    localStorage.setItem('wandas_recipes', JSON.stringify([untranslated]));
    translate.mockImplementation(replyFrom(untranslated as Recipe, translations!.pl!, 'pl'));
    render(<App initialPage="recipes" />);
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
    render(<App initialPage="recipes" />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate.mock.calls[1]).toEqual(translate.mock.calls[0]);
    expect(screen.getByText('Pierogi cioci Oli')).toBeInTheDocument();
    expect(localStorage.getItem('family_kitchen_translation_failures')).toBeNull();
  });

  it('waits before asking again when the second answer is unusable too', async () => {
    seed(customRecipe);
    translate.mockRejectedValue(new TranslationRejectedError('Translation response is not JSON'));
    render(<App initialPage="recipes" />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(2);
    const failures = JSON.parse(localStorage.getItem('family_kitchen_translation_failures')!);
    expect(Object.values(failures)).toMatchObject([{ count: 1 }]);
  });

  it('asks only once when the connection is lost (that retries when back online)', async () => {
    seed(customRecipe);
    translate.mockImplementation(offline);
    render(<App initialPage="recipes" />);
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
    render(<App initialPage="recipes" />);
    await settle();

    // The left-out step, alone, once; the model leaving it out again doesn't loop.
    expect(translate).toHaveBeenCalledTimes(2);
    const [[retry]] = translate.mock.calls[1];
    expect(retry.pieces.map((p) => p.key)).toEqual(['steps:0:text']);
    expect(retry.language).toBe('en');
  });

  it('tries a failing translation once, then again when the phone comes back online', async () => {
    seed(customRecipe);
    translate.mockImplementation(offline);
    render(<App initialPage="recipes" />);
    await settle();
    expect(translate).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('quietly re-translates a recipe once its edit has settled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seed(withPolish(customRecipe));
    translate.mockImplementation(dictionaryTranslator({ "Aunt Ola's Pierogi": 'Pierogi Oli' }));
    render(<App initialPage="recipes" />);
    await settle();
    expect(translate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Aunt Ola Pierogi'));
    editOpenRecipe('en', { 'Aunt Ola Pierogi': "Aunt Ola's Pierogi" });
    await settle();
    // Edits wait, so a cook fixing things as they go costs one request, not one per save.
    expect(translate).not.toHaveBeenCalled();
    await later(EDIT_SETTLE_MS);

    expect(translate).toHaveBeenCalledTimes(1);
    const [[sent]] = translate.mock.calls[0];
    // Only the changed title is sent; the rest keeps its translation, and is context.
    expect(sent.pieces).toEqual([{ key: 'name', kind: 'title', text: "Aunt Ola's Pierogi" }]);
    expect(sent.context?.whole).toMatchObject({ name: "Aunt Ola's Pierogi" });
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

  it('makes a Polish edit the new original and asks for English once it has settled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seed(withPolish(customRecipe));
    translate.mockImplementation(offline);
    localStorage.setItem('wandas_language', 'pl');
    render(<App initialPage="recipes" />);
    await settle();

    fireEvent.click(screen.getByText('Pierogi cioci Oli'));
    editOpenRecipe('pl', { 'Pierogi cioci Oli': 'Pierogi ruskie cioci Oli' });
    await settle();
    expect(translate).not.toHaveBeenCalled();
    await later(EDIT_SETTLE_MS);

    expect(translate).toHaveBeenCalledTimes(1);
    const [[sent]] = translate.mock.calls[0];
    expect(sent.language).toBe('pl');
    expect(sent.context?.whole).toMatchObject({
      name: 'Pierogi ruskie cioci Oli',
      steps: [{ text: 'Wymieszaj.' }],
    });
    // Only the edited title needs English; the rest keeps its original English words.
    expect(sent.pieces.map((p) => p.key)).toEqual(['name']);
    // A failed background translation is logged, not shown; the reader still sees their edit.
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pierogi ruskie cioci Oli');
  });

  it('keeps the English original when a Polish reader changes only the author', async () => {
    seed(withPolish(customRecipe));
    localStorage.setItem('wandas_language', 'pl');
    render(<App initialPage="recipes" />);
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

describe('translation that holds up', () => {
  beforeEach(() => {
    translate.mockReset();
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Simple Turkey Chili as the website import saved it (editor rows: "name - amount").
  const chili: Recipe = {
    id: 'chili',
    name: 'Simple Turkey Chili',
    author: 'Allrecipes',
    category: 'mains',
    heroImage: '',
    yieldHeader: 'For 8 servings:',
    sourceLanguage: 'en',
    ingredients: [
      { text: 'olive oil - 1.5 teaspoons', name: 'olive oil', note: '' },
      { text: 'water - 2 cups', name: 'water', note: '' },
    ],
    steps: [{ num: 1, text: 'Gather all ingredients.' }],
    createdAt: 1,
    updatedAt: 1,
  };
  const CHILI_TEXTS = {
    'Simple Turkey Chili': 'Proste chili z indykiem',
    'For 8 servings:': 'Na 8 porcji:',
    'Gather all ingredients.': 'Przygotuj wszystkie składniki.',
  };
  const CHILI_ROWS = {
    'olive oil - 1.5 teaspoons': {
      text: 'oliwa z oliwek - 1,5 łyżeczki',
      name: 'oliwa z oliwek',
      note: '',
    },
    'water - 2 cups': { text: 'woda - 2 szklanki', name: 'woda', note: '' },
  };
  const tableText = () =>
    screen
      .getAllByRole('row')
      .map((row) => row.textContent)
      .join(' ');

  it('asks again at once for ingredients a reply left out (Simple Turkey Chili)', async () => {
    seed(chili);
    translate
      .mockImplementationOnce(dictionaryTranslator(CHILI_TEXTS, 'en'))
      .mockImplementation(dictionaryTranslator({ ...CHILI_TEXTS, ...CHILI_ROWS }, 'en'));
    localStorage.setItem('wandas_language', 'pl');
    render(<App initialPage="recipes" />);
    await settle();

    // Its left-out rows, straight away, alone, in its now settled language.
    expect(translate).toHaveBeenCalledTimes(2);
    const [[retry]] = translate.mock.calls[1];
    expect(retry.pieces.map((p) => p.key)).toEqual(['ingredients:0', 'ingredients:1']);
    expect(retry.language).toBe('en');

    fireEvent.click(screen.getByText('Proste chili z indykiem'));
    expect(tableText()).toContain('oliwa z oliwek');
    expect(tableText()).toContain('woda');
    expect(screen.queryByText(UI_TEXT.pl.translationOnItsWay)).not.toBeInTheDocument();
  });

  it('translates several waiting recipes in one request', async () => {
    seed(customRecipe, chili);
    translate.mockImplementation(
      dictionaryTranslator({ ...POLISH, ...CHILI_TEXTS, ...CHILI_ROWS }, 'en'),
    );
    render(<App initialPage="recipes" />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0].map((doc) => doc.ref).sort()).toEqual(['chili', 'custom-1']);
  });

  it('takes an edit that is still settling along with a new recipe’s request', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const translated = withPolish(customRecipe);
    // Edited a minute ago: its own turn is half an hour away.
    const edited = resolveEdit(
      translated,
      { ...translated, name: "Aunt Ola's Pierogi", updatedAt: Date.now() - 60_000 },
      'en',
      true,
    );
    seed(edited, chili);
    translate.mockImplementation(
      dictionaryTranslator(
        { ...CHILI_TEXTS, ...CHILI_ROWS, "Aunt Ola's Pierogi": 'Pierogi Oli' },
        'en',
      ),
    );
    render(<App initialPage="recipes" />);
    await settle();

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0][0].map((doc) => doc.ref)).toEqual(['chili', 'custom-1']);
    await later(EDIT_SETTLE_MS);
    // Nothing left for its own turn.
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('stops asking when the day’s allowance is used up, until it resets', async () => {
    seed(customRecipe);
    const resets = Date.now() + 3 * 60 * 60 * 1000;
    translate.mockRejectedValue(new TranslationQuotaError('used up', resets));
    const { unmount } = render(<App initialPage="recipes" />);
    await settle();
    expect(translate).toHaveBeenCalledTimes(1);
    expect(Number(localStorage.getItem('family_kitchen_translation_paused_until'))).toBe(resets);
    unmount();

    // Opening the app again before the reset asks for nothing.
    render(<App initialPage="recipes" />);
    await settle();
    expect(translate).toHaveBeenCalledTimes(1);
    // Not an unusable answer: no longer wait once the allowance is back.
    expect(localStorage.getItem('family_kitchen_translation_failures')).toBeNull();
  });

  it('keeps the original’s amount when a reply changes it twice, and asks no more', async () => {
    seed(customRecipe);
    translate.mockImplementation(
      dictionaryTranslator({ ...POLISH, 'Flour - 2 cups': { text: 'Mąka - 3 szklanki' } }, 'en'),
    );
    localStorage.setItem('wandas_language', 'pl');
    render(<App initialPage="recipes" />);
    await settle();

    // Asked once more for just that row, then left in its own words.
    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate.mock.calls[1][0][0].pieces.map((p) => p.key)).toEqual(['ingredients:0']);
    fireEvent.click(screen.getByText('Pierogi cioci Oli'));
    expect(tableText()).toContain('Flour');
    expect(tableText()).not.toContain('Mąka');
    await settle();
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('tells a reader, at the top of the recipe, when some of it is still to be translated', async () => {
    seed(customRecipe);
    translate.mockImplementation(offline);
    localStorage.setItem('wandas_language', 'pl');
    render(<App initialPage="recipes" />);
    await settle();

    fireEvent.click(screen.getByText('Aunt Ola Pierogi'));
    const header = screen.getByRole('heading', { level: 1 }).closest('header')!;
    expect(within(header).getByText(UI_TEXT.pl.translationOnItsWay)).toBeInTheDocument();
  });

  it('shows an edited recipe’s unchanged parts translated while the edit waits', async () => {
    const translated = withPolish(customRecipe);
    const edited = resolveEdit(
      translated,
      { ...translated, name: "Aunt Ola's Pierogi", updatedAt: Date.now() },
      'en',
      true,
    );
    seed(edited);
    translate.mockImplementation(offline);
    localStorage.setItem('wandas_language', 'pl');
    render(<App initialPage="recipes" />);
    await settle();

    // The new title as written, the rest in Polish, and the note.
    fireEvent.click(screen.getByText("Aunt Ola's Pierogi"));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Aunt Ola's Pierogi");
    expect(screen.getByText('Wymieszaj.')).toBeInTheDocument();
    expect(tableText()).toContain('Mąka');
    expect(screen.getByText(UI_TEXT.pl.translationOnItsWay)).toBeInTheDocument();
    expect(translate).not.toHaveBeenCalled();
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
    render(<App initialPage="recipes" />);

    fireEvent.click(screen.getByText('Pierogi cioci Oli'));
    expect(screen.getByText('Wymieszaj.')).toBeInTheDocument();
    const stepImages = screen
      .getAllByRole('img')
      .filter((img) => img.getAttribute('src') === photo);
    expect(stepImages).toHaveLength(1);
  });
});
