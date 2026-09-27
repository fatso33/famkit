import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isSeasonPreference,
  PAGE_BACKGROUND,
  resolveSeason,
  Season,
  seasonOn,
  SEASONS,
} from '../utils/season';
import { getStoredSeasonPreference, setStoredSeasonPreference } from '../services/storage';

const css = readFileSync(resolve('src/index.css'), 'utf8');
const html = readFileSync(resolve('index.html'), 'utf8');

describe('seasonOn', () => {
  const on = (month: number, day = 15) => seasonOn(new Date(2026, month - 1, day));

  it('follows the meteorological calendar', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => on(m))).toEqual([
      'winter',
      'winter',
      'spring',
      'spring',
      'spring',
      'summer',
      'summer',
      'summer',
      'autumn',
      'autumn',
      'autumn',
      'winter',
    ]);
  });

  it('turns over on the first of the month', () => {
    expect(on(11, 30)).toBe('autumn');
    expect(on(12, 1)).toBe('winter');
    expect(on(2, 28)).toBe('winter');
    expect(on(3, 1)).toBe('spring');
  });

  it('keeps a chosen season, and follows the calendar on auto', () => {
    const july = new Date(2026, 6, 1);
    expect(resolveSeason('auto', july)).toBe('summer');
    expect(resolveSeason('winter', july)).toBe('winter');
  });
});

describe('stored season preference', () => {
  it('round-trips, and falls back to auto for anything unknown', () => {
    localStorage.clear();
    expect(getStoredSeasonPreference()).toBe('auto');
    setStoredSeasonPreference('spring');
    expect(getStoredSeasonPreference()).toBe('spring');
    localStorage.setItem('wandas_season', 'monsoon');
    expect(getStoredSeasonPreference()).toBe('auto');
    expect(isSeasonPreference('monsoon')).toBe(false);
  });
});

/** The custom properties declared by the rule with exactly this selector list. */
function tokens(selector: string): Record<string, string> {
  const escaped = selector.replace(/[[\]"().*]/g, '\\$&').replace(/,\s*/g, ',\\s*');
  const body = css.match(new RegExp(`\\n\\s*${escaped}\\s*{([^}]*)}`))?.[1];
  if (!body) throw new Error(`no rule for ${selector}`);
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

const palette = (season: Season, mode: 'light' | 'dark') =>
  season === 'autumn'
    ? tokens(
        mode === 'light'
          ? ':root, [data-season="autumn"]'
          : '[data-theme="dark"], [data-theme="dark"][data-season="autumn"], [data-theme="dark"] [data-season="autumn"]',
      )
    : tokens(
        mode === 'light'
          ? `[data-season="${season}"]`
          : `[data-theme="dark"][data-season="${season}"], [data-theme="dark"] [data-season="${season}"]`,
      );

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('seasonal palettes', () => {
  const reference = Object.keys(palette('autumn', 'light')).sort();

  for (const season of SEASONS) {
    for (const mode of ['light', 'dark'] as const) {
      describe(`${season} ${mode}`, () => {
        const p = palette(season, mode);

        it('defines exactly the tokens autumn does', () => {
          expect(Object.keys(p).sort()).toEqual(reference);
        });

        it("matches the status bar's colour", () => {
          expect(p['--bg-main']).toBe(PAGE_BACKGROUND[season][mode]);
        });

        it('keeps text readable (WCAG AA) and field edges visible (3:1)', () => {
          for (const bg of ['--bg-main', '--bg-surface', '--bg-card']) {
            expect(contrast(p['--text-primary'], p[bg]), bg).toBeGreaterThanOrEqual(4.5);
            expect(contrast(p['--text-muted'], p[bg]), bg).toBeGreaterThanOrEqual(4.5);
          }
          expect(contrast(p['--accent'], p['--accent-subtle'])).toBeGreaterThanOrEqual(4.5);
          expect(contrast(p['--on-accent'], p['--accent'])).toBeGreaterThanOrEqual(4.5);
          expect(contrast(p['--border-field'], p['--bg-card'])).toBeGreaterThanOrEqual(3);
          expect(contrast(p['--border-field'], p['--bg-surface'])).toBeGreaterThanOrEqual(3);
        });
      });
    }
  }
});

describe("index.html's pre-paint script", () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];

  it('has the same page backgrounds', () => {
    const table = script.match(/var pageBackground = ({[\s\S]*?});/)![1];
    expect(new Function(`return ${table}`)()).toEqual(PAGE_BACKGROUND);
  });

  it('picks the same season as seasonOn on every day of the year', () => {
    // Run the script's own lines against a fake page for each day.
    for (let day = 0; day < 365; day++) {
      const date = new Date(2026, 0, 1 + day);
      const attrs: Record<string, string> = {};
      const root = {
        setAttribute: (k: string, v: string) => (attrs[k] = v),
        style: { setProperty() {} },
      };
      class FakeDate extends Date {
        constructor() {
          super(date);
        }
      }
      new Function('document', 'localStorage', 'window', 'Date', script)(
        {
          documentElement: root,
          querySelector: () => ({ setAttribute: (_: string, v: string) => (attrs.meta = v) }),
        },
        { getItem: (k: string) => (k === 'wandas_theme' ? 'dark' : null) },
        {},
        FakeDate,
      );
      expect(attrs['data-season'], date.toDateString()).toBe(seasonOn(date));
      expect(attrs.meta).toBe(PAGE_BACKGROUND[seasonOn(date)].dark);
    }
  });
});
