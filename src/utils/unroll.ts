/**
 * A recipe unrolls down out of its photo like a scroll of paper: a roll travels down the page
 * and the recipe appears above it. Going back, it rolls up into the photo again. Positions are
 * in px from the top of the recipe's body (under the photo); the edge of the paper is at the
 * roll's centre line. Only clip-path, transform and opacity move, so it all runs on the
 * compositor.
 */

// Timing. A long way down takes a little longer, as a real roll would, within limits.
export const unrollDuration = (distance: number) =>
  Math.round(Math.min(820, Math.max(520, 460 + distance * 0.34)));
export const rollUpDuration = (distance: number) =>
  Math.round(Math.min(460, Math.max(280, 240 + distance * 0.16)));

// Unrolls with a gentle start (it follows the photo's landing) and a long, soft stop.
export const UNROLL_EASING = 'cubic-bezier(0.38, 0.1, 0.12, 1)';
// Rolls up quickly, braking just as it tucks under the photo.
export const ROLL_UP_EASING = 'cubic-bezier(0.55, 0, 0.2, 1)';

/** How much of the body shows: everything above `edge` (it may sit above the body's top). */
export const revealClip = (edge: number) => `inset(0 0 calc(100% - ${Math.round(edge)}px) 0)`;

export function revealKeyframes(from: number, to: number): Keyframe[] {
  return [{ clipPath: revealClip(from) }, { clipPath: revealClip(to) }];
}

/**
 * The roll itself: it thins as paper comes off it, and shows only while it's out from under
 * the photo. `tucked` is where it hides, just under the photo's bottom edge.
 */
export function rollKeyframes(from: number, to: number, tucked: number): Keyframe[] {
  const unrolling = to > from;
  const at = (edge: number, thickness: number) =>
    `translateY(${Math.round(edge)}px) scaleY(${thickness})`;
  const full = 1;
  const thin = 0.62;
  if (unrolling) {
    return [
      { transform: at(from, full), opacity: from <= tucked ? 0 : 1 },
      { transform: at(from + (to - from) * 0.06, full * 0.98), opacity: 1, offset: 0.06 },
      { transform: at(to, thin), opacity: 1 },
    ];
  }
  return [
    { transform: at(from, thin), opacity: 1 },
    { transform: at(to + (from - to) * 0.05, full * 0.98), opacity: 1, offset: 0.95 },
    { transform: at(to, full), opacity: to <= tucked ? 0 : 1 },
  ];
}
