import { describe, it, expect } from 'vitest';
import { fitScale, MIN_FIT, mostCrowded, widestRun } from '../utils/fitText';

describe('fitScale', () => {
  it('leaves text that fits at full size', () => {
    expect(fitScale(300, 250)).toBe(1);
    expect(fitScale(300, 300)).toBe(1);
  });

  it('shrinks text just enough for the widest word to fit, never past it', () => {
    // "Weekendowe" at 140% on a 320px phone: 320px wide where 242px are free.
    const scale = fitScale(242, 320);
    expect(scale).toBe(0.75);
    expect(320 * scale).toBeLessThanOrEqual(242);
    expect(fitScale(297, 298)).toBe(0.99);
  });

  it('stops shrinking where the text would become unreadable', () => {
    expect(fitScale(100, 1000)).toBe(MIN_FIT);
  });

  it('changes nothing before there is anything to measure', () => {
    expect(fitScale(0, 300)).toBe(1);
    expect(fitScale(Number.NaN, 300)).toBe(1);
  });
});

describe('mostCrowded', () => {
  it('takes the line that overruns its room the most, so all can shrink alike', () => {
    // The season tiles' names at 140% on a 320px phone: "Wiosna" overruns most.
    const lines = [
      { needed: 84, available: 55 },
      { needed: 50, available: 55 },
      { needed: 70, available: 55 },
    ];
    expect(mostCrowded(lines)).toBeCloseTo(84 / 55);
    expect(fitScale(200, 200 * mostCrowded(lines))).toBe(0.65);
  });

  it('is below 1 where every line fits, so nothing shrinks', () => {
    expect(mostCrowded([{ needed: 40, available: 55 }])).toBeLessThan(1);
    expect(fitScale(200, 200 * mostCrowded([{ needed: 40, available: 55 }]))).toBe(1);
  });

  it('is 0 with nothing to measure', () => {
    expect(mostCrowded([])).toBe(0);
    expect(mostCrowded([{ needed: 40, available: 0 }])).toBe(0);
  });
});

describe('widestRun', () => {
  it('takes the widest word between spaces', () => {
    expect(widestRun([120, null, 80, null, 200])).toBe(200);
  });

  it('counts words with no space between as one: a name and the "?" after it', () => {
    expect(widestRun([120, null, 160, 26])).toBe(186);
  });

  it('is 0 with nothing to measure', () => {
    expect(widestRun([])).toBe(0);
    expect(widestRun([null])).toBe(0);
  });
});
