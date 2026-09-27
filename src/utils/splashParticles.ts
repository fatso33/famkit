import type { Season } from './season';

/**
 * The sign-in splash's seasonal particles: blossom petals in spring, dandelion seeds in
 * summer, leaves in autumn and snow in winter drift across the page, and now and then one
 * settles on the pot's lid. Everything here is pure: layouts are seeded, so the page looks
 * the same every visit, and the lid particle's motion comes from a small physics simulation
 * sampled at 60 Hz, so its speed never jumps between frames.
 */

/** A repeatable stand-in for random numbers in [0, 1). */
export const scatter = (i: number, salt: number) => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
export const between = (min: number, max: number, t: number) => min + (max - min) * t;

export type ParticleKind = 'maple' | 'beech' | 'willow' | 'petal' | 'flake' | 'crystal' | 'seed';

/** The art's box, for drawing it as its own <svg>. */
export const PARTICLE_VIEWBOX: Record<Exclude<ParticleKind, 'flake'>, string> = {
  maple: '-12 -12 24 26',
  beech: '-12 -12 24 26',
  willow: '-12 -12 24 26',
  petal: '-6 -7 12 14',
  crystal: '-10 -10 20 20',
  seed: '-10 -14 20 28',
};

/** How a particle turns as it drifts: tumbling end over end, rocking, spinning flat, or not. */
export type ParticleTurn = 'tumble' | 'rock' | 'spin' | 'none';

export interface FieldParticle {
  kind: ParticleKind;
  /** In front of the page's content (larger, near the edges) rather than behind it. */
  front: boolean;
  /** Which of the season's three particle colours (1–3). */
  color: 1 | 2 | 3;
  /** Horizontal start, in % of the page width. */
  left: number;
  /** Size in px. */
  size: number;
  /** Falling (or, for seeds, rising) across the page. */
  path: 'fall' | 'rise';
  /** Seconds to cross the page, and how far into that the particle starts (negative delay). */
  duration: number;
  delay: number;
  opacity: number;
  /** Sideways drift over the whole crossing, px. */
  drift: number;
  /** The side-to-side swing: amplitude px, tilt deg, lift at each end px, seconds per swing. */
  sway: number;
  tilt: number;
  bob: number;
  swayDuration: number;
  swayDelay: number;
  turn: ParticleTurn;
  turnDuration: number;
  turnDelay: number;
  /** Direction of the tumble's axis. */
  axisX: number;
  axisY: number;
}

type Range = readonly [number, number];

interface FieldConfig {
  count: number;
  front: number;
  path: 'fall' | 'rise';
  duration: Range;
  size: Range;
  sway: Range;
  tilt: Range;
  bob: Range;
  swayDuration: Range;
  opacity: Range;
  drift: Range;
  kind: (i: number) => ParticleKind;
  turn: (i: number) => { turn: ParticleTurn; duration: number };
}

const FIELD: Record<Season, FieldConfig> = {
  spring: {
    count: 13,
    front: 4,
    path: 'fall',
    duration: [11, 17],
    size: [8, 12],
    sway: [16, 32],
    tilt: [18, 34],
    bob: [5, 10],
    swayDuration: [2.8, 4.2],
    opacity: [0.75, 0.95],
    drift: [-30, 30],
    kind: () => 'petal',
    turn: (i) =>
      scatter(i, 22) < 0.6
        ? { turn: 'tumble', duration: between(2.6, 4.4, scatter(i, 23)) }
        : { turn: 'rock', duration: between(1.6, 2.6, scatter(i, 23)) },
  },
  summer: {
    count: 8,
    front: 2,
    path: 'rise',
    duration: [17, 25],
    size: [18, 26],
    sway: [10, 20],
    tilt: [6, 14],
    bob: [3, 6],
    swayDuration: [4, 6.2],
    opacity: [0.6, 0.85],
    drift: [40, 110],
    kind: () => 'seed',
    turn: () => ({ turn: 'none', duration: 1 }),
  },
  autumn: {
    count: 12,
    front: 3,
    path: 'fall',
    duration: [12, 18],
    size: [14, 22],
    sway: [18, 38],
    tilt: [22, 40],
    bob: [6, 12],
    swayDuration: [3.4, 5.2],
    opacity: [0.7, 0.95],
    drift: [-30, 30],
    kind: (i) => {
      const t = scatter(i, 21);
      return t < 0.4 ? 'maple' : t < 0.75 ? 'beech' : 'willow';
    },
    turn: (i) =>
      scatter(i, 22) < 0.5
        ? { turn: 'tumble', duration: between(4.5, 8, scatter(i, 23)) }
        : { turn: 'rock', duration: between(2.4, 3.6, scatter(i, 23)) },
  },
  winter: {
    count: 18,
    front: 4,
    path: 'fall',
    duration: [14, 23],
    size: [4, 8],
    sway: [8, 18],
    tilt: [0, 0],
    bob: [0, 0],
    swayDuration: [3.6, 6],
    opacity: [0.65, 0.95],
    drift: [-30, 30],
    kind: (i) => (scatter(i, 21) < 0.3 ? 'crystal' : 'flake'),
    turn: (i) =>
      scatter(i, 21) < 0.3
        ? { turn: 'spin', duration: between(14, 24, scatter(i, 23)) }
        : { turn: 'none', duration: 1 },
  },
};

