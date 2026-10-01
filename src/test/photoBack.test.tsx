import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;

const babka: Recipe = {
  id: 'babka',
  name: 'Babka',
  author: 'Ola',
  category: 'breads',
  heroImage: '',
  yieldHeader: '',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Knead.', hasImage: true, imageSrc: 'data:,', imageCaption: 'Dough' }],
  createdAt: 1000,
};

const island = () => document.querySelector<HTMLElement>('.nav-island')!;
const photo = () => screen.queryByRole('dialog', { name: t.photoZoomDialog });

describe('the back button over a full-screen photo', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('stays over the photo alone, closes it, then the island comes back around it', async () => {
    render(<App initialPage="recipes" />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    expect(island().dataset.back).toBe('out');

    fireEvent.click(screen.getByRole('button', { name: 'Dough' }));
    expect(photo()).not.toBeNull();
    expect(island().dataset.back).toBe('photo');
    // The pill and the actions button have stepped aside.
    expect(screen.queryByRole('button', { name: t.openMenu })).toBeNull();
    expect(screen.queryByRole('navigation', { name: t.pages })).toBeNull();

    fireEvent.click(island().querySelector('.nav-back')!);
    await act(async () => {});
    expect(photo()).toBeNull();
    expect(island().dataset.back).toBe('out');
    expect(screen.getByRole('button', { name: t.openMenu })).toBeInTheDocument();
    // Still on the recipe: back from here leaves it, as ever.
    expect(screen.getByRole('button', { name: t.backToRecipes })).toBeInTheDocument();
  });

  it('comes back the same way when the photo closes by other means', async () => {
    render(<App initialPage="recipes" />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dough' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    await act(async () => {});
    expect(photo()).toBeNull();
    expect(island().dataset.back).toBe('out');
  });
});
