import { flushSync } from 'react-dom';
import { holdLean, releaseLean } from './vaultLean';

/**
 * How a view change moves, read by the `::view-transition` rules in index.css:
 * - forward: into a sub-page (a recipe, Settings), which slides in from the right
 * - back: out of one, sliding back to the left
 * - fade: between main pages, or pages at the same depth
 * - side-next / side-prev: a main page chosen on the navigation island, sliding in from the side
 *   its tab sits on (next: from the right)
 * - hop: from one recipe to another (a remix popover's link): the new page fades up over the old
 * - to-box: from a make's recipe link to the recipe's card in the Recipe Box; to-makes: back from
 *   that recipe to Makes, its name flying back into the link
 * - menu: a page chosen from the open menu, cross-fading under its blurring scrim as it clears
 * - zoom: a photo opening over the page, or closing
 * - vault: the vault's recipes re-filtered or re-sorted, gliding to their new places
 * - flip-open: a recipe card lifted out of the box flips over, and the recipe unfolds from its
 *   back; flip-close folds the recipe away and the card flips back into its place (setFlipAxis)
 * - window-open: one of My Counter's windows opens out into its page (the Recipe Box, Makes),
 *   what it shows gliding to its place there; window-close folds the page back into the window
 *   (setWindowRect, nameGlide)
 */
export type NavMotion =
  | 'forward'
  | 'back'
  | 'fade'
  | 'side-next'
  | 'side-prev'
  | 'hop'
  | 'to-box'
  | 'to-makes'
  | 'menu'
  | 'zoom'
  | 'vault'
  | 'flip-open'
  | 'flip-close'
  | 'window-open'
  | 'window-close';

/**
 * What morphs between its old and new place: a step photo and the full-screen viewer, or a
 * recipe's name tapped in a remix popover and the title of the recipe it opens.
 */
export type Morph = 'photo' | 'title';

interface Options {
  motion: NavMotion;
  morph?: Morph;
  /** False when the browser already animated it (the iOS back swipe draws its own). */
  animated?: boolean;
  /** Once it has finished (at once where nothing animates). */
  onFinished?: () => void;
  /**
   * Once it has finished or been cut short by another (onFinished is left to the newer one):
   * undoes what was set up for this one alone, such as names given to elements.
   */
  always?: () => void;
}

let current: ViewTransition | null = null;

/**
 * Runs a React state change as an animated view transition where the browser supports
 * one; elsewhere the change simply happens. The update is flushed synchronously so the
 * browser snapshots the new view, not a half-rendered one.
 */
