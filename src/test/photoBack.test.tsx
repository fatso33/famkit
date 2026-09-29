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

const fabs = () => document.querySelector<HTMLElement>('.fab-group')!;
const photo = () => screen.queryByRole('dialog', { name: t.photoZoomDialog });

describe('the back button over a full-screen photo', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("takes the menu button's place, closes the photo, then goes home beside it", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    expect(fabs().dataset.back).toBe('shown');

    fireEvent.click(screen.getByRole('button', { name: 'Dough' }));
    expect(photo()).not.toBeNull();
    expect(fabs().dataset.back).toBe('photo');
    // The menu button has tucked away under it.
    expect(screen.queryByRole('button', { name: t.openMenu })).toBeNull();

    fireEvent.click(fabs().querySelector('.fab-back')!);
    await act(async () => {});
    expect(photo()).toBeNull();
    expect(fabs().dataset.back).toBe('unphoto');
    expect(screen.getByRole('button', { name: t.openMenu })).toBeInTheDocument();
    // Still on the recipe: back from here leaves it, as ever.
    expect(screen.getByRole('button', { name: t.backToRecipes })).toBeInTheDocument();
  });

  it('comes back the same way when the photo closes by other means', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dough' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    await act(async () => {});
    expect(photo()).toBeNull();
    expect(fabs().dataset.back).toBe('unphoto');
  });
});
