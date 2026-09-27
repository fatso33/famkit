import React from 'react';
import type { ParticleKind } from '../../utils/splashParticles';

// Each shape is drawn centred on 0 0 in a box about 24 units across, filled with currentColor.
const MAPLE =
  'M0-10.5L1.6-5.8L4.6-7.3L3.9-2.7L8.7-4L7.2-.7L10.2.6L5.5 3.6L6.3 6.1L1 5L.6 10.5H-.6L-1 5L-6.3 6.1L-5.5 3.6L-10.2.6L-7.2-.7L-8.7-4L-3.9-2.7L-4.6-7.3L-1.6-5.8Z';
const BEECH = 'M0-11C6-7 7.5 2 0 10.5C-7.5 2-6-7 0-11Z';
const WILLOW = 'M0-11C4.2-6 4.2 5 0 10.5C-4.2 5-4.2-6 0-11Z';
const PETAL = 'M0-6.5C4-5 5.5-.5 4 3.5C3 5.8 1.6 6.6 0 5.2C-1.6 6.6-3 5.8-4 3.5C-5.5-.5-4-5 0-6.5Z';

const f = (n: number) => n.toFixed(1);

/** Six arms, each with a pair of small branches. */
const CRYSTAL = Array.from({ length: 6 }, (_, k) => {
  const a = (k * Math.PI) / 3;
  const p = (x: number, y: number) =>
    `${f(x * Math.cos(a) - y * Math.sin(a))} ${f(x * Math.sin(a) + y * Math.cos(a))}`;
  return `M0 0L${p(0, -9)}M${p(0, -5)}L${p(2.6, -7.6)}M${p(0, -5)}L${p(-2.6, -7.6)}`;
}).join('');

/** A dandelion seed: a fan of fine hairs over a stalk. */
const SEED_HAIRS =
  Array.from({ length: 13 }, (_, k) => {
    const a = ((-165 + k * 12.5) * Math.PI) / 180;
    return `M0-5L${f(Math.cos(a) * 8.5)} ${f(-5 + Math.sin(a) * 8.5)}`;
  }).join('') + 'M0-5V9';

/** The shapes of one particle, for use inside an <svg> or an SVG group. */
export const ParticleArt: React.FC<{ kind: Exclude<ParticleKind, 'flake'> }> = ({ kind }) => {
  switch (kind) {
    case 'maple':
    case 'beech':
    case 'willow':
      return (
        <>
          <path
            className="fk-particle-leaf"
            d={kind === 'maple' ? MAPLE : kind === 'beech' ? BEECH : WILLOW}
          />
          <path
            className="fk-particle-vein"
            d={
              kind === 'maple'
                ? 'M0 10.5V-6M0 1L-5-3M0 1L5-3'
                : 'M0 13V-8M0-1L-3-4M0 3L3 0M0 6L-2.5 4'
            }
          />
        </>
      );
    case 'petal':
      return (
        <>
          <path className="fk-particle-fill" d={PETAL} />
          <path className="fk-particle-shine" d="M-.5-5C2.2-4 3.2-1.5 2.6 1" />
        </>
      );
    case 'crystal':
      return <path className="fk-particle-line" d={CRYSTAL} />;
    case 'seed':
      return (
        <>
          <path className="fk-particle-hair" d={SEED_HAIRS} />
          <ellipse className="fk-particle-fill" cx="0" cy="10.5" rx="1.1" ry="2.4" />
        </>
      );
  }
};
