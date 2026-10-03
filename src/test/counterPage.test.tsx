import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import App from '../App';
import { CurrentUserContext } from '../hooks/useCurrentUser';
import { UI_TEXT } from '../i18n/translations';
import { GREETING_IDS } from '../utils/greeting';
import { Recipe, RecipeDraft } from '../types/recipe';
import { Make } from '../types/make';
import { startTyping } from './editorHelpers';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateDocuments: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;
const ola = { email: 'ola@example.com', name: 'Ola Nowak' };
const PHOTO = 'data:image/jpeg;base64,AAAA';

const recipe = (id: string, name: string, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name,
  author: 'Wanda',
  authorMode: 'custom',
  category: 'breads',
  heroImage: '',
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g' }],
  steps: [{ num: 1, text: 'Mix.' }],
  version: 1,
  ...extra,
});

const recipes = [
  recipe('rye', 'Rye bread', { createdAt: 1000 }),
  recipe('babka', 'Babka', { createdAt: 3000, ownerEmail: 'raye@example.com', ownerName: 'Raye' }),
  recipe('bigos', 'Bigos', { createdAt: 2000, updatedAt: 5000, version: 2 }),
  recipe('barszcz', 'Barszcz', { createdAt: 500 }),
];

const make = (extra: Partial<Make> = {}): Make => ({
  id: 'make-1',
  recipeId: 'babka',
  title: 'Sunday babka',
  photo: PHOTO,
  ownerEmail: 'raye@example.com',
  ownerName: 'Raye',
  createdAt: 100,
  updatedAt: 100,
  ...extra,
});

const draft: RecipeDraft = {
  id: 'draft-1',
  recipe: { ...recipe('draft-1', 'Pierogi'), category: '' },
  language: 'en',
  savedAt: Date.now() - 2 * 3_600_000,
};

const renderCounter = () =>
  render(
    <CurrentUserContext value={ola}>
      <App />
    </CurrentUserContext>,
  );

const region = (name: string) => screen.getByRole('region', { name });
const heading = () => screen.getByRole('heading', { level: 1 });
const editor = () =>
  screen.queryByRole('dialog', {
    name: new RegExp(`${t.editorTitleEdit}|${t.editorTitleNew}`, 'i'),
  });
const prefsKey = () =>
  within(document.querySelector('.counter-tools')!).getByRole('button', {
    name: t.preferences,
  });