export function transitionView(
  update: () => void,
  { motion, morph, animated = true, onFinished, always }: Options,
) {
  if (!animated || !document.startViewTransition) {
    update();
    always?.();
    onFinished?.();
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = motion;
  // The Box's leaning cards hold their pose while the lean is off (utils/vaultLean), measured
  // upright, as the lean leaves them in this same frame.
  holdLean();
  if (morph) root.dataset.morph = morph;
  else delete root.dataset.morph;

  const restore: (() => void)[] = always ? [always] : [];
  const vault = motion === 'vault';
  const before = vault ? nameVaultItems() : null;
  if (before) restore.push(before.clear);
  const transition = document.startViewTransition(() => {
    flushSync(update);
    holdLean();
    if (before) restore.push(nameVaultItems(before.keys).clear);
  });
  current = transition;
  // A transition cut short (another one starting, the viewport resizing) rejects `ready`; the
  // page has still changed, and `finished` below tidies up either way.
  transition.ready.catch(noop);
  const cleanUp = () => {
    for (const undo of restore) undo();
    // A newer transition skips this one; its markers belong to the newer one now.
    if (current !== transition) return;
    current = null;
    releaseLean();
    delete root.dataset.nav;
    delete root.dataset.morph;
    root.style.removeProperty('--flip-y');
    for (const side of WINDOW_SIDES) root.style.removeProperty(`--win-${side}`);
    onFinished?.();
  };
  void transition.finished.then(cleanUp, cleanUp);
}

/**
 * Resolves once the page transition under way (if any) starts animating, so motion inside the
 * new page can be timed against it. Resolves at once when nothing is running.
 */
export function transitionStarted(): Promise<void> {
  return current ? current.ready.then(noop, noop) : Promise.resolve();
}

/**
 * Resolves once no page transition is under way: the one running has finished, and so has any
 * that cut it short. Resolves at once when nothing is running.
 */
export async function transitionFinished(): Promise<void> {
  // Each one's own tidying up (transitionView) runs first, clearing `current` unless a newer
  // transition has taken over.
  while (current) await current.finished.then(noop, noop);
}

const noop = () => {};

/**
 * Where a recipe card flips (index.css, the flip motions): around the line through its middle.
 * The recipe unfolds from, and folds back onto, that line. Returns false, setting nothing, when
 * the card is off screen, where a flip would never be seen.
 */
export function setFlipAxis(card: Element | null): boolean {
  if (!card || !isOnScreen(card)) return false;
  const { top, height } = card.getBoundingClientRect();
  document.documentElement.style.setProperty('--flip-y', `${Math.round(top + height / 2)}px`);
  return true;
}

const WINDOW_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/**
 * Where a window of My Counter is on screen (index.css, the window motions): its page opens out
 * of it, or folds back into it. Returns false, setting nothing, when it isn't on screen.
 */
export function setWindowRect(win: Element | null): boolean {
  if (!win || !isOnScreen(win)) return false;
  const { top, right, bottom, left } = win.getBoundingClientRect();
  const inset = {
    top,
    right: window.innerWidth - right,
    bottom: window.innerHeight - bottom,
    left,
  };
  const root = document.documentElement;
  for (const side of WINDOW_SIDES) {
    root.style.setProperty(`--win-${side}`, `${Math.round(inset[side])}px`);
  }
  return true;
}

/**
 * The window a page opens out of (index.css, window-open), taken on its own so what it showed
 * clears before the page's text comes up inside it. Returns a function that takes the name away.
 */
export function nameOpeningWindow(win: Element | null): () => void {
  return nameTransitionPart(win, 'opening-window');
}

/**
 * Gives an element a view transition name of its own, for the next transition. Returns a
 * function that takes the name away again, unless it has been given another one since.
 */
export function nameTransitionPart(el: Element | null, name: string): () => void {
  if (!(el instanceof HTMLElement)) return noop;
  el.style.setProperty('view-transition-name', name);
  return () => {
    if (el.style.getPropertyValue('view-transition-name') !== name) return;
    el.style.removeProperty('view-transition-name');
  };
}

/**
 * Names an element so it glides on its own in the next view transition, between it and the
 * element given the same name on the other page: a recipe's name or photo, or a make's photo
 * (index.css, the glide classes). Returns a function that takes the name away again.
 */
export function nameGlide(el: Element | null, name: string, kind: 'name' | 'photo'): () => void {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return noop;
  el.style.setProperty('view-transition-name', name);
  el.style.setProperty('view-transition-class', `glide-${kind}`);
  return () => {
    if (el.style.getPropertyValue('view-transition-name') !== name) return;
    el.style.removeProperty('view-transition-name');
    el.style.removeProperty('view-transition-class');
  };
}

/** Whether the viewer asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

let currentThemeSwap: ViewTransition | null = null;

type Point = { x: number; y: number };

// How much of the spreading circle's radius is its soft edge, where the old and new colours
// blend into each other instead of meeting at a hard line.
const THEME_FEATHER = 0.45;
const THEME_SPREAD_MS = 1300;
// Eases in and settles slowly, spreading evenly rather than bursting out: a wash, not a wipe.
const THEME_SPREAD_EASING = 'cubic-bezier(0.45, 0.05, 0.3, 1)';

/**
 * The new theme's spread as keyframes: a radial mask, solid in the middle and fading out
 * smoothly over its edge, that grows from nothing at `origin` until its solid middle covers the
 * farthest corner of a `width` × `height` screen.
 */
export function themeSpreadKeyframes({ x, y }: Point, width: number, height: number): Keyframe[] {
  const reach = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const size = Math.ceil((2 * reach) / (1 - THEME_FEATHER));
  // The edge fades along a smoothstep, so it has no visible start or end.
  const solid = (1 - THEME_FEATHER) * 100;
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const alpha = 1 - t * t * (3 - 2 * t);
    return `rgb(0 0 0 / ${alpha.toFixed(3)}) ${(solid + t * THEME_FEATHER * 100).toFixed(1)}%`;
  });
  const maskImage = `radial-gradient(closest-side, ${stops.join(', ')})`;
  return [
    { maskImage, maskRepeat: 'no-repeat', maskSize: '0px 0px', maskPosition: `${x}px ${y}px` },
    {
      maskImage,
      maskRepeat: 'no-repeat',
      maskSize: `${size}px ${size}px`,
      maskPosition: `${x - size / 2}px ${y - size / 2}px`,
    },
  ];
}

