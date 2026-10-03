import { describe, it, expect } from 'vitest';
import { liftAboveKeyboard } from '../hooks/useAboveKeyboard';

// The bar ends at 120 and the keyboard starts at 500: 12px are kept clear at each edge.
const visible = { top: 120, bottom: 500 };

describe('keeping a popover card above the keyboard', () => {
  it('leaves a card that is already seen whole', () => {
    expect(liftAboveKeyboard({ top: 200, bottom: 450 }, { top: 220, bottom: 260 }, visible)).toBe(
      0,
    );
  });

  it('scrolls a card the keyboard covers up until its foot is clear', () => {
    // The times card under the byline: 330px tall, its foot at 780 behind the keyboard.
    expect(liftAboveKeyboard({ top: 450, bottom: 780 }, { top: 470, bottom: 510 }, visible)).toBe(
      780 - 488,
    );
  });

  it('brings down a card that sits under the bar', () => {
    expect(liftAboveKeyboard({ top: 60, bottom: 300 }, { top: 80, bottom: 120 }, visible)).toBe(
      60 - 132,
    );
  });

  it('keeps the field typed in seen when the whole card cannot fit', () => {
    // 600px of card in 356px of room: the field (at 700) comes up to just above the keyboard.
    expect(liftAboveKeyboard({ top: 300, bottom: 900 }, { top: 650, bottom: 700 }, visible)).toBe(
      700 - 488,
    );
  });

  it('never lifts a tall field past the bar', () => {
    expect(liftAboveKeyboard({ top: 300, bottom: 1000 }, { top: 400, bottom: 900 }, visible)).toBe(
      400 - 132,
    );
  });
});
