import { describe, it, expect, vi, afterEach } from 'vitest';
import { lockPageScroll } from '../utils/scrollLock';
import { transitionView } from '../utils/viewTransition';

/** A stand-in for the browser's view transition: the change runs a moment later, as in a browser. */
function fakeViewTransitions() {
  const finishers: (() => void)[] = [];
  document.startViewTransition = ((update: () => void) => {
    const changed = Promise.resolve().then(update);
    const finished = changed.then(() => new Promise<void>((resolve) => finishers.push(resolve)));
    return { ready: changed, finished, updateCallbackDone: changed } as unknown as ViewTransition;
  }) as unknown as typeof document.startViewTransition;
  return { finish: (i: number) => finishers[i]() };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const overflow = () => document.body.style.overflow;

describe('lockPageScroll', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    document.body.style.overflow = '';
  });

  it('stops the page scrolling until let go', async () => {
    const release = lockPageScroll();
    expect(overflow()).toBe('hidden');
    release();
    await settle();
    expect(overflow()).toBe('');
  });

  // Regression: WebKit's page process crashed when closing a photo, as the page became
  // scrollable again in the middle of the closing view transition.
  it('keeps the page locked until the transition letting go of it has finished', async () => {
    const { finish } = fakeViewTransitions();
    const release = lockPageScroll();
    transitionView(release, { motion: 'zoom', morph: 'photo' });
    await settle();
    expect(overflow()).toBe('hidden');

    finish(0);
    await settle();
    expect(overflow()).toBe('');
  });

  it('waits out a newer transition that cut the closing one short', async () => {
    const { finish } = fakeViewTransitions();
    const release = lockPageScroll();
    transitionView(release, { motion: 'zoom', morph: 'photo' });
    await settle();
    // Back tapped while the photo is still shrinking.
    transitionView(() => {}, { motion: 'back' });
    await settle();
    finish(0);
    await settle();
    expect(overflow()).toBe('hidden');

    finish(1);
    await settle();
    expect(overflow()).toBe('');
  });

  it('stays locked while another lock is held, and lets go once per lock', async () => {
    const first = lockPageScroll();
    const second = lockPageScroll();
    first();
    first();
    await settle();
    expect(overflow()).toBe('hidden');
    second();
    await settle();
    expect(overflow()).toBe('');
  });

  it('lets go at once where nothing animates', async () => {
    const release = lockPageScroll();
    const done = vi.fn();
    transitionView(release, { motion: 'zoom', animated: false, onFinished: done });
    await settle();
    expect(done).toHaveBeenCalledOnce();
    expect(overflow()).toBe('');
  });
});
