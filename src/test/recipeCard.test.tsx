import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecipeCard } from '../components/recipe-grid/RecipeCard';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

const recipe = (extra: Partial<Recipe> = {}): Recipe => ({
  id: 'babka',
  name: 'Easter Babka',
  author: 'Babcia Zosia',
  category: 'cakes',
  heroImage: '',
  yieldHeader: 'For 1 cake:',
  ingredients: [{ text: 'Flour - 500 g' }],
  steps: [{ num: 1, text: 'Bake for 50 minutes.' }],
  createdAt: 1000,
  ...extra,
});

const show = (r: Recipe, lang: 'en' | 'pl' = 'en') =>
  render(<RecipeCard recipe={r} language={lang} onSelect={vi.fn()} t={UI_TEXT[lang]} />);

describe('a photo card', () => {
  it('says a few words about the recipe: its description, else its tip or note', () => {
    show(recipe({ cardDescription: 'Rich and golden.', tips: 'Rest the dough.' }));
    expect(screen.getByText('Rich and golden.')).toBeInTheDocument();
  });

  it('falls back to its tip, then its note', () => {
    const { unmount } = show(recipe({ tips: 'Rest the dough.', notes: 'Use fresh yeast.' }));
    expect(screen.getByText('Rest the dough.')).toBeInTheDocument();
    unmount();
    show(recipe({ notes: 'Use fresh yeast.' }));
    expect(screen.getByText('Use fresh yeast.')).toBeInTheDocument();
  });

  it('calls it a family favourite, in the viewer’s language, when there is nothing to say', () => {
    const { unmount } = show(recipe());
    expect(screen.getByText(UI_TEXT.en.cardDescriptionFallback)).toBeInTheDocument();
    unmount();
    show(recipe(), 'pl');
    expect(screen.getByText(UI_TEXT.pl.cardDescriptionFallback)).toBeInTheDocument();
  });
});
