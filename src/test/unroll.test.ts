import { describe, it, expect } from 'vitest';
import {
  revealClip,
  revealKeyframes,
  rollKeyframes,
  rollUpDuration,
  unrollDuration,
} from '../utils/unroll';

describe('unroll', () => {
  it('shows everything above the edge, and nothing while the edge is above the body', () => {
    expect(revealClip(240)).toBe('inset(0 0 calc(100% - 240px) 0)');
    // Tucked under the photo: the inset is more than the whole body.
    expect(revealClip(-26)).toBe('inset(0 0 calc(100% - -26px) 0)');
    expect(revealKeyframes(-26, 600)).toEqual([
      { clipPath: revealClip(-26) },
      { clipPath: revealClip(600) },
    ]);
  });

  it('moves the roll with the edge, thinning as it unrolls and thickening as it rolls up', () => {
    const down = rollKeyframes(-26, 600, -26);
    expect(down[0].transform).toBe('translateY(-26px) scaleY(1)');
    expect(down.at(-1)!.transform).toBe('translateY(600px) scaleY(0.62)');

    const up = rollKeyframes(600, -26, -26);
    expect(up[0].transform).toBe('translateY(600px) scaleY(0.62)');
    expect(up.at(-1)!.transform).toBe('translateY(-26px) scaleY(1)');
  });

  it('keeps the roll hidden while it is tucked under the photo', () => {
    expect(rollKeyframes(-26, 600, -26)[0].opacity).toBe(0);
    expect(rollKeyframes(600, -26, -26).at(-1)!.opacity).toBe(0);
    // Rolling up to the top of the screen (the photo scrolled away), it stays in view.
    expect(rollKeyframes(1800, 1200, -26).at(-1)!.opacity).toBe(1);
  });

  it('takes a little longer over a longer way, within limits', () => {
    expect(unrollDuration(300)).toBeLessThan(unrollDuration(700));
    expect(unrollDuration(0)).toBe(520);
    expect(unrollDuration(5000)).toBe(820);
    expect(rollUpDuration(0)).toBe(280);
    expect(rollUpDuration(5000)).toBe(460);
    // Rolling up is always the quicker of the two.
    expect(rollUpDuration(600)).toBeLessThan(unrollDuration(600));
  });
});
