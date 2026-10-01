import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import App from '../App';
import { RecipeDetailView } from '../components/recipe-detail/RecipeDetailView';
import { CurrentUserContext } from '../hooks/useCurrentUser';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { remixCounts, remixOriginal, remixStart, remixesOf } from '../utils/recipeRemix';
import { parseDraft } from '../utils/recipeDrafts';
import { resolveEdit } from '../utils/recipeTranslation';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;
const ola = { email: 'ola@example.com', name: 'Ola Nowak' };
const kasia = { email: 'kasia@example.com', name: 'Kasia Wiśniewska' };

const babka: Recipe = {
  id: 'babka',
  name: 'Babka',
  author: 'Babcia Zosia',
  authorMode: 'custom',
  ownerEmail: ola.email,
  ownerName: ola.name,
  category: 'cakes',
  heroImage: '',
  yieldHeader: 'For 1 loaf:',
  baseYield: 1,
  ingredients: [{ text: 'Flour - 500g', name: 'Flour', note: '' }],
  steps: [{ num: 1, text: 'Knead.' }],
  version: 3,
  changeNote: 'Less sugar',
  versionIndex: [{ id: 'v2', version: 2, savedAt: 500 }],
  sourceUrl: 'https://example.com/babka',
  translations: { pl: { name: 'Babka', sourceHash: 'x' } },
  createdAt: 1000,
  updatedAt: 2000,
};

const remixOf = (id: string, name: string, createdAt: number, extra: Partial<Recipe> = {}) =>
  ({ ...babka, id, name, remixOf: 'babka', createdAt, ...extra }) as Recipe;

describe('remix helpers', () => {
  it('starts a remix as a new recipe: none of the original bookkeeping, credited to the remixer', () => {
    const start = remixStart(babka, 'en');
    expect(start).toMatchObject({
      name: 'Babka',
      authorMode: 'auto',
      author: '',
      category: 'cakes',
      baseYield: 1,
      remixOf: 'babka',
      sourceLanguage: 'en',
    });
    expect(start.ingredients).toEqual(babka.ingredients);
    for (const key of [
      'ownerEmail',
      'ownerName',
      'version',
      'changeNote',
      'versionIndex',
      'translations',
      'createdAt',
      'updatedAt',
      'sourceUrl',
    ] as const) {
      expect(start[key]).toBeUndefined();
    }
  });

  it('counts remixes and finds where one came from', () => {
    const late = remixOf('b', 'Late', 30);
    const early = remixOf('a', 'Early', 10);
    const all = [babka, late, early, { ...babka, id: 'other' }];
    expect(remixesOf(all, 'babka').map((r) => r.id)).toEqual(['a', 'b']);
    expect(remixCounts(all).get('babka')).toBe(2);
    expect(remixCounts(all).has('a')).toBe(false);
    expect(remixOriginal(all, early)).toBe(babka);
    // The original was deleted: still a remix, with nowhere to link to.
    expect(remixOriginal([early], early)).toBeNull();
    expect(remixOriginal(all, babka)).toBeUndefined();
    // From the cloud, so anything but an id is ignored.
    expect(remixCounts([{ ...babka, remixOf: 7 } as unknown as Recipe]).size).toBe(0);
  });

  it('keeps a remix a remix through an edit of its text', () => {
    const remix = remixOf('r', 'Babka Kasi', 10);
    const edited = resolveEdit(
      remix,
      { ...remix, remixOf: undefined, name: 'Babka Kasi II' },
      'en',
      true,
    );
    expect(edited).toMatchObject({ name: 'Babka Kasi II', remixOf: 'babka' });
  });

  it("reads a remix draft's original, and only on a new recipe's draft", () => {
    const recipe = { name: 'Babka', steps: [], remixOf: 'babka' };
    expect(parseDraft({ id: 'd', recipe })?.recipe.remixOf).toBe('babka');
    expect(parseDraft({ id: 'd', recipe: { ...recipe, remixOf: 3 } })?.recipe.remixOf).toBe(
      undefined,
    );
    expect(parseDraft({ id: 'e', recipeId: 'x', recipe })?.recipe.remixOf).toBeUndefined();
  });
});

const stored = () => JSON.parse(localStorage.getItem('wandas_recipes') || '[]') as Recipe[];
const storedDrafts = (): { recipe: Recipe }[] =>
  (
    JSON.parse(localStorage.getItem('family_kitchen_drafts') || '{}') as Record<
      string,
      { recipe: Recipe }[]
    >
  )[kasia.email] ?? [];
const heading = () => screen.getByRole('heading', { level: 1 });
const editor = () => screen.queryByRole('dialog', { name: t.editorTitleRemix });

function openMenuItem(name: string) {
  fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
  const menu = screen.getByRole('dialog', { name: t.menu });
  fireEvent.click(within(menu).getByRole('button', { name }));
  const panel = document.querySelector('.fk-menu-panel');
  if (panel) fireEvent.animationEnd(panel);
}

function chooseSave(name: RegExp) {
  fireEvent.click(within(editor()!).getByRole('button', { name: t.save }));
  const choices = screen.getByRole('dialog', { name: t.saveChoices });
  fireEvent.click(within(choices).getByRole('button', { name }));
}

const renderApp = () =>
  render(
    <CurrentUserContext value={kasia}>
      <App initialPage="recipes" />
    </CurrentUserContext>,
  );

/** Back to the Recipe Box, from a recipe. */
function backToVault() {
  fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
}

