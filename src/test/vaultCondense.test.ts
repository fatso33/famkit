import { describe, it, expect } from 'vitest';
import { condenseGeometry, condenseSnap, CondenseLayout } from '../utils/vaultCondense';

// A phone-sized vault: the banner's title (42px type) centred 60px down the page, the banner
// ending at 170px, and the bar pinned 48px from the top with its small title (21px type) above.
const layout: CondenseLayout = {
  heading: { left: 20, top: 38, width: 372, height: 44 },
  title: { width: 250, height: 44, fontSize: 42 },
  name: { width: 125, height: 21, fontSize: 21 },
  strip: { left: 0, width: 412, height: 48 },
  mastheadBottom: 170,
  stuckAt: 48,
};

describe('the vault title condensing into the pinned bar', () => {
  it('is fully condensed when the bar pins', () => {
    expect(condenseGeometry(layout).pin).toBe(122);
  });

  it('lands the big title centred on the small one, at its width', () => {
    const { pin, dx, dy, scale } = condenseGeometry(layout);
    expect(scale).toBeCloseTo(0.5);
    // Its centre when the bar pins, moved by (dx, dy), is the strip's centre.
    expect(206 + dx).toBe(206);
    expect(60 - pin + dy).toBe(24);
  });

  it('keeps any sideways difference between the two centres', () => {
    const { dx } = condenseGeometry({ ...layout, strip: { ...layout.strip, left: 10 } });
    expect(dx).toBe(10);
  });

  it('shrinks a title wrapped onto two lines by the font sizes', () => {
    const { scale } = condenseGeometry({
      ...layout,
      title: { width: 200, height: 88, fontSize: 42 },
      name: { width: 190, height: 21, fontSize: 21 },
    });
    expect(scale).toBeCloseTo(0.5);
  });

  it('never pins above the top of the page', () => {
    expect(condenseGeometry({ ...layout, mastheadBottom: 30 }).pin).toBe(0);
  });
});

describe('settling a scroll that stops halfway', () => {
  it('carries on up to the top, or down to the pin', () => {
    expect(condenseSnap(50, 122, 2000, true)).toBe(0);
    expect(condenseSnap(50, 122, 2000, false)).toBe(122);
  });

  it('leaves the page alone at either end or past the pin', () => {
    expect(condenseSnap(0, 122, 2000, true)).toBeNull();
    expect(condenseSnap(1, 122, 2000, false)).toBeNull();
    expect(condenseSnap(122, 122, 2000, true)).toBeNull();
    expect(condenseSnap(500, 122, 2000, false)).toBeNull();
  });

  it('stops at the bottom of a page too short to reach the pin', () => {
    expect(condenseSnap(40, 122, 80, false)).toBe(80);
    expect(condenseSnap(80, 122, 80, false)).toBeNull();
  });
});
