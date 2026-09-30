import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

describe('recipe page in Polish', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_language', 'pl');
    localStorage.setItem('wandas_recipes', JSON.stringify([WANDAS_CHEESE_BREAD]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  it('shows the author, cooking time, title and back button in Polish', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByText('Chleb Serowy Wandy'));

    const meta = container.querySelector<HTMLElement>('.detail-meta');
    expect(meta).not.toBeNull();
    expect(within(meta!).getByText('Autor: Wanda G.')).toBeInTheDocument();
    expect(within(meta!).getByText('Dodane przez: Peter Gzowski')).toBeInTheDocument();
    expect(meta!.textContent).toMatch(/~(\d+g \d\dm|\d+m)/);
    expect(meta!.textContent).not.toMatch(/\b(By|hrs?|mins)\b/);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Chleb Serowy Wandy');
    expect(screen.getByRole('button', { name: UI_TEXT.pl.backToRecipes })).toBeInTheDocument();
  });
});

describe('estimated time formatting', () => {
  it.each([
    [45, '~45m', '~45m'],
    [60, '~1h 00m', '~1g 00m'],
    [65, '~1h 05m', '~1g 05m'],
    [145, '~2h 25m', '~2g 25m'],
  ])('formats %i minutes', (minutes, en, pl) => {
    expect(UI_TEXT.en.estimatedTime(minutes)).toBe(en);
    expect(UI_TEXT.pl.estimatedTime(minutes)).toBe(pl);
  });
});

describe('Polish plural forms', () => {
  it.each([
    [1, '1 składnik'],
    [2, '2 składniki'],
    [4, '4 składniki'],
    [5, '5 składników'],
    [12, '12 składników'],
    [22, '22 składniki'],
    [25, '25 składników'],
  ])('ingredient count %i', (n, expected) => {
    expect(UI_TEXT.pl.ingredientsCount(n)).toBe(expected);
  });
});
