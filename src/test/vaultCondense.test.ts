import { describe, it, expect } from 'vitest';
import { condenseGeometry, CondenseLayout } from '../utils/vaultCondense';

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
