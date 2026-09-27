import { flushSync } from 'react-dom';
import { canNestMorphs, uncropMorphPhotos } from './photoMorph';

/**
 * How a view change moves, read by the `::view-transition` rules in index.css:
 * - forward: into a sub-page (a recipe, Settings), which slides in from the right
 * - back: out of one, sliding back to the left
 * - fade: between main pages, or pages at the same depth
 * - zoom: a photo opening over the page, or closing
 */
export type NavMotion = 'forward' | 'back' | 'fade' | 'zoom';

/**
 * A photo that morphs between its old and new place: a recipe card's photo and the
 * recipe's hero, or a step photo and the full-screen viewer.
 */
export type Morph = 'recipe' | 'photo';

interface Options {
  motion: NavMotion;
  morph?: Morph;
  /** False when the browser already animated it (the iOS back swipe draws its own). */
  animated?: boolean;
}

let current: ViewTransition | null = null;

/**
 * Runs a React state change as an animated view transition where the browser supports
 * one; elsewhere the change simply happens. The update is flushed synchronously so the
 * browser snapshots the new view, not a half-rendered one.
 */
export function transitionView(update: () => void, { motion, morph, animated = true }: Options) {
  if (!animated || !document.startViewTransition) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = motion;
  if (morph) root.dataset.morph = morph;
  else delete root.dataset.morph;

  // The recipe photo morphs uncropped at both ends (see utils/photoMorph).
  const uncrop = morph === 'recipe' && canNestMorphs();
  const restore: (() => void)[] = uncrop ? [uncropMorphPhotos()] : [];
  const transition = document.startViewTransition(() => {
    flushSync(update);
    if (uncrop) restore.push(uncropMorphPhotos());
  });
  current = transition;
  const cleanUp = () => {
    for (const undo of restore) undo();
    // A newer transition skips this one; its markers belong to the newer one now.
    if (current !== transition) return;
    current = null;
    delete root.dataset.nav;
    delete root.dataset.morph;
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

const noop = () => {};

/**
 * How long until the recipe photo lands in its new place, in ms from now: when the morph has
 * mostly settled, so what follows it can start. 0 when no photo is morphing.
 */
export function recipePhotoLandsIn(settled = 0.6): number {
  if (!document.getAnimations) return 0;
  const flight = document.getAnimations().find((animation) => {
    const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement;
    return (
      pseudo === '::view-transition-group(recipe-frame)' ||
      pseudo === '::view-transition-group(recipe-photo)'
    );
  });
  const timing = flight?.effect?.getComputedTiming();
  if (!flight || !timing || typeof timing.endTime !== 'number') return 0;
  return Math.max(0, timing.endTime * settled - Number(flight.currentTime ?? 0));
}

/** Whether the viewer asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

let currentThemeSwap: ViewTransition | null = null;

/**
 * Switches the theme with the new colours spreading out in a circle from `origin` (the centre
 * of the control that was tapped, in viewport pixels). Where view transitions are unsupported,
 * or motion is reduced, the theme simply switches.
 */
export function transitionTheme(update: () => void, origin: { x: number; y: number }) {
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
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 700,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
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
