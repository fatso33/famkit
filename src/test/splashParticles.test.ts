import { describe, it, expect } from 'vitest';
import { SEASONS } from '../utils/season';
import {
  fieldParticles,
  LANDER,
  LANDER_HZ,
  LANDER_SPOTS,
  landerFall,
  landerFling,
  landerLeave,
  landerMelt,
  landerTransform,
  msUntilRattle,
  restFrame,
  type LanderFrame,
} from '../utils/splashParticles';

/** The largest change in velocity between neighbouring frames, in viewBox units per second. */
function worstSpeedJump(frames: LanderFrame[]): number {
  let worst = 0;
  for (let i = 2; i < frames.length; i++) {
    const v1x = (frames[i - 1].x - frames[i - 2].x) * LANDER_HZ;
    const v1y = (frames[i - 1].y - frames[i - 2].y) * LANDER_HZ;
    const v2x = (frames[i].x - frames[i - 1].x) * LANDER_HZ;
    const v2y = (frames[i].y - frames[i - 1].y) * LANDER_HZ;
    worst = Math.max(worst, Math.hypot(v2x - v1x, v2y - v1y));
  }
  return worst;
}

/** Speed over the first or last step, in viewBox units per second. */
const stepSpeed = (a: LanderFrame, b: LanderFrame) => Math.hypot(b.x - a.x, b.y - a.y) * LANDER_HZ;

describe('seasonal field', () => {
  it('lays the particles out the same way every time', () => {
    for (const season of SEASONS) expect(fieldParticles(season)).toEqual(fieldParticles(season));
  });

  it('drifts each season’s own particles, in delicate numbers', () => {
    const kinds = (season: (typeof SEASONS)[number]) =>
      new Set(fieldParticles(season).map((p) => p.kind));
    expect(kinds('spring')).toEqual(new Set(['petal']));
    expect(kinds('summer')).toEqual(new Set(['seed']));
    expect(kinds('autumn')).toEqual(new Set(['maple', 'beech', 'willow']));
    expect(kinds('winter')).toEqual(new Set(['flake', 'crystal']));
    for (const season of SEASONS) {
      const n = fieldParticles(season).length;
      expect(n).toBeGreaterThanOrEqual(8);
      expect(n).toBeLessThanOrEqual(18);
    }
  });

  it('keeps the particles in front of the content to the edges, clear of the pot and title', () => {
    for (const season of SEASONS) {
      const front = fieldParticles(season).filter((p) => p.front);
      expect(front.length).toBeGreaterThan(0);
      for (const p of front) expect(p.left <= 22 || p.left >= 72, `${season} ${p.left}`).toBe(true);
    }
  });

  it('seeds rise on the breeze, everything else falls', () => {
    for (const season of SEASONS) {
      for (const p of fieldParticles(season))
        expect(p.path).toBe(season === 'summer' ? 'rise' : 'fall');
    }
  });
});

describe('the particle that settles on the lid', () => {
  for (const season of SEASONS) {
    const style = LANDER[season];
    for (const spot of LANDER_SPOTS) {
      describe(`${season}, ${spot.side < 0 ? 'left' : 'right'} of the knob`, () => {
        const rest = restFrame(style, spot);
        const fall = landerFall(style, spot);
        const leave = season === 'winter' ? landerMelt(style, spot) : landerLeave(style, spot);
        const fling = landerFling(style, spot);

        it('drifts in from above, unseen at first, and comes to rest gently on the lid', () => {
          expect(fall[0].opacity).toBe(0);
          expect(fall[0].y).toBeLessThan(0);
          const last = fall[fall.length - 1];
          for (const key of ['x', 'y', 'angle', 'squash', 'roll', 'opacity'] as const) {
            expect(last[key], key).toBeCloseTo(rest[key], 6);
          }
          // Slowing to a stop rather than stopping dead: the last step is a crawl next to the
          // average speed of the descent.
          const average = (last.y - fall[0].y) / style.fall;
          expect(stepSpeed(fall[fall.length - 2], last)).toBeLessThan(average * 0.03);
        });

        it('never jumps in speed from one frame to the next', () => {
          // Regression: the slide off the rim once halved its speed in one frame, and the frame
          // that crossed the rim moved twice as far as its neighbours.
          expect(worstSpeedJump(fall)).toBeLessThan(25);
          expect(worstSpeedJump(leave)).toBeLessThan(25);
        });

        it('leaves from exactly where it rested, starting from still, and ends unseen', () => {
          expect(leave[0].x).toBeCloseTo(rest.x, 6);
          expect(leave[0].y).toBeCloseTo(rest.y, 6);
          expect(stepSpeed(leave[0], leave[1])).toBeLessThan(5);
          expect(leave[leave.length - 1].opacity).toBeCloseTo(0, 6);
        });

        it('is flung off by a tap, launching over a few frames rather than jumping', () => {
          expect(fling[0].x).toBeCloseTo(rest.x, 6);
          expect(fling[0].y).toBeCloseTo(rest.y, 6);
          expect(stepSpeed(fling[0], fling[1])).toBeLessThan(stepSpeed(fling[5], fling[6]));
          expect(fling[fling.length - 1].opacity).toBeCloseTo(0, 6);
        });

        it('keeps every frame within sensible bounds', () => {
          for (const f of [...fall, ...leave, ...fling]) {
            expect(f.opacity).toBeGreaterThanOrEqual(0);
            expect(f.opacity).toBeLessThanOrEqual(1);
            expect(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.angle)).toBe(
              true,
            );
          }
        });
      });
    }
  }

  it('melts a snowflake rather than sliding it off', () => {
    const spot = LANDER_SPOTS[0];
    const melt = landerMelt(LANDER.winter, spot);
    expect(melt.every((f) => f.x === spot.x)).toBe(true);
    expect(melt[melt.length - 1].size).toBeCloseTo(0.2, 6);
  });

  it('writes a frame as a transform: placed, flattened, turned, then rolled', () => {
    expect(
      landerTransform({ x: 150, y: 285, angle: 78, squash: 0.62, roll: 1, size: 1, opacity: 1 }),
    ).toBe('translate(150.00px, 285.00px) scale(1.000, 0.620) rotate(78.00deg) scale(1.000, 1)');
  });
});

describe('msUntilRattle', () => {
  it('waits for the start of the next simmer cycle, after the initial delay', () => {
    expect(msUntilRattle(800, 3400, 800, 0)).toBe(0);
    expect(msUntilRattle(1800, 3400, 800, 0)).toBe(2400);
  });

  it('waits at least the minimum, skipping whole cycles', () => {
    expect(msUntilRattle(1800, 3400, 800, 5000)).toBe(5800);
  });

  it('copes with a time still inside the initial delay', () => {
    expect(msUntilRattle(300, 3400, 800, 0)).toBe(500);
  });
});
