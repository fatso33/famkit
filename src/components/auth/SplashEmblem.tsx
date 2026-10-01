import React, { useRef, useState } from 'react';
import { EMBLEM_PATHS as P } from './emblemPaths';
import { at } from './introTiming';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { tick } from '../../utils/haptics';
import type { Season } from '../../utils/season';
import { between, LANDER, scatter } from '../../utils/splashParticles';
import { useLidLander } from '../../hooks/useLidLander';
import { ParticleArt } from './ParticleArt';

// The clay rises behind a wavy edge: half-waves 30 units wide along y 300, moved up from below.
const WAVE = `M-20 300q15-12 30 0${'t30 0'.repeat(18)}V560H-20Z`;
// The pot's opening, hidden under the lid until the lid lifts: its dark inside and gold rim.
const OPENING = { cx: 235, cy: 337, rx: 172, ry: 34 };
// Mask regions reach past the emblem so nothing clips while parts move.
const MASK_AREA = { maskUnits: 'userSpaceOnUse', x: -40, y: -60, width: 560, height: 680 } as const;

// Motes drifting up from the pot once the intro is over, tinted by the season (index.css).
// Seeded, so they look the same every visit.
const MOTES = Array.from(
  { length: 11 },
  (_, i) =>
    ({
      left: `${between(12, 88, scatter(i, 1)).toFixed(1)}%`,
      top: `${between(45, 85, scatter(i, 2)).toFixed(1)}%`,
      '--size': `${between(2, 4, scatter(i, 3)).toFixed(1)}px`,
      '--glow': between(0.3, 0.75, scatter(i, 4)).toFixed(2),
      '--dx': `${between(-24, 24, scatter(i, 5)).toFixed(0)}px`,
      '--dy': `${(-between(90, 170, scatter(i, 6))).toFixed(0)}px`,
      '--dur': `${between(6, 10, scatter(i, 7)).toFixed(1)}s`,
      '--delay': `${between(0, 6, scatter(i, 8)).toFixed(1)}s`,
    }) as React.CSSProperties,
);

interface Spark {
  id: number;
  style: React.CSSProperties;
}

/** Eight sparks flung up and out from the lid, each with a slightly different path and start. */
function makeSparks(firstId: number): Spark[] {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = ((-155 + i * 18 + Math.random() * 10) * Math.PI) / 180;
    const reach = 50 + Math.random() * 50;
    return {
      id: firstId + i,
      style: {
        left: `${50 + Math.random() * 24 - 12}%`,
        top: '62%',
        '--dx': `${(Math.cos(angle) * reach).toFixed(1)}px`,
        '--dy': `${(Math.sin(angle) * reach - 12).toFixed(1)}px`,
        animationDelay: `${(0.06 + Math.random() * 0.14).toFixed(2)}s`,
      } as React.CSSProperties,
    };
  });
}

interface WedgeProps {
  cx: number;
  cy: number;
  r: number;
  delay: number;
  duration: number;
}

/**
 * A mask that reveals a round area by sweeping up from its bottom, both ways at once: two
 * half-circle strokes (one mirrored) as wide as the circle, drawn in with a dash offset.
 */
const Wedge: React.FC<WedgeProps> = ({ cx, cy, r, delay, duration }) => {
  const circle = {
    className: 'fk-emblem-wedge fk-a fk-anim-wedge',
    style: at(delay, duration),
    cx,
    cy,
    r,
    strokeWidth: r * 2,
    pathLength: 1,
  };
  return (
    <>
      <circle {...circle} transform={`rotate(90 ${cx} ${cy})`} />
      <circle {...circle} transform={`translate(${cx * 2} 0) scale(-1 1) rotate(90 ${cx} ${cy})`} />
    </>
  );
};

interface SplashEmblemProps {
  label: string;
  /** False during the intro, when a tap skips the intro (the splash handles that) instead. */
  canTap: boolean;
  /** Picks the particle that now and then settles on the lid. */
  season: Season;
}

/**
 * The emblem drawing itself for the sign-in splash, and afterwards a button: tapping the pot
 * makes the lid jump, steam burst out, the wheat and heart flutter, and sparks fly.
 * Nested groups keep each motion on its own transform (e.g. lid: drop › simmer › hop).
 */
