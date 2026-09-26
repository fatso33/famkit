import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';

describe('recipe page in Polish', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_language', 'pl');
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  it('shows the author, cooking time and header name in Polish', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByText('Chleb Serowy Wandy'));

    const meta = container.querySelector<HTMLElement>('.detail-meta');
    expect(meta).not.toBeNull();
    expect(within(meta!).getByText(/^Autor: /)).toBeInTheDocument();
    expect(meta!.textContent).toMatch(/~\d+ (godz\.|min)/);
    expect(meta!.textContent).not.toMatch(/\b(By|hrs?|mins)\b/);

    expect(container.querySelector('#headerRecipeName')).toHaveTextContent('Chleb Serowy Wandy');
  });
});

describe('estimated time formatting', () => {
  it.each([
    [45, '~45 mins', '~45 min'],
    [60, '~1 hr', '~1 godz.'],
    [120, '~2 hrs', '~2 godz.'],
    [145, '~2 hrs 25 mins', '~2 godz. 25 min'],
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
