import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { PAGE_BACKGROUND } from '../utils/season';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;
const root = document.documentElement;
const themeColor = () =>
  document.querySelector('meta[name="theme-color"]')!.getAttribute('content');

describe('choosing a season in Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    delete root.dataset.season;
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    // 10 January: the calendar says winter.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 0, 10));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    render(<App initialPage="recipes" />);
    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    fireEvent.click(screen.getByRole('button', { name: t.settings }));
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  it('follows the calendar by default, and says which season that is', () => {
    expect(screen.getByRole('radio', { name: new RegExp(t.seasonAuto) })).toBeChecked();
    expect(screen.getByText(t.seasonAutoNow('winter'))).toBeInTheDocument();
    expect(root.dataset.season).toBe('winter');
    expect(themeColor()).toBe(PAGE_BACKGROUND.winter.light);
  });

  it('keeps a chosen season, remembers it, and recolours the status bar', () => {
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(t.seasonNames.summer) }));

    expect(screen.getByRole('radio', { name: new RegExp(t.seasonNames.summer) })).toBeChecked();
    expect(root.dataset.season).toBe('summer');
    expect(localStorage.getItem('wandas_season')).toBe('summer');
    expect(themeColor()).toBe(PAGE_BACKGROUND.summer.light);

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(t.seasonAuto) }));
    expect(root.dataset.season).toBe('winter');
    expect(localStorage.getItem('wandas_season')).toBe('auto');
  });

  it('shows each season in its own colours', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const option = screen.getByRole('radio', { name: new RegExp(t.seasonNames[season]) });
      expect(option.closest('label')).toHaveAttribute('data-season', season);
    }
  });

  it('goes back to Automatic in the season the calendar gives now, even if the app stayed open', () => {
    // Cook Mode kept the screen on from January to June: no visibilitychange.
    vi.setSystemTime(new Date(2027, 5, 1, 8));
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(t.seasonNames.spring) }));
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(t.seasonAuto) }));

    expect(root.dataset.season).toBe('summer');
    expect(screen.getByText(t.seasonAutoNow('summer'))).toBeInTheDocument();
  });

  it('moves on to spring when the app is next looked at after 1 March', () => {
    vi.setSystemTime(new Date(2027, 2, 1, 8));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(root.dataset.season).toBe('spring');
    expect(screen.getByText(t.seasonAutoNow('spring'))).toBeInTheDocument();
  });
});