describe('remixing a recipe', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('offers Remix in place of Share, opening the editor on a copy', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    openMenuItem(t.remixRecipe);

    expect(editor()).toBeInTheDocument();
    expect(within(editor()!).getByLabelText(t.recipeTitle)).toHaveValue('Babka');
    expect(within(editor()!).getByText(t.remixingFrom('Babka'))).toBeInTheDocument();
    // A new recipe: no version history or change note to fill in.
    expect(within(editor()!).queryByLabelText(t.changeNoteLabel(3))).toBeNull();
  });

  it('saves a new recipe the remixer owns, at version 1, and leaves the original alone', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    openMenuItem(t.remixRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Babka Kasi' },
    });
    chooseSave(/^Save to Recipe Box/);
    await waitFor(() => expect(editor()).toBeNull());

    expect(heading()).toHaveTextContent('Babka Kasi');
    const [remix, original] = stored();
    expect(remix).toMatchObject({
      name: 'Babka Kasi',
      remixOf: 'babka',
      ownerEmail: kasia.email,
      author: kasia.name,
      authorMode: 'auto',
      version: 1,
    });
    expect(remix.id).not.toBe('babka');
    expect(remix.versionIndex).toBeUndefined();
    expect(original).toEqual(babka);
  });

  it('links a remix and its original both ways from their pages', async () => {
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([babka, remixOf('kasi', 'Babka Kasi', 3000, { ownerEmail: kasia.email })]),
    );
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Babka Kasi' }));

    fireEvent.click(screen.getByRole('button', { name: t.showRemixOriginal }));
    const from = screen.getByRole('dialog', { name: t.remixedFrom });
    fireEvent.click(within(from).getByRole('button', { name: /Babka/ }));
    await waitFor(() => expect(heading()).toHaveTextContent(/^Babka$/));
    expect(screen.queryByRole('dialog', { name: t.remixedFrom })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t.remixCount(1) }));
    const remixes = screen.getByRole('dialog', { name: t.remixesTitle });
    fireEvent.click(within(remixes).getByRole('button', { name: /Babka Kasi/ }));
    await waitFor(() => expect(heading()).toHaveTextContent('Babka Kasi'));
  });

  it('says so when the original is no longer in the Recipe Box', () => {
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([{ ...babka, deletedAt: 5 }, remixOf('kasi', 'Babka Kasi', 3000)]),
    );
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Babka Kasi' }));
    fireEvent.click(screen.getByRole('button', { name: t.showRemixOriginal }));
    const from = screen.getByRole('dialog', { name: t.remixedFrom });
    expect(within(from).getByText(t.remixOriginalGone)).toBeInTheDocument();
    expect(within(from).queryAllByRole('button')).toEqual([]);
  });

  it('marks remixes and counts them on the cards, which still just open the recipe', () => {
    localStorage.setItem(
      'wandas_recipes',
      JSON.stringify([babka, remixOf('a', 'Babka Kasi', 3000), remixOf('b', 'Babka Oli', 4000)]),
    );
    renderApp();
    const original = screen.getByRole('button', { name: 'Babka' });
    const badge = original.querySelector('.remix-badge');
    expect(badge).toHaveTextContent('2');
    expect(original.querySelector('.remix-mark')).toBeNull();
    const remix = screen.getByRole('button', { name: 'Babka Kasi' });
    expect(remix.querySelector('.remix-mark')).not.toBeNull();
    // Only an original with remixes has a badge.
    expect(remix.querySelector('.remix-badge')).toBeNull();

    fireEvent.click(badge!);
    expect(heading()).toHaveTextContent(/^Babka$/);
    // The popovers belong to the page, not the card.
    expect(screen.queryByRole('dialog', { name: t.remixesTitle })).toBeNull();
    backToVault();
  });

  it('keeps an unfinished remix as a draft that carries on as a remix', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    openMenuItem(t.remixRecipe);
    fireEvent.change(within(editor()!).getByLabelText(t.recipeTitle), {
      target: { value: 'Babka Kasi' },
    });
    chooseSave(/^Save draft v1/);
    await waitFor(() => expect(editor()).toBeNull());
    expect(storedDrafts()).toMatchObject([{ recipe: { name: 'Babka Kasi', remixOf: 'babka' } }]);
    // Nothing new in the Recipe Box yet.
    expect(stored()).toHaveLength(1);

    await act(async () => backToVault());
    fireEvent.click(screen.getByRole('button', { name: t.draftNamed('Babka Kasi') }));
    expect(editor()).toBeInTheDocument();
    expect(within(editor()!).getByLabelText(t.recipeTitle)).toHaveValue('Babka Kasi');

    chooseSave(/^Save to Recipe Box/);
    await waitFor(() => expect(editor()).toBeNull());
    expect(stored()[0]).toMatchObject({ name: 'Babka Kasi', remixOf: 'babka', version: 1 });
    expect(storedDrafts()).toEqual([]);
  });
});

describe('the remixes popover', () => {
  it('goes with its badge when the last remix is deleted while it is open', () => {
    const remix = remixOf('kasi', 'Babka Kasi', 3000);
    const page = (remixes: Recipe[]) => (
      <RecipeDetailView
        recipe={babka}
        language="en"
        unroll={false}
        onPhotoOpenChange={() => {}}
        remixes={remixes}
        onOpenRecipe={() => {}}
        t={t}
      />
    );
    const { rerender } = render(page([remix]));
    fireEvent.click(screen.getByRole('button', { name: t.remixCount(1) }));
    expect(screen.getByRole('dialog', { name: t.remixesTitle })).toBeInTheDocument();

    rerender(page([]));
    expect(screen.queryByRole('dialog', { name: t.remixesTitle })).toBeNull();
    // Never the original's "no longer in the Recipe Box", which isn't what happened.
    expect(screen.queryByText(t.remixOriginalGone)).toBeNull();
  });
});
