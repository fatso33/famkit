import { describe, it, expect } from 'vitest';
import { coverBox, parseObjectPosition } from '../utils/photoMorph';

describe('coverBox', () => {
  it('fills a wider frame edge to edge, cropping top and bottom around the alignment', () => {
    // A 3:2 photo in a 16:10 card: full width, a little taller than the card.
    const box = coverBox(
      { width: 320, height: 200 },
      { width: 1500, height: 1000 },
      { x: 0.5, y: 0.5 },
    );
    expect(box.width).toBeCloseTo(320);
    expect(box.height).toBeCloseTo(213.33, 1);
    expect(box.left).toBeCloseTo(0);
    expect(box.top).toBeCloseTo(-6.67, 1);
  });

  it('fills a taller frame top to bottom, cropping the sides', () => {
    // The same photo in a 4:3 hero, aligned 35% from the top as the hero is.
    const box = coverBox(
      { width: 360, height: 270 },
      { width: 1500, height: 1000 },
      { x: 0.5, y: 0.35 },
    );
    expect(box.height).toBeCloseTo(270);
    expect(box.width).toBeCloseTo(405);
    expect(box.left).toBeCloseTo(-22.5);
    expect(box.top).toBeCloseTo(0);
  });

  it('matches what object-fit: cover shows, so the page looks the same', () => {
    const frame = { width: 300, height: 300 };
    const box = coverBox(frame, { width: 600, height: 400 }, { x: 0.5, y: 0.5 });
    // Centred and covering: equal overhang on both sides, none top or bottom.
    expect(box.left).toBeCloseTo(-(box.width - frame.width) / 2);
    expect(box.top).toBe(0);
    expect(box.width).toBeGreaterThanOrEqual(frame.width);
  });
});

describe('parseObjectPosition', () => {
  it('reads the computed percentages', () => {
    expect(parseObjectPosition('50% 35%')).toEqual({ x: 0.5, y: 0.35 });
    expect(parseObjectPosition('0% 100%')).toEqual({ x: 0, y: 1 });
  });

  it('counts anything else as centred', () => {
    expect(parseObjectPosition('')).toEqual({ x: 0.5, y: 0.5 });
    expect(parseObjectPosition('12px 4px')).toEqual({ x: 0.5, y: 0.5 });
  });
});
