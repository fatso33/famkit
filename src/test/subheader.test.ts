import { describe, it, expect } from 'vitest';
import { SUBHEADER_TAIL, sameSubheader, subheaderAt, SubheaderSection } from '../utils/subheader';

const BAR = 48;

// A page scrolled so that each box sits where given, in viewport pixels.
const ingredients = (headingBottom: number, bottom: number): SubheaderSection => ({
  name: 'Ingredients',
  headingBottom,
  bottom,
  groups: [
    { name: 'For the dough', headingBottom: headingBottom + 120, bottom: headingBottom + 400 },
    { name: 'For the filling', headingBottom: headingBottom + 440, bottom },
  ],
});
const steps = (headingBottom: number, bottom: number): SubheaderSection => ({
  name: 'Preparation Steps',
  headingBottom,
  bottom,
  groups: [],
});

describe('the recipe page subheader', () => {
  it('stays away while each heading is in view', () => {
    expect(subheaderAt([ingredients(300, 1200), steps(1300, 2400)], BAR)).toBeNull();
  });

  it('names the section once its heading has gone under the bar', () => {
    expect(subheaderAt([ingredients(40, 900)], BAR)).toMatchObject({
      index: 0,
      title: 'Ingredients',
      group: '',
    });
  });

  it('adds the ingredient group being read', () => {
    // "For the dough" heading at 20: under the bar; "For the filling" still below it.
    expect(subheaderAt([ingredients(-100, 800)], BAR)).toMatchObject({
      title: 'Ingredients',
      group: 'For the dough',
      groupIndex: 0,
    });
    expect(subheaderAt([ingredients(-400, 500)], BAR)).toMatchObject({
      group: 'For the filling',
      groupIndex: 1,
    });
  });

  it('gives way as a section ends, before only a sliver of it is left', () => {
    expect(subheaderAt([ingredients(-600, BAR + SUBHEADER_TAIL + 1)], BAR)).not.toBeNull();
    expect(subheaderAt([ingredients(-600, BAR + SUBHEADER_TAIL)], BAR)).toBeNull();
  });

  it('never needs to name a section that fits on screen with its heading', () => {
    // A short section: by the time its heading is under the bar, its end is too.
    expect(subheaderAt([steps(40, 80)], BAR)).toBeNull();
  });

  it('names the later section once the page reaches it', () => {
    expect(subheaderAt([ingredients(-1400, -300), steps(30, 1200)], BAR)).toMatchObject({
      index: 1,
      title: 'Preparation Steps',
    });
  });

  it('knows when nothing it shows has changed', () => {
    const a = subheaderAt([ingredients(-100, 800)], BAR);
    const b = subheaderAt([ingredients(-110, 790)], BAR);
    const c = subheaderAt([ingredients(-400, 500)], BAR);
    expect(sameSubheader(a, b)).toBe(true);
    expect(sameSubheader(a, c)).toBe(false);
    expect(sameSubheader(null, null)).toBe(true);
    expect(sameSubheader(a, null)).toBe(false);
  });
});