const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places;

/**
 * The particles drifting across the splash in a season. Most pass behind the content, smaller
 * and fainter; the first few pass in front, larger, and keep to the edges so they never cross
 * the pot or the title.
 */
export function fieldParticles(season: Season): FieldParticle[] {
  const c = FIELD[season];
  return Array.from({ length: c.count }, (_, i) => {
    const front = i < c.front;
    const kind = c.kind(i);
    const { turn, duration: turnDuration } = c.turn(i);
    const duration = between(c.duration[0], c.duration[1], scatter(i, 4)) * (front ? 0.85 : 1);
    const swayDuration = between(c.swayDuration[0], c.swayDuration[1], scatter(i, 6));
    const left = front
      ? scatter(i, 1) < 0.5
        ? between(-2, 22, scatter(i, 2))
        : between(72, 96, scatter(i, 2))
      : between(-2, 96, (scatter(i, 1) + scatter(i, 2)) / 2);
    const size =
      between(c.size[0], c.size[1], scatter(i, 3)) *
      (front ? 1.3 : 1) *
      (kind === 'crystal' ? 2 : 1);
    return {
      kind,
      front,
      color: (1 + Math.floor(scatter(i, 7) * 3)) as 1 | 2 | 3,
      left: round(left),
      size: round(size),
      path: c.path,
      duration: round(duration),
      delay: round(-scatter(i, 5) * duration),
      opacity: round(
        front ? c.opacity[1] : between(c.opacity[0], c.opacity[1], scatter(i, 8)) * 0.75,
        2,
      ),
      drift: round(between(c.drift[0], c.drift[1], scatter(i, 12))),
      sway: round(between(c.sway[0], c.sway[1], scatter(i, 9))),
      tilt: round(between(c.tilt[0], c.tilt[1], scatter(i, 10))),
      bob: round(between(c.bob[0], c.bob[1], scatter(i, 11))),
      swayDuration: round(swayDuration),
      swayDelay: round(-scatter(i, 13) * swayDuration * 2),
      turn,
      turnDuration: round(turnDuration),
      turnDelay: round(-scatter(i, 14) * turnDuration),
      axisX: round(scatter(i, 15) * 0.8 + 0.2, 2),
      axisY: round(scatter(i, 16) * 0.8 + 0.2, 2),
    };
  });
}

/* ── The particle that settles on the lid ──
   Positions are in the emblem's viewBox units (469 × 536), inside the lid's hop group, so the
   particle rides the lid when it simmers or jumps. */

/** Where a particle lands on the lid's upper slope, and the rim edge it slides off from. */
export interface LanderSpot {
  x: number;
  /** -1: the left slope (slides off to the left); 1: the right one. */
  side: -1 | 1;
  rimX: number;
  rimY: number;
}

export const LANDER_SPOTS: readonly LanderSpot[] = [
  { x: 150, side: -1, rimX: 76, rimY: 313 },
  { x: 320, side: 1, rimX: 394, rimY: 313 },
];

export interface LanderStyle {
  /** Always a shape with art (a crystal stands in for snow). */
  kind: Exclude<ParticleKind, 'flake'>;
  /** Scale of the particle's art (drawn in a ~24-unit box) into viewBox units. */
  scale: number;
  /** Seconds to drift down onto the lid. */
  fall: number;
  /** Sideways swing (units), tilt (deg), lift at each end (units), seconds per swing. */
  sway: number;
  tilt: number;
  bob: number;
  swing: number;
  /** Seconds per roll over while falling; 0 for no roll. */
  roll: number;
  /** Extra turn (deg) unwinding during the fall, for the snowflake. */
  spin: number;
  /** How flat it lies at rest (vertical squash seen from above); 1 for standing. */
  squash: number;
  /** Centre height at rest. */
  restY: number;
  /** Rotation at rest on the left spot; mirrored on the right. */
  restAngle: number;
}

