import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;

const recipe = (id: string, category: Recipe['category']): Recipe => ({
  id,
  name: id,
  author: 'Ola',
  category,
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
  createdAt: 1000,
});

// Sorted by category (the default): Soups (2), then Cakes (1).
const RECIPES = [
  recipe('Sunday Żurek', 'soups'),
  recipe('Rosół', 'soups'),
  recipe('Easter Babka', 'cakes'),
];

const dividers = () => [...document.querySelectorAll<HTMLElement>('.vault-box .vault-divider')];
const cards = () => [...document.querySelectorAll<HTMLElement>('.vault-box [data-vault-item]')];

describe("the Recipe Box's divider tabs", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify(RECIPES));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arrive with their first card, never on their own', () => {
    render(<App initialPage="recipes" />);
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();
    const enterAt = (el: HTMLElement) => el.style.getPropertyValue('--enter-i');
    expect(dividers().map(enterAt)).toEqual(['0', '2']);
    expect(cards().map(enterAt)).toEqual(['0', '1', '2']);
  });

  it('drive the pinned tab by the scroll where the browser can', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    render(<App initialPage="recipes" />);
    const tabs = dividers().map((divider) => divider.querySelector<HTMLElement>('.vault-tab')!);
    expect(tabs.map((tab) => tab.style.getPropertyValue('--tab-timeline'))).toEqual([
      '--vault-tab-0',
      '--vault-tab-1',
    ]);
    // The page lets the shelf, up in the bar, see the list's timelines.
    expect(
      document
        .querySelector<HTMLElement>('.vault-page')!
        .style.getPropertyValue('--vault-timelines'),
    ).toBe('--vault-tab-0, --vault-end-0, --vault-tab-1, --vault-end-1');
    // Each section's last card carries its pinned tab away.
    expect(
      cards().map((card) => card.parentElement!.style.getPropertyValue('--end-timeline')),
    ).toEqual(['', '--vault-end-0', '--vault-end-1']);
  });

  it("leave the timelines out where the browser can't follow them", () => {
    render(<App initialPage="recipes" />);
    const tab = document.querySelector<HTMLElement>('.vault-box .vault-tab')!;
    expect(tab.style.getPropertyValue('--tab-timeline')).toBe('');
  });
});
