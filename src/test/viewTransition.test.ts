import { describe, it, expect, vi, afterEach } from 'vitest';
import { transitionTheme, transitionView } from '../utils/viewTransition';

const root = document.documentElement;

/** A stand-in for the browser's view transition, finishing when the test says so. */
function fakeViewTransitions() {
  const finishers: (() => void)[] = [];
  const start = vi.fn((update: () => void) => {
    update();
    const finished = new Promise<void>((resolve) => finishers.push(resolve));
    return { finished } as unknown as ViewTransition;
  });
  document.startViewTransition = start as unknown as typeof document.startViewTransition;
  return { start, finish: (i: number) => finishers[i]() };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('transitionView', () => {
  afterEach(() => {
    // jsdom has no view transitions; put it back as it was.
    Reflect.deleteProperty(document, 'startViewTransition');
    delete root.dataset.nav;
    delete root.dataset.morph;
  });

  it('just applies the change where view transitions are unsupported', () => {
    const update = vi.fn();
    transitionView(update, { motion: 'forward', morph: 'recipe' });
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.nav).toBeUndefined();
  });

  it('marks how the page moves and what morphs, until the transition ends', async () => {
    const { start, finish } = fakeViewTransitions();
    const update = vi.fn();
    transitionView(update, { motion: 'back', morph: 'recipe' });

    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.nav).toBe('back');
    expect(root.dataset.morph).toBe('recipe');

    finish(0);
    await settle();
    expect(root.dataset.nav).toBeUndefined();
    expect(root.dataset.morph).toBeUndefined();
  });

  it('skips the animation when the browser already animated the gesture', () => {
    const { start } = fakeViewTransitions();
    const update = vi.fn();
    transitionView(update, { motion: 'back', animated: false });
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });

  it("keeps a newer transition's markers when an interrupted one ends", async () => {
    const { finish } = fakeViewTransitions();
    transitionView(() => {}, { motion: 'forward', morph: 'recipe' });
    transitionView(() => {}, { motion: 'zoom', morph: 'photo' });

    finish(0);
    await settle();
    expect(root.dataset.nav).toBe('zoom');
    expect(root.dataset.morph).toBe('photo');
  });
});

describe('transitionTheme', () => {
  const origin = { x: 100, y: 200 };

  /** Browser view transitions that are ready at once and finish when the test says so. */
  function fakeThemeTransition() {
    const finishers: (() => void)[] = [];
    const start = vi.fn((update: () => void) => {
      update();
      const finished = new Promise<void>((resolve) => finishers.push(resolve));
      return { ready: Promise.resolve(), finished } as unknown as ViewTransition;
    });
    document.startViewTransition = start as unknown as typeof document.startViewTransition;
    // jsdom has no Web Animations; the default cross-fade is one to cancel.
    const crossFade = { effect: { pseudoElement: '::view-transition-old(root)' }, cancel: vi.fn() };
    document.getAnimations = vi.fn(() => [crossFade] as unknown as Animation[]);
    const animate = vi.fn();
    root.animate = animate;
    return { start, animate, crossFade, finish: (i = 0) => finishers[i]() };
  }

  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    Reflect.deleteProperty(document, 'getAnimations');
    Reflect.deleteProperty(root, 'animate');
    Reflect.deleteProperty(window, 'matchMedia');
    delete root.dataset.themeSwap;
  });

  it('just switches where view transitions are unsupported', () => {
    const update = vi.fn();
    transitionTheme(update, origin);
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.themeSwap).toBeUndefined();
  });

  it('just switches when the viewer prefers less motion', () => {
    const { start } = fakeThemeTransition();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const update = vi.fn();

    transitionTheme(update, origin);

    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });

  it('spreads the new theme in a circle from the tapped control', async () => {
    const { start, animate, crossFade, finish } = fakeThemeTransition();
    const update = vi.fn();

    transitionTheme(update, origin);
    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.themeSwap).toBe('');

    await settle();
    expect(crossFade.cancel).toHaveBeenCalled();
    expect(animate).toHaveBeenCalledWith(
      {
        clipPath: [
          'circle(0px at 100px 200px)',
          expect.stringMatching(/^circle\([\d.]+px at 100px 200px\)$/),
        ],
      },
      expect.objectContaining({ pseudoElement: '::view-transition-new(root)' }),
    );

    finish();
    await settle();
    expect(root.dataset.themeSwap).toBeUndefined();
  });

  it("keeps a newer switch's marker when a quick second tap skips the first", async () => {
    const { finish } = fakeThemeTransition();
    transitionTheme(() => {}, origin);
    transitionTheme(() => {}, origin);

    // The skipped first switch ends while the second is still spreading.
    finish(0);
    await settle();
    expect(root.dataset.themeSwap).toBe('');

    finish(1);
    await settle();
    expect(root.dataset.themeSwap).toBeUndefined();
  });
});