export const LANDER: Record<Season, LanderStyle> = {
  spring: {
    kind: 'petal',
    scale: 2.8,
    fall: 5,
    sway: 26,
    tilt: 30,
    bob: 8,
    swing: 1.6,
    roll: 0.8,
    spin: 0,
    squash: 0.62,
    restY: 286,
    restAngle: 78,
  },
  summer: {
    kind: 'seed',
    scale: 2,
    fall: 6.5,
    sway: 18,
    tilt: 10,
    bob: 4,
    swing: 2.4,
    roll: 0,
    spin: 0,
    squash: 1,
    restY: 267,
    restAngle: 8,
  },
  autumn: {
    kind: 'maple',
    scale: 2.2,
    fall: 5.6,
    sway: 34,
    tilt: 24,
    bob: 10,
    swing: 2.1,
    roll: 1.3,
    spin: 0,
    squash: 0.62,
    restY: 285,
    restAngle: 78,
  },
  winter: {
    kind: 'crystal',
    scale: 2.1,
    fall: 7,
    sway: 14,
    tilt: 0,
    bob: 0,
    swing: 2.6,
    roll: 0,
    spin: 90,
    squash: 0.62,
    restY: 283,
    restAngle: 12,
  },
};

/** One sampled moment of the lid particle. */
export interface LanderFrame {
  x: number;
  y: number;
  /** Rotation, deg. */
  angle: number;
  /** Vertical squash in screen space (lying flat on the lid). */
  squash: number;
  /** Horizontal scale in the particle's own frame: rolling over is 1 → -1 → 1. */
  roll: number;
  /** Overall size (1, shrinking as a snowflake melts). */
  size: number;
  opacity: number;
}

export const LANDER_HZ = 60;
const DT = 1 / LANDER_HZ;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The particle's rotation while it rests on a spot. */
export const restAngle = (style: LanderStyle, spot: LanderSpot) => style.restAngle * -spot.side;

/** The pose it rests in on a spot. */
export function restFrame(style: LanderStyle, spot: LanderSpot): LanderFrame {
  return {
    x: spot.x,
    y: style.restY,
    angle: restAngle(style, spot),
    squash: style.squash,
    roll: 1,
    size: 1,
    opacity: 1,
  };
}

/**
 * Drifting down onto the lid: a swing that dies away as it lands, a descent that slows to a
 * stop, and a last-moment flattening onto the lid's surface.
 */
export function landerFall(style: LanderStyle, spot: LanderSpot): LanderFrame[] {
  const n = Math.round(style.fall * LANDER_HZ);
  const w = (2 * Math.PI) / style.swing;
  const rest = restAngle(style, spot);
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const t = u * style.fall;
    const fade = (1 - u) ** 2;
    const phase = w * t + 0.4;
    const roll = style.roll
      ? mix(Math.cos((2 * Math.PI * t) / style.roll), 1, smooth(0.7, 0.95, u))
      : 1;
    return {
      x: spot.x + style.sway * fade * Math.sin(phase) - spot.side * 40 * fade,
      y:
        -230 + (style.restY + 230) * (1 - (1 - u) ** 1.7) - style.bob * fade * Math.sin(phase) ** 2,
      angle:
        rest +
        style.tilt * fade * Math.cos(phase) +
        style.spin * fade -
        spot.side * 3 * Math.sin(Math.PI * smooth(0.88, 1, u)),
      squash: mix(1, style.squash, smooth(0.9, 1, u)),
      roll,
      size: 1,
      opacity: smooth(0, 0.1, u),
    };
  });
}

/**
 * Leaving the lid on a simmer rattle. A leaf or petal slides down the slope, speeding up, and
 * tips off the rim to fall with gravity and air drag; a seed is lifted away by the steam.
 */
