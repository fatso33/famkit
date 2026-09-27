import React from 'react';
import type { Season } from '../../utils/season';
import { fieldParticles, PARTICLE_VIEWBOX, type FieldParticle } from '../../utils/splashParticles';
import { ParticleArt } from './ParticleArt';

/** A particle's layout as the custom properties index.css animates it with. */
function particleStyle(p: FieldParticle): React.CSSProperties {
  return {
    left: `${p.left}%`,
    color: `var(--fk-particle-${p.color})`,
    '--fk-p-path': `fk-particle-${p.path}`,
    '--fk-p-dur': `${p.duration}s`,
    '--fk-p-delay': `${p.delay}s`,
    '--fk-p-opacity': p.opacity,
    '--fk-p-drift': `${p.drift}px`,
    '--fk-p-sway': `${p.sway}px`,
    '--fk-p-tilt': `${p.tilt}deg`,
    '--fk-p-bob': `${p.bob}px`,
    '--fk-p-sway-dur': `${p.swayDuration}s`,
    '--fk-p-sway-delay': `${p.swayDelay}s`,
    '--fk-p-size': `${p.size}px`,
    '--fk-p-turn': p.turn === 'none' ? 'none' : `fk-particle-${p.turn}`,
    '--fk-p-turn-dur': `${p.turnDuration}s`,
    '--fk-p-turn-delay': `${p.turnDelay}s`,
    '--fk-p-turn-ease': p.turn === 'rock' ? 'ease-in-out' : 'linear',
    '--fk-p-turn-dir': p.turn === 'rock' ? 'alternate' : 'normal',
    '--fk-p-axis-x': p.axisX,
    '--fk-p-axis-y': p.axisY,
  } as React.CSSProperties;
}

interface SeasonalFieldProps {
  season: Season;
  /** Behind the page's content, or the few particles in front of it. */
  layer: 'back' | 'front';
}

/**
 * The season's particles drifting across the sign-in splash, in one of two layers. Each is
 * three nested elements, so its crossing, its sway and its turning are separate animations
 * of transform and opacity only, all of which the browser runs off the main thread.
 */
export const SeasonalField: React.FC<SeasonalFieldProps> = ({ season, layer }) => {
  const particles = fieldParticles(season).filter((p) => p.front === (layer === 'front'));
  return (
    <div className={`fk-splash-field is-${layer}`} data-season-field={season} aria-hidden="true">
      {particles.map((p, i) => (
        <div key={i} className="fk-particle" data-kind={p.kind} style={particleStyle(p)}>
          <div className="fk-particle-sway">
            <div className="fk-particle-bob">
              <div className="fk-particle-turn">
                {p.kind === 'flake' ? (
                  <span className="fk-particle-flake" />
                ) : (
                  <svg viewBox={PARTICLE_VIEWBOX[p.kind]} focusable="false">
                    <ParticleArt kind={p.kind} />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
