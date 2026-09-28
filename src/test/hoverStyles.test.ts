import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve('src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Selectors with :hover that aren't inside @media (hover: hover). */
function unguardedHovers(text: string): string[] {
  const found: string[] = [];
  const guardDepths: number[] = [];
  let depth = 0;
  let prelude = '';
  for (const ch of text) {
    if (ch === '{') {
      if (/@media[^{]*\(hover:\s*hover\)/.test(prelude)) guardDepths.push(depth);
      else if (/:hover/.test(prelude) && guardDepths.length === 0) found.push(prelude.trim());
      depth++;
      prelude = '';
    } else if (ch === '}') {
      depth--;
      if (guardDepths.at(-1) === depth) guardDepths.pop();
      prelude = '';
    } else if (ch === ';') {
      prelude = '';
    } else {
      prelude += ch;
    }
  }
  return found;
}

describe('hover styles', () => {
  // A phone keeps :hover on whatever was last tapped, so a tapped button or menu row would
  // stay highlighted, as if it were still focused, until the next tap somewhere else.
  it('only apply where hovering is real', () => {
    expect(unguardedHovers(css)).toEqual([]);
  });

  it('spots a hover style a phone would keep', () => {
    expect(unguardedHovers('.a:hover { color: red; }')).toEqual(['.a:hover']);
    expect(unguardedHovers('@media (hover: hover) { .a:hover { color: red; } }')).toEqual([]);
  });
});
