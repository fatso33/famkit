import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RecipeTimeTiles } from '../components/recipe-detail/RecipeTimeTiles';
import { RecipeCard } from '../components/recipe-grid/RecipeCard';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { timesFromText } from '../utils/timeText';

const tiles = () =>
  within(screen.getByRole('group', { name: UI_TEXT.en.recipeTime }))
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

describe('time tiles', () => {
  it('shows a tile for each typed time, named, in the app’s own way', () => {
    const times = timesFromText({ prep: '30 min', cook: '1 h 10', rest: 'overnight' })!;
    render(<RecipeTimeTiles times={times} t={UI_TEXT.en} />);
    expect(tiles()).toEqual([
      ['Prep', '30m'],
      // Kept on one line: a number never parts from what follows it.
      ['Cook', '1h\u00a010m'],
      ['Rest', 'overnight'],
    ]);
  });

  it('leaves out the times not given, and words it in Polish', () => {
    const times = timesFromText({ prep: '', cook: '45', rest: '2 dni' })!;
    render(<RecipeTimeTiles times={times} t={UI_TEXT.pl} />);
    const list = screen.getByRole('group', { name: UI_TEXT.pl.recipeTime });
    expect(
      within(list)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Gotowanie', 'Czekanie']);
    expect(within(list).getByText('45m')).toBeInTheDocument();
    expect(within(list).getByText('2 dni')).toBeInTheDocument();
  });
});

describe('a card with typed times', () => {
  it('shows their total, with the rest after a plus', () => {
    const recipe: Recipe = {
      id: 'babka',
      name: 'Easter Babka',
      author: 'Babcia Zosia',
      category: 'cakes',
      heroImage: '',
      yieldHeader: '',
      ingredients: [{ text: 'Flour - 500 g' }],
      steps: [{ num: 1, text: 'Bake for 50 minutes.' }],
      times: timesFromText({ prep: '30 min', cook: '50 min', rest: 'overnight' }),
    };
    render(<RecipeCard recipe={recipe} language="en" onSelect={vi.fn()} t={UI_TEXT.en} />);
    expect(screen.getByText('1h 20m + overnight')).toBeInTheDocument();
  });
});
