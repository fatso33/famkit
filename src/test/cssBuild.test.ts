import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { optimize } from '@tailwindcss/node';

// The production stylesheet goes through Tailwind's optimizer (Lightning CSS), which the dev
// server skips. It adds vendor prefixes itself, and a hand-written prefixed copy of a property
// made it keep only that copy: Chrome ignores -webkit-backdrop-filter, so the live app's menu
// and glass lost their blur while the dev server still showed it.
const source = readFileSync(resolve('src/index.css'), 'utf8').replace('@import "tailwindcss";', '');
const built = optimize(source, { file: 'index.css', minify: true }).code;

// Every declaration block in the built CSS, as its text between braces.
const blocks = [...built.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);

describe('production CSS', () => {
  it('keeps the standard backdrop-filter wherever it blurs', () => {
    const blurring = blocks.filter((b) => b.includes('backdrop-filter:'));
    expect(blurring.length).toBeGreaterThan(5);
    const prefixedOnly = blurring.filter((b) => !/(^|[;{])backdrop-filter:/.test(b));
    expect(prefixedOnly).toEqual([]);
  });

  it('still prefixes it for older Safari', () => {
    const blurring = blocks.filter((b) => /(^|;)backdrop-filter:/.test(b));
    expect(blurring.every((b) => b.includes('-webkit-backdrop-filter:'))).toBe(true);
  });

  // `:root` and `[data-theme="dark"]` weigh the same, so whichever comes last wins. The light
  // card edge once came after the dark one, and dark mode drew a bright white line on every card.
  it('lets dark mode override the light card edge', () => {
    const sheens = [...built.matchAll(/([^{}]+)\{([^{}]*--card-sheen:[^{}]*)\}/g)].map((m) => ({
      dark: m[1].includes('data-theme'),
      at: m.index ?? 0,
    }));
    const light = sheens.filter((s) => !s.dark);
    const dark = sheens.filter((s) => s.dark);
    expect(light.length).toBeGreaterThan(0);
    expect(dark.length).toBeGreaterThan(0);
    expect(Math.max(...light.map((s) => s.at))).toBeLessThan(Math.min(...dark.map((s) => s.at)));
  });

  // It expands a shorthand listing two animations into longhands with a 0s duration. A
  // scroll-driven animation with a 0s duration is finished before it starts, which left the
  // vault's big title shrunk and hidden at the top of the page.
  it('leaves scroll-driven animations their automatic duration', () => {
    // The title's condense (scroll()), the cards' lean (view()), and the pinned tab following
    // the list's tabs (named timelines).
    const scrollDriven = blocks.filter((b) =>
      /animation-timeline:(scroll\(|view\(|--|var\()/.test(b),
    );
    expect(scrollDriven.length).toBeGreaterThanOrEqual(3);
    expect(scrollDriven.some((b) => b.includes('vault-shelf-carry'))).toBe(true);
    const zeroLength = scrollDriven.filter((b) => /animation(-duration)?:[^;]*\b0s\b/.test(b));
    expect(zeroLength).toEqual([]);
  });

  // An auto grid column grows to its widest item's longest unbreakable line. At large text a
  // make's recipe name pushed the Makes cards off the side of the screen (and WebKit's page
  // crashed opening Makes), instead of the name being trimmed; Settings' season picker did the
  // same with its words.
  it.each(['.makes-feed', '.season-picker'])('keeps %s within the screen', (selector) => {
    const grid = [...built.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].trim() === selector);
    expect(grid?.[2]).toMatch(/grid-template-columns:minmax\(0(px)?,1fr\)/);
  });

  // Two @keyframes of one name: the later one wins everywhere, silently. The Recipe Box's
  // lift-away once took the title condense's name and ran its opacity-only keyframes.
  it('names every set of keyframes once', () => {
    const names = [...source.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    const twice = names.filter((name, i) => names.indexOf(name) !== i);
    expect(twice).toEqual([]);
  });
});