export function landerLeave(style: LanderStyle, spot: LanderSpot): LanderFrame[] {
  const rest = restFrame(style, spot);
  const frames: LanderFrame[] = [];
  if (style.kind === 'seed') {
    let { x, y } = rest;
    for (let t = 0; t <= 4.8; t += DT) {
      x += 34 * smooth(0, 1.6, t) * DT;
      y += (-150 * smooth(0, 1.6, t) - 18 * t) * DT;
      const s = smooth(0, 1, t);
      frames.push({
        ...rest,
        x: x + 12 * Math.sin(2.2 * t) * s,
        y,
        angle: rest.angle + 9 * Math.sin(2.2 * t + 1) * s,
        opacity: 1 - smooth(2.6, 4.8, t),
      });
    }
    return frames;
  }
  // Slide from rest to the rim with constant acceleration, reaching it after ~0.95s…
  const dx = spot.rimX - spot.x;
  const dy = spot.rimY - style.restY;
  const length = Math.hypot(dx, dy);
  const accel = (2 * length) / 0.95 ** 2;
  let x = rest.x;
  let y = rest.y;
  let vx = 0;
  let vy = 0;
  let angle = rest.angle;
  let spinRate = 0;
  let off = -1; // seconds since leaving the rim; negative while still sliding
  for (let t = 0; off < 1.8; t += DT) {
    const wasOff = off >= 0;
    if (!wasOff) {
      const s = 0.5 * accel * t * t;
      x = spot.x + (dx / length) * s;
      y = style.restY + (dy / length) * s;
      if (s >= length) {
        // …then carry the slide's velocity into the fall, so the speed doesn't jump.
        off = 0;
        vx = (dx / length) * accel * t;
        vy = (dy / length) * accel * t;
      } else {
        angle = rest.angle + spot.side * 6 * (s / length) ** 2;
      }
    } else {
      vy += (700 - 3.2 * vy) * DT;
      vx -= 3.2 * vx * DT;
      x += vx * DT;
      y += vy * DT;
      spinRate += (spot.side * 170 - spinRate) * 2.5 * DT;
      angle += spinRate * DT;
      off += DT;
    }
    const since = Math.max(off, 0);
    const roll = style.roll
      ? mix(1, Math.cos((2 * Math.PI * since) / style.roll), smooth(0.15, 0.6, since))
      : 1;
    frames.push({
      x: x + spot.side * 6 * Math.sin(3 * since) * smooth(0, 0.6, since),
      y,
      angle,
      squash: mix(style.squash, 1, smooth(0, 0.3, since)),
      roll,
      size: 1,
      opacity: 1 - smooth(0.6, 1.8, since),
    });
  }
  return frames;
}

/** A snowflake on the warm lid melts away where it lies. */
export function landerMelt(style: LanderStyle, spot: LanderSpot): LanderFrame[] {
  const rest = restFrame(style, spot);
  const n = Math.round(2.8 * LANDER_HZ);
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const p = u * u;
    return { ...rest, y: rest.y + 3 * p, size: 1 - 0.8 * p, opacity: 1 - smooth(0.15, 1, u) };
  });
}

/**
 * Knocked off by a tap on the pot: flung up and out as the lid jumps, spinning, then drifting
 * down. The kick eases in over the first 80ms, so it launches rather than teleports.
 */
export function landerFling(style: LanderStyle, spot: LanderSpot): LanderFrame[] {
  const rest = restFrame(style, spot);
  const frames: LanderFrame[] = [];
  let { x, y, angle } = rest;
  let vx = spot.side * 140;
  let vy = -380;
  let spinRate = spot.side * 520;
  const rolls = style.kind === 'maple' || style.kind === 'petal';
  for (let t = 0; t <= 1.8; t += DT) {
    const k = smooth(0, 0.08, t);
    vy += (700 - 2.2 * vy) * DT * k;
    vx -= 2.2 * vx * DT * k;
    x += vx * DT * k;
    y += vy * DT * k;
    spinRate += (spot.side * 120 - spinRate) * 1.5 * DT * k;
    angle += spinRate * DT * k;
    frames.push({
      x,
      y,
      angle,
      squash: mix(style.squash, 1, smooth(0, 0.15, t)),
      roll: rolls ? Math.cos((2 * Math.PI * t) / 0.5) : 1,
      size: 1,
      opacity: 1 - smooth(0.9, 1.8, t),
    });
  }
  return frames;
}

/** A frame as a CSS transform (viewBox units in an SVG group). */
export function landerTransform(f: LanderFrame): string {
  const n = (v: number, places = 2) => v.toFixed(places);
  return (
    `translate(${n(f.x)}px, ${n(f.y)}px) scale(${n(f.size, 3)}, ${n(f.size * f.squash, 3)}) ` +
    `rotate(${n(f.angle)}deg) scale(${n(f.roll, 3)}, 1)`
  );
}

/**
 * Milliseconds until the lid next starts to rattle, but at least `min`. The simmer animation
 * rattles at the start of each cycle, after an initial delay.
 */
export function msUntilRattle(
  currentTime: number,
  cycle: number,
  delay: number,
  min: number,
): number {
  const phase = (((currentTime - delay) % cycle) + cycle) % cycle;
  let wait = (cycle - phase) % cycle;
  while (wait < min) wait += cycle;
  return wait;
}
