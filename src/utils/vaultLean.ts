/**
 * The Recipe Box's cards lean back as they slip under the pinned tab, driven by the scroll
 * (index.css, vault-card-lean). While a page change runs, that lean is switched off: WebKit's page
 * process crashed snapshotting a scrolled box of leaning cards. Switched off alone, the card under
 * the tab stood upright for the change and fell back once it was over, a visible jolt as the Box
 * came and went. So for the change, each card is held still in the pose the scroll gives it: the
 * one or two on the lean as a plain transform, those already past it (behind the pinned bar)
 * simply hidden, which is how they look under the bar anyway.
 */

/** The lean's end pose for each layout, as in index.css (@keyframes vault-card-lean, -soft). */
export const LEAN_POSES = {
  list: { perspective: 600, angle: 46, opacity: 0.2 },
  cards: { perspective: 900, angle: 20, opacity: 0.5 },
} as const;

/** How far below the line a card begins to lean, in rem (index.css: `animation-range: exit -1.9rem`). */
export const LEAN_LEAD_REM = 1.9;

export type LeanLayout = keyof typeof LEAN_POSES;

/**
 * How far into its lean a card is, from 0 (upright) to 1 (fully back): the card's view timeline
 * from `lead` px before its top reaches `line` until its bottom passes it. `top` is the card's top
 * on screen, `line` the timeline's top inset.
 */
export function leanProgress(top: number, height: number, line: number, lead: number): number {
  const span = height + lead;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (line + lead - top) / span));
}

/**
 * A card's pose `progress` of the way into its lean (the keyframes are linear in its angle): the
 * lean's own 3D turn, or, `flat`, its picture from the front. WebKit's page process crashes
 * snapshotting a page with any card turned in 3D, even one, so there the card is squashed towards
 * its bottom edge by as much as the turn shortens the part still showing below the line (`shown`
 * px of it, from its bottom). Up and down that part matches the turn to within a pixel; the turn
 * also narrows it a little towards the line, which a flat transform can't, so its sides settle
 * by a few pixels as the lean takes over again.
 */
export function leanPose(
  progress: number,
  layout: LeanLayout,
  shown: number,
  flat: boolean,
): { transform: string; opacity: string } {
  const { perspective, angle, opacity } = LEAN_POSES[layout];
  const degrees = angle * progress;
  let transform = `perspective(${perspective}px) rotateX(${+degrees.toFixed(3)}deg)`;
  if (flat) {
    const turn = (degrees / 180) * Math.PI;
    // Where the point `shown` px up from the bottom edge lands once turned (in perspective, from
    // that edge), as a share of `shown`.
    const reach = Math.max(shown, 1);
    const squash = (Math.cos(turn) * perspective) / (perspective + reach * Math.sin(turn));
    transform = `scale(1, ${+squash.toFixed(4)})`;
  }
  return { transform, opacity: String(+(1 - (1 - opacity) * progress).toFixed(4)) };
}

// The cards that lean: the Box page's, except each section's last, which carries its tab away.
const LEANING = '#viewGrid .vault-box .vault-group > .vault-slot:not(:last-child)';

let held: HTMLElement[] = [];

const leans = () =>
  typeof CSS !== 'undefined' &&
  !!CSS.supports?.('animation-timeline', 'view()') &&
  !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/**
 * Safari's engine: every browser on an iPhone (Chrome there says CriOS) and Safari on a Mac. The
 * crash can't be detected any other way than by having it, so the engine is told by its name.
 */
export function isWebKit(userAgent: string): boolean {
  return /AppleWebKit/.test(userAgent) && !/Chrome\/|Chromium\/|Edg\//.test(userAgent);
}

/**
 * Holds every leaning card in the Box still, in the pose the scroll gives it now, until
 * releaseLean. Called as a page change starts, and again once the new page is in place, so both
 * of its snapshots show the cards as they look outside it. Replaces whatever was held before.
 * The lean must already be off (data-nav set), so the cards are measured upright.
 */
export function holdLean(): void {
  releaseLean();
  if (!leans()) return;
  const slots = [...document.querySelectorAll<HTMLElement>(LEANING)];
  if (slots.length === 0) return;
  const box = slots[0].closest('.vault-box');
  if (!box) return;
  // Where the lean happens: the pinned title and tab's height below the top (index.css).
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;width:0;' +
    'height:calc(var(--vault-bar-title) + var(--vault-shelf-height))';
  box.append(probe);
  const line = probe.getBoundingClientRect().height;
  probe.remove();
  const lead =
    LEAN_LEAD_REM * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  const layout: LeanLayout = box.classList.contains('is-cards') ? 'cards' : 'list';
  const flat = isWebKit(navigator.userAgent);
  for (const slot of slots) {
    const { top, height } = slot.getBoundingClientRect();
    if (height === 0) continue;
    const progress = leanProgress(top, height, line, lead);
    if (progress === 0) continue;
    if (progress === 1) {
      slot.style.visibility = 'hidden';
    } else {
      const pose = leanPose(progress, layout, Math.min(height, top + height - line), flat);
      slot.style.transform = pose.transform;
      slot.style.opacity = pose.opacity;
    }
    held.push(slot);
  }
}

/** Lets the held cards go: the scroll drives their lean again, from the same pose. */
export function releaseLean(): void {
  for (const slot of held) {
    slot.style.removeProperty('visibility');
    slot.style.removeProperty('transform');
    slot.style.removeProperty('opacity');
  }
  held = [];
}
