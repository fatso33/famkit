import { describe, it, expect } from 'vitest';
import { keyboardInset } from '../hooks/useKeyboardInset';

describe('how much of the window the keyboard covers', () => {
  it('is nothing while the whole window is visible', () => {
    expect(keyboardInset(800, 800, 0)).toBe(0);
  });

  it('is the height the keyboard takes from the bottom', () => {
    expect(keyboardInset(800, 480, 0)).toBe(320);
  });

  it('allows for the browser having scrolled the visible part down to the field', () => {
    expect(keyboardInset(800, 480, 120)).toBe(200);
  });

  it('is never negative', () => {
    expect(keyboardInset(800, 820.4, 0)).toBe(0);
  });
});
