import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { translateRecipeToPolish } from '../services/gemini';
import { DEFAULT_RECIPE } from '../data/defaultRecipe';
import { Recipe } from '../types/recipe';

// Gemini fails after a network-like delay (offline, quota, bad key).
vi.mock('../services/gemini', () => ({
  translateRecipeToPolish: vi.fn(
    () => new Promise((_, reject) => setTimeout(() => reject(new Error('offline')), 5)),
  ),
}));

const customRecipe: Recipe = {
  id: 'custom-1',
  name: 'Aunt Ola Pierogi',
  author: 'Ola',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 batch:',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps: [{ num: 1, text: 'Mix.' }],
};

describe('auto-translation of custom recipes', () => {
  beforeEach(() => {
    vi.mocked(translateRecipeToPolish).mockClear();
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([DEFAULT_RECIPE, customRecipe]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  it('attempts a failing translation once, not in a retry loop', async () => {
    localStorage.setItem('wandas_language', 'pl');
    render(<App />);

    fireEvent.click(screen.getByText('Aunt Ola Pierogi'));
    await act(() => new Promise((r) => setTimeout(r, 200)));

    expect(translateRecipeToPolish).toHaveBeenCalledTimes(1);
  });

  it('translates when switching to Polish while viewing an untranslated recipe', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('Aunt Ola Pierogi'));
    fireEvent.click(screen.getByRole('button', { name: /toggle language/i }));
    await act(() => new Promise((r) => setTimeout(r, 200)));

    expect(translateRecipeToPolish).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure when the user switches back to Polish', async () => {
    localStorage.setItem('wandas_language', 'pl');
    render(<App />);

    fireEvent.click(screen.getByText('Aunt Ola Pierogi'));
    await act(() => new Promise((r) => setTimeout(r, 100)));
    const toggle = screen.getByRole('button', { name: /toggle language/i });
    fireEvent.click(toggle); // → EN
    fireEvent.click(toggle); // → PL: explicit retry
    await act(() => new Promise((r) => setTimeout(r, 200)));

    expect(translateRecipeToPolish).toHaveBeenCalledTimes(2);
  });
});