/** Whether masks are understood unprefixed (older engines get a plain growing circle). */
const canMask = () =>
  typeof CSS !== 'undefined' && !!CSS.supports?.('mask-image', 'radial-gradient(#000, #0000)');

/**
 * Switches the theme with the new colours washing out in a soft-edged circle from `origin` (the
 * centre of the control that was tapped, in viewport pixels). Where view transitions are
 * unsupported, or motion is reduced, the theme simply switches.
 */
export function transitionTheme(update: () => void, origin: Point) {
  if (!document.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.themeSwap = '';
  const transition = document.startViewTransition(() => flushSync(update));
  currentThemeSwap = transition;
  const { x, y } = origin;
  void transition.ready.then(
    () => {
      // The circle replaces the default cross-fade. Cancelling it here works wherever view
      // transitions do, without relying on CSS reaching the pseudo-elements.
      for (const animation of document.getAnimations()) {
        const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement;
        if (pseudo?.startsWith('::view-transition')) animation.cancel();
      }
      const timing: KeyframeAnimationOptions = {
        duration: THEME_SPREAD_MS,
        easing: THEME_SPREAD_EASING,
        fill: 'both',
        pseudoElement: '::view-transition-new(root)',
      };
      if (canMask()) {
        root.animate(themeSpreadKeyframes(origin, window.innerWidth, window.innerHeight), timing);
        return;
      }
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        timing,
      );
    },
    // Skipped (e.g. another transition started): the theme has still switched.
    () => {},
  );
  const cleanUp = () => {
    // A quick second tap skips this switch; the marker belongs to the newer one now.
    if (currentThemeSwap !== transition) return;
    currentThemeSwap = null;
    delete root.dataset.themeSwap;
  };
  void transition.finished.then(cleanUp, cleanUp);
}

/** Whether any of the element is on screen, so a morph to or from it would be seen. */
export function isOnScreen(el: Element | null): boolean {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
}

/** Which naming pass last named each recipe, so an older pass never clears a newer one's names. */
const vaultNamer = new WeakMap<HTMLElement, object>();

/**
 * Names the vault's recipes on or near the screen for a view transition, so each glides from
 * where it was to where it lands in the new order. A filter or sort keeps every recipe's shape,
 * so each glides whole. The rest fade with the page, which keeps a large vault cheap to snapshot.
 * (Switching between cards and list deals the cards instead: RecipeGridView.)
 *
 * Called again after the change with the recipes named before it (`keys`): on a filter or sort,
 * those that were there already look the same at both ends, so they are marked vault-kept and
 * glide as they are, with nothing to cross-fade. Returns the recipes named and a function that
 * removes the names again, except where a later change has named one since: a change that
 * interrupts another names the same elements before the first one's clean-up runs.
 */
export function nameVaultItems(before?: ReadonlySet<string>): {
  keys: Set<string>;
  clear: () => void;
} {
  const keys = new Set<string>();
  const named: HTMLElement[] = [];
  const pass = {};
  const margin = window.innerHeight * 0.25;
  for (const item of document.querySelectorAll<HTMLElement>('[data-vault-item]')) {
    const { top, bottom } = item.getBoundingClientRect();
    const key = item.dataset.vaultItem;
    if (!key || bottom < -margin || top > window.innerHeight + margin) continue;
    keys.add(key);
    const kept = before?.has(key) ? ' vault-kept' : '';
    item.style.setProperty('view-transition-name', `vault-item-${key}`);
    item.style.setProperty('view-transition-class', `vault-item${kept}`);
    vaultNamer.set(item, pass);
    named.push(item);
  }
  const clear = () => {
    for (const el of named) {
      if (vaultNamer.get(el) !== pass) continue;
      vaultNamer.delete(el);
      el.style.removeProperty('view-transition-name');
      el.style.removeProperty('view-transition-class');
    }
  };
  return { keys, clear };
}

/** A recipe id as a view transition name can carry it. */
export function vaultItemKey(id: string): string {
  return id.replace(/[^\w-]/g, '_');
}
