import { useEffect, useRef } from 'react';
import type { Season } from '../utils/season';
import { prefersReducedMotion } from '../utils/viewTransition';
import {
  LANDER,
  LANDER_HZ,
  LANDER_SPOTS,
  landerFall,
  landerFling,
  landerLeave,
  landerMelt,
  landerTransform,
  msUntilRattle,
  type LanderFrame,
} from '../utils/splashParticles';

// The simmer animation on the lid (index.css): a rattle at the start of every 3.4s cycle,
// after 0.8s.
const SIMMER_CYCLE = 3400;
const SIMMER_DELAY = 800;
/** From the intro ending to the first particle starting to drift down. */
const FIRST_LANDING = 2600;

/**
 * Now and then a particle of the season drifts down onto the splash's lid and settles there,
 * riding the lid as it simmers. A leaf or petal slides off on a later rattle, a seed is lifted
 * away by the steam and a snowflake melts; a tap on the pot flings it off. Its motion is
 * sampled from a simulation (utils/splashParticles) and played as Web Animations, which the
 * browser runs off the main thread.
 *
 * `landerRef` goes on a group inside the lid's hop group, `simmerRef` on the simmering group.
 * Nothing runs until `active` (the intro is over), or when motion is reduced.
 */
export function useLidLander(season: Season, active: boolean) {
  const landerRef = useRef<SVGGElement>(null);
  const simmerRef = useRef<SVGGElement>(null);
  const flingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = landerRef.current;
    if (!active || !el || typeof el.animate !== 'function' || prefersReducedMotion()) return;
    const style = LANDER[season];
    let timer = 0;
    let running: Animation | null = null;
    let resting = false;
    let landings = 0;
    let spot = LANDER_SPOTS[0];

    const later = (ms: number, next: () => void) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(next, ms);
    };
    const play = (frames: LanderFrame[], next: () => void) => {
      running?.cancel();
      running = el.animate(
        frames.map((f) => ({ transform: landerTransform(f), opacity: f.opacity })),
        { duration: ((frames.length - 1) / LANDER_HZ) * 1000, fill: 'forwards' },
      );
      running.onfinish = next;
    };
    const gap = (ms: number) => later(ms, land);

    function land() {
      spot = LANDER_SPOTS[landings++ % LANDER_SPOTS.length];
      play(landerFall(style, spot), rest);
    }
    function rest() {
      resting = true;
      if (season === 'winter') {
        later(4200, () => leave(landerMelt(style, spot), 7000));
        return;
      }
      const simmer = simmerRef.current?.getAnimations?.()[0];
      const now = Number(simmer?.currentTime ?? NaN);
      const min = season === 'summer' ? 3500 : 5000;
      const wait = Number.isFinite(now) ? msUntilRattle(now, SIMMER_CYCLE, SIMMER_DELAY, min) : min;
      later(wait, () => leave(landerLeave(style, spot), season === 'summer' ? 7000 : 8000));
    }
    function leave(frames: LanderFrame[], pause: number) {
      resting = false;
      window.clearTimeout(timer);
      play(frames, () => gap(pause));
    }

    flingRef.current = () => {
      if (resting) leave(landerFling(style, spot), 6000);
    };
    gap(FIRST_LANDING);
    return () => {
      window.clearTimeout(timer);
      running?.cancel();
      flingRef.current = null;
    };
  }, [season, active]);

  /** Knock a resting particle off the lid (the pot was tapped). */
  const fling = () => flingRef.current?.();

  return { landerRef, simmerRef, fling };
}