describe('My Counter', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify(recipes));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  it('opens the app with a greeting, using only the first name where it has one', () => {
    renderCounter();
    expect(document.getElementById('viewCounter')).toBeInTheDocument();
    expect(heading()).not.toHaveTextContent('Nowak');
    const greeting = GREETING_IDS.map((id) => t.greetings[id]).find(
      (words) => words.replace('{name}', 'Ola') === heading().textContent,
    );
    expect(greeting).toBeDefined();
    if (greeting?.includes('{name}')) expect(heading()).toHaveTextContent('Ola');
  });

  it("files the box's latest three recipes as its cards, the latest first, new or updated", () => {
    renderCounter();
    const fresh = region(t.freshInBox);
    const rows = within(fresh).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('[data-vault-name]')?.textContent)).toEqual([
      'Bigos',
      'Babka',
      'Rye bread',
    ]);
    // The Recipe Box's own cards, behind a divider tab of their own, which has no count.
    expect(rows.every((row) => row.querySelector('.vault-row'))).toBe(true);
    expect(within(fresh).getByRole('heading', { name: t.freshInBox, level: 2 })).toHaveClass(
      'vault-tab',
    );
    expect(fresh.querySelector('.vault-tab-count')).toBeNull();
    expect(within(rows[0]).getByText(t.recipeUpdated)).toBeInTheDocument();
    expect(within(rows[1]).getByText(t.recipeNew)).toBeInTheDocument();
    // None opened yet.
    expect(within(rows[1]).getByText(t.unseen)).toBeInTheDocument();
  });

  it('opens a recipe right on the counter, under the Recipe Box tab, and back comes home', async () => {
    renderCounter();
    fireEvent.click(within(region(t.freshInBox)).getByRole('button', { name: 'Babka' }));
    expect(await screen.findByRole('heading', { name: 'Babka', level: 1 })).toBeInTheDocument();
    // Opened now, so no longer unseen.
    expect(JSON.parse(localStorage.getItem('family_kitchen_seen_recipes') ?? '{}')).toEqual({
      [ola.email]: ['babka'],
    });
    const tabs = screen.getByRole('navigation', { name: t.pages });
    expect(within(tabs).getByRole('button', { name: t.recipeVault })).toHaveAttribute(
      'aria-current',
      'page',
    );

    fireEvent.click(screen.getByRole('button', { name: t.goBack }));
    expect(document.getElementById('viewCounter')).toBeInTheDocument();
    expect(within(tabs).getByRole('button', { name: t.counter })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it("goes on to a tab's own page from a recipe opened on the counter", async () => {
    renderCounter();
    fireEvent.click(within(region(t.freshInBox)).getByRole('button', { name: 'Babka' }));
    await screen.findByRole('heading', { name: 'Babka', level: 1 });

    const tabs = screen.getByRole('navigation', { name: t.pages });
    fireEvent.click(within(tabs).getByRole('button', { name: t.recipeVault }));
    await act(async () => {});
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('opens the Recipe Box from "See all"', () => {
    renderCounter();
    fireEvent.click(screen.getByRole('button', { name: t.seeAllRecipes }));
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('says so while there are no makes, and shows the latest once there are', () => {
    renderCounter();
    expect(within(region(t.latestMakes)).getByText(t.makesEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.seeAllMakes })).toBeNull();
  });

  it('goes from a make to it on the Makes page', () => {
    localStorage.setItem('family_kitchen_makes', JSON.stringify([make()]));
    renderCounter();
    const tile = within(region(t.latestMakes)).getByRole('button', {
      name: t.openMakeNamed('Sunday babka'),
    });
    expect(within(tile).getByText('Raye')).toBeInTheDocument();
    fireEvent.click(tile);
    expect(heading()).toHaveTextContent(t.makes);
    expect(document.getElementById('make-make-1')).toBeInTheDocument();
  });

  // Where a window's title and See all don't both fit (large text, a small phone), See all keeps
  // only its arrow. The Makes window's word once pushed it off the side of the screen.
  it("lays out the Makes window's See all as the Recipe Box window's", () => {
    localStorage.setItem('family_kitchen_makes', JSON.stringify([make()]));
    renderCounter();
    for (const name of [t.seeAllRecipes, t.seeAllMakes]) {
      const fit = screen.getByRole('button', { name }).firstElementChild;
      expect(fit).toHaveClass('counter-see-all-fit');
      // The arrow first: laid out from the right, it's the part that always shows.
      expect(fit?.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    }
  });

  it('says so while this person has no drafts', () => {
    renderCounter();
    expect(within(region(t.yourDrafts)).getByText(t.noDrafts)).toBeInTheDocument();
  });

  it('opens a draft in the editor from its row', async () => {
    // At midday, so two hours before is still today: run just after midnight, it read "saved
    // yesterday".
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 2, 10, 12));
    try {
      const saved = { ...draft, savedAt: Date.now() - 2 * 3_600_000 };
      localStorage.setItem('family_kitchen_drafts', JSON.stringify({ [ola.email]: [saved] }));
      renderCounter();
      const row = await within(region(t.yourDrafts)).findByRole('button', {
        name: t.draftNamed('Pierogi'),
      });
      expect(within(row).getByText(t.draftLabel(1))).toBeInTheDocument();
      expect(within(row).getByText(/2 hours ago/)).toBeInTheDocument();
      fireEvent.click(row);
      expect(within(editor()!).getByLabelText(t.recipeTitle)).toHaveValue('Pierogi');
    } finally {
      vi.useRealTimers();
    }
  });

  it('has Add Recipe and Add Make keys of its own', () => {
    renderCounter();
    fireEvent.click(screen.getByRole('button', { name: t.addRecipe }));
    // A new recipe starts from a sheet of ways to begin.
    expect(screen.getByRole('dialog', { name: t.startTitle })).toBeInTheDocument();
    startTyping(t);
    expect(screen.queryByRole('dialog', { name: t.startTitle })).toBeNull();
    expect(screen.getByRole('dialog', { name: t.editorTitleNew })).toBeInTheDocument();
  });

  it('opens the preferences in a bar, which its key folds away again', () => {
    renderCounter();
    const bar = screen.getByRole('group', { name: t.preferences });
    expect(prefsKey()).toHaveAttribute('aria-expanded', 'false');
    expect(bar).toHaveAttribute('inert');

    fireEvent.click(prefsKey());
    expect(bar).not.toHaveAttribute('inert');
    // Still the preferences key, not a way to Settings.
    expect(prefsKey()).toHaveAccessibleName(t.preferences);
    expect(prefsKey()).toHaveAttribute('aria-expanded', 'true');

    // The language changes at once, the bar staying open.
    fireEvent.click(within(bar).getByRole('button', { name: t.languageToggle }));
    expect(screen.getByRole('region', { name: UI_TEXT.pl.freshInBox })).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole('button', { name: UI_TEXT.pl.languageToggle }));

    fireEvent.click(prefsKey());
    expect(bar).toHaveAttribute('inert');
    expect(prefsKey()).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('viewCounter')).toBeInTheDocument();
  });

  it('folds the bar away on a tap outside it, without pressing what was tapped', () => {
    renderCounter();
    fireEvent.click(prefsKey());
    const seeAll = screen.getByRole('button', { name: t.seeAllRecipes });
    fireEvent.pointerDown(seeAll);
    fireEvent.click(seeAll);
    expect(prefsKey()).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('viewCounter')).toBeInTheDocument();

    // A touch outside that turns into a scroll closes it too, and the next tap goes through.
    fireEvent.click(prefsKey());
    fireEvent.pointerDown(document.body);
    fireEvent.pointerCancel(document.body);
    expect(prefsKey()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: t.seeAllRecipes }));
    expect(heading()).toHaveTextContent(t.vaultTitle);
  });

  it('folds the bar away on Escape, handing focus back to its key', () => {
    renderCounter();
    fireEvent.click(prefsKey());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(prefsKey()).toHaveAttribute('aria-expanded', 'false');
    expect(prefsKey()).toHaveFocus();
  });

  it('tells this person of new hearts on their make, once', async () => {
    localStorage.setItem(
      'family_kitchen_makes',
      JSON.stringify([
        make({
          ownerEmail: ola.email,
          ownerName: ola.name,
          hearts: { 'raye@example.com': true },
        }),
      ]),
    );
    const first = renderCounter();
    expect(screen.getByText(t.heartNews(['Raye'], 1, 'Sunday babka'))).toBeInTheDocument();
    first.unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    renderCounter();
    await waitFor(() => expect(document.getElementById('viewCounter')).toBeInTheDocument());
    expect(screen.queryByText(t.heartNews(['Raye'], 1, 'Sunday babka'))).toBeNull();
  });
});
