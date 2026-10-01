import React from 'react';
import type { Season } from '../../utils/season';
import { fieldParticles } from '../../utils/splashParticles';
import { SkyParticle } from '../auth/SeasonalField';
import { skyAgeStyle } from '../../utils/sky';

interface CounterSkyProps {
  season: Season;
  /** The sky's clock (skyClock) when the counter arrived, which the particles start from. */
  age: number;
  /** Where the front particles are: in front of the page, sinking behind it, or behind it. */
  front: 'over' | 'sinking' | 'behind';
  /** While the splash is still handing over, its own particles are the ones showing. */
  hidden: boolean;
}

/**
 * The season's particles drifting down My Counter, the splash's own: in the same places at the
 * same moment (the sky's clock), so arriving from the splash nothing jumps. Most drift behind the
 * page. The few the splash shows in front of its content are in front of the counter's as it
 * arrives too, then sink behind it: their twins behind the page fade in as they fade out, so a
 * leaf over a card slips under it while one over the page stays where it is.
 */
export const CounterSky: React.FC<CounterSkyProps> = ({ season, age, front, hidden }) => {
  const particles = fieldParticles(season);
  const back = particles.filter((p) => !p.front);
  const fore = particles.filter((p) => p.front);
  return (
    <>
      <div
        className="counter-sky is-back"
        data-front={front}
        data-hidden={hidden || undefined}
        style={skyAgeStyle(age)}
        aria-hidden="true"
      >
        {back.map((p, i) => (
          <SkyParticle key={i} particle={p} />
        ))}
        <div className="counter-sky-twins">
          {fore.map((p, i) => (
            <SkyParticle key={i} particle={p} />
          ))}
        </div>
      </div>
      {front !== 'behind' && (
        <div
          className="counter-sky is-front"
          data-hidden={hidden || undefined}
          style={skyAgeStyle(age)}
          aria-hidden="true"
        >
          {fore.map((p, i) => (
            <SkyParticle key={i} particle={p} />
          ))}
        </div>
      )}
    </>
  );
};
