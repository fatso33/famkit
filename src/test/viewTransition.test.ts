import { describe, it, expect, vi, afterEach } from 'vitest';
import { transitionView } from '../utils/viewTransition';

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