export const SplashEmblem: React.FC<SplashEmblemProps> = ({ label, canTap, season }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { landerRef, simmerRef, fling } = useLidLander(season, canTap);
  const landerArt = LANDER[season];
  const nextSparkId = useRef(0);
  const [sparks, setSparks] = useState<Spark[]>([]);

  const tap = () => {
    if (!canTap || prefersReducedMotion()) return;
    // Restart the tap animations even mid-play: drop the class, flush styles, add it again.
    const svg = svgRef.current;
    if (svg) {
      svg.classList.remove('is-tapped');
      void svg.getBoundingClientRect();
      svg.classList.add('is-tapped');
    }
    const fresh = makeSparks(nextSparkId.current);
    nextSparkId.current += fresh.length;
    setSparks((current) => [...current, ...fresh]);
    fling();
  };

  const buzzOnLanding = (e: React.AnimationEvent) => {
    // A light buzz as the lid lands on the pot (Android; other phones ignore it).
    if (e.target === e.currentTarget && e.animationName === 'fk-emblem-jolt') {
      tick(12);
    }
  };

  return (
    <div className="fk-emblem">
      <div className="fk-emblem-glow fk-a fk-anim-bloom" style={at(0, 1.4)} aria-hidden="true" />
      <div className="fk-emblem-motes" aria-hidden="true">
        {MOTES.map((style, i) => (
          <span key={i} className="fk-emblem-mote" style={style} />
        ))}
        {sparks.map((spark) => (
          <span
            key={spark.id}
            className="fk-emblem-spark"
            style={spark.style}
            onAnimationEnd={() => setSparks((current) => current.filter((s) => s.id !== spark.id))}
          />
        ))}
      </div>
      <button type="button" className="fk-emblem-pot" aria-label={label} onClick={tap}>
        <svg
          ref={svgRef}
          className="fk-emblem-svg"
          viewBox="0 0 469 536"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <mask id="fk-emblem-fill" {...MASK_AREA}>
              <path className="fk-emblem-wave fk-a fk-anim-wave" style={at(0.55, 1.2)} d={WAVE} />
            </mask>
            <mask id="fk-emblem-outline" {...MASK_AREA}>
              <Wedge cx={235} cy={422} r={126} delay={0.3} duration={1.1} />
            </mask>
            <mask id="fk-emblem-heart-draw" {...MASK_AREA}>
              <Wedge cx={288} cy={126} r={36} delay={2.3} duration={0.75} />
            </mask>
            <path id="fk-emblem-heart-shape" d={P.heart} />
            <clipPath id="fk-emblem-lid-clip">
              <path d={P.lidClip} />
            </clipPath>
          </defs>

          <g className="fk-a fk-anim-wipe-out" style={at(0.2, 0.7)}>
            <path className="fk-emblem-gold" d={P.base} />
          </g>

          <g className="fk-emblem-body fk-a fk-anim-thud" style={at(1.56, 0.5)}>
            <g className="fk-emblem-body-jolt" onAnimationStart={buzzOnLanding}>
              <g mask="url(#fk-emblem-fill)">
                <path className="fk-emblem-clay" d={P.body.clay} />
                <path className="fk-emblem-shade" d={P.body.shade} />
                <path className="fk-emblem-clay" d={P.body.patch} />
                <ellipse className="fk-emblem-inside" {...OPENING} />
              </g>
              <g mask="url(#fk-emblem-outline)">
                <path className="fk-emblem-gold" d={P.body.gold} />
                <ellipse className="fk-emblem-lip" {...OPENING} />
              </g>
              <g className="fk-a fk-anim-wipe-down" style={at(1.35, 0.5)}>
                <path className="fk-emblem-gold" d={P.body.highlight} />
              </g>
            </g>
          </g>

          <path
            className="fk-emblem-steam fk-emblem-puff"
            style={{ '--drift': '-17px' } as React.CSSProperties}
            d="M64 330c-9-7-5-16-14-23"
          />
          <path
            className="fk-emblem-steam fk-emblem-puff"
            style={{ '--drift': '17px' } as React.CSSProperties}
            d="M406 330c9-7 5-16 14-23"
          />
          <path
            className="fk-emblem-steam fk-emblem-burst"
            style={{ '--drift': '-28px' } as React.CSSProperties}
            d="M60 332c-13-10-7-24-20-35"
          />
          <path
            className="fk-emblem-steam fk-emblem-burst"
            style={{ '--drift': '28px' } as React.CSSProperties}
            d="M410 332c13-10 7-24 20-35"
          />

          <g className="fk-emblem-lid fk-a fk-anim-lid" style={at(1.15, 0.95)}>
            <g className="fk-emblem-lid-simmer" ref={simmerRef}>
              <g className="fk-emblem-lid-hop">
                <g clipPath="url(#fk-emblem-lid-clip)">
                  <path className="fk-emblem-clay" d={P.lid.clay} />
                  <path className="fk-emblem-shade" d={P.lid.shade} />
                </g>
                <path className="fk-emblem-gold" d={P.lid.gold} />
                <path className="fk-emblem-gold" d={P.lid.patch} />
                <g className="fk-emblem-knob fk-a fk-anim-pop" style={at(1.62, 0.5)}>
                  <path className="fk-emblem-clay" d={P.knob.rimClay} />
                  <path className="fk-emblem-gold" d={P.knob.rimGold} />
                  <path className="fk-emblem-clay" d={P.knob.clay} />
                  <path className="fk-emblem-shade" d={P.knob.shade} />
                  <path className="fk-emblem-gold" d={P.knob.gold} />
                </g>
                {/* Now and then a leaf, petal, seed or snowflake settles here (useLidLander). */}
                <g className="fk-emblem-lander" ref={landerRef}>
                  <g transform={`scale(${landerArt.scale})`}>
                    <ParticleArt kind={landerArt.kind} />
                  </g>
                </g>
              </g>
            </g>
          </g>

          <g className="fk-emblem-curl">
            <g className="fk-emblem-curl-stretch">
              <g className="fk-a fk-anim-wipe-up" style={at(1.85, 0.8)}>
                <path className="fk-emblem-gold" d={P.steam} />
              </g>
            </g>
          </g>

          <g className="fk-emblem-wheat">
            <g className="fk-emblem-wheat-flutter">
              <g className="fk-a fk-anim-wipe-up" style={at(1.8, 0.8)}>
                <path className="fk-emblem-gold" d={P.swooshLeft} />
              </g>
              <g className="fk-a fk-anim-wipe-up" style={at(1.75, 0.8)}>
                <path className="fk-emblem-gold" d={P.stalk} />
              </g>
              {P.grains.map((d, i) => (
                <g
                  key={i}
                  className="fk-emblem-grain fk-a fk-anim-pop"
                  style={at(2.2 + i * 0.08, 0.45)}
                >
                  <path className="fk-emblem-gold" d={d} />
                </g>
              ))}
            </g>
          </g>

          <g className="fk-emblem-love">
            <g className="fk-emblem-love-flutter">
              <g className="fk-a fk-anim-wipe-up" style={at(1.8, 0.7)}>
                <path className="fk-emblem-gold" d={P.swooshRight} />
              </g>
              <g className="fk-emblem-heart fk-a fk-anim-beat" style={at(3.05, 0.7)}>
                <g className="fk-emblem-heart-beat">
                  <g mask="url(#fk-emblem-heart-draw)">
                    <use className="fk-emblem-gold" href="#fk-emblem-heart-shape" />
                  </g>
                  <g className="fk-emblem-grain fk-a fk-anim-pop" style={at(2.95, 0.4)}>
                    <path className="fk-emblem-gold" d={P.drop} />
                  </g>
                </g>
              </g>
              <use
                className="fk-emblem-gold fk-emblem-ring fk-a fk-anim-ring"
                href="#fk-emblem-heart-shape"
                style={at(3.1, 1)}
              />
              <use
                className="fk-emblem-gold fk-emblem-ring fk-emblem-ring-tap"
                href="#fk-emblem-heart-shape"
              />
            </g>
          </g>

          <path className="fk-emblem-steam fk-emblem-wisp" d="M242 60c-7-11 9-20 0-35" />
          <path className="fk-emblem-steam fk-emblem-wisp" d="M264 74c-6-9 8-17 0-30" />
          <path
            className="fk-emblem-steam fk-emblem-burst"
            style={{ '--drift': '0px' } as React.CSSProperties}
            d="M235 238c-9-13 9-22 0-38"
          />
        </svg>
      </button>
    </div>
  );
};
