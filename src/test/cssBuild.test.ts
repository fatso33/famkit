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
});
