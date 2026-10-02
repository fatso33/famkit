import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  setFlipAxis,
  themeSpreadKeyframes,
  transitionTheme,
  transitionView,
  vaultItemKey,
} from '../utils/viewTransition';

const root = document.documentElement;

/** A stand-in for the browser's view transition, finishing when the test says so. */
function fakeViewTransitions() {
  const finishers: (() => void)[] = [];
  const start = vi.fn((update: () => void) => {
    update();
    const finished = new Promise<void>((resolve) => finishers.push(resolve));
    return { ready: Promise.resolve(), finished } as unknown as ViewTransition;
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
    transitionView(update, { motion: 'forward' });
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.nav).toBeUndefined();
  });

  it('marks how the page moves and what morphs, until the transition ends', async () => {
    const { start, finish } = fakeViewTransitions();
    const update = vi.fn();
    transitionView(update, { motion: 'zoom', morph: 'photo' });

    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.nav).toBe('zoom');
    expect(root.dataset.morph).toBe('photo');

    finish(0);
    await settle();
    expect(root.dataset.nav).toBeUndefined();
    expect(root.dataset.morph).toBeUndefined();
  });

  it('leaves no unhandled rejection when a transition is cut short', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    // The browser rejects `ready` when a transition aborts (e.g. "Viewport size changed").
    const start = vi.fn((update: () => void) => {
      update();
      return {
        ready: Promise.reject(new DOMException('Transition was aborted', 'AbortError')),
        finished: Promise.resolve(),
      } as unknown as ViewTransition;
    });
    document.startViewTransition = start as unknown as typeof document.startViewTransition;
    const done = vi.fn();
    transitionView(() => {}, { motion: 'forward', onFinished: done });
    await settle();
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledOnce();
    expect(root.dataset.nav).toBeUndefined();
  });

  it('says when it has finished: once it ends, or at once where nothing animates', async () => {
    const done = vi.fn();
    transitionView(() => {}, { motion: 'forward', onFinished: done });
    expect(done).toHaveBeenCalledOnce();

    const { finish } = fakeViewTransitions();
    const later = vi.fn();
    transitionView(() => {}, { motion: 'flip-open', onFinished: later });
    expect(later).not.toHaveBeenCalled();
    finish(0);
    await settle();
    expect(later).toHaveBeenCalledOnce();
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
    transitionView(() => {}, { motion: 'forward' });
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
    vi.unstubAllGlobals();
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

  it('washes the new theme out from the tapped control in a soft-edged circle', async () => {
    vi.stubGlobal('CSS', { supports: () => true });
    const { start, animate, crossFade, finish } = fakeThemeTransition();
    const update = vi.fn();

    transitionTheme(update, origin);
    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.themeSwap).toBe('');

    await settle();
    expect(crossFade.cancel).toHaveBeenCalled();
    expect(animate).toHaveBeenCalledWith(
      themeSpreadKeyframes(origin, window.innerWidth, window.innerHeight),
      expect.objectContaining({
        pseudoElement: '::view-transition-new(root)',
        // Unhurried: the first version's quick hard-edged wipe felt abrupt.
        duration: expect.toSatisfy((ms: number) => ms >= 1000),
      }),
    );

    finish();
    await settle();
    expect(root.dataset.themeSwap).toBeUndefined();
  });

  it('grows from nothing at the control until its solid middle covers every corner', () => {
    const [from, to] = themeSpreadKeyframes({ x: 300, y: 100 }, 400, 800);
    expect(from).toMatchObject({ maskSize: '0px 0px', maskPosition: '300px 100px' });

    const size = parseFloat(String(to.maskSize));
    const [left, top] = String(to.maskPosition).split(' ').map(parseFloat);
    // Centred on the control.
    expect(left + size / 2).toBeCloseTo(300);
    expect(top + size / 2).toBeCloseTo(100);
    // Fully opaque out to the farthest corner (bottom left), then a soft edge beyond.
    const mask = String(to.maskImage);
    const solidPercent = parseFloat(/rgb\(0 0 0 \/ 1\.000\) ([\d.]+)%/.exec(mask)![1]);
    expect(((size / 2) * solidPercent) / 100).toBeGreaterThanOrEqual(Math.hypot(300, 700) - 1);
    expect(mask).toMatch(/rgb\(0 0 0 \/ 0\.000\) 100\.0%\)$/);
  });

  it('falls back to a plain growing circle where masks are unsupported', async () => {
    vi.stubGlobal('CSS', { supports: () => false });
    const { animate } = fakeThemeTransition();
    transitionTheme(() => {}, origin);
    await settle();
    expect(animate).toHaveBeenCalledWith(
      {
        clipPath: [
          'circle(0px at 100px 200px)',
          expect.stringMatching(/^circle\([\d.]+px at 100px 200px\)$/),
        ],
      },
      expect.objectContaining({ pseudoElement: '::view-transition-new(root)' }),
    );
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

describe('vault transitions', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    document.body.innerHTML = '';
    delete root.dataset.nav;
  });

  const item = (id: string) => {
    const card = document.createElement('div');
    card.dataset.vaultItem = vaultItemKey(id);
    card.innerHTML = '<div data-vault-photo></div><h3 data-vault-name>x</h3>';
    document.body.appendChild(card);
    return card;
  };

  const namesDuring = (card: HTMLElement) => {
    let during: string[] = [];
    transitionView(
      () => {
        during = [card, ...card.children].map((el) =>
          (el as HTMLElement).style.getPropertyValue('view-transition-name'),
        );
      },
      { motion: 'vault' },
    );
    return during;
  };

  // A filter or sort keeps every card's shape, so each glides whole: a third of the
  // animations, which kept the glide from dropping frames on a slow phone.
  it('names only the recipe itself when it is re-filtered or re-sorted, and clears it after', async () => {
    const { finish } = fakeViewTransitions();
    const card = item('babka');
    expect(namesDuring(card)).toEqual(['vault-item-babka', '', '']);
    expect(root.dataset.nav).toBe('vault');

    finish(0);
    await settle();
    expect(card.style.getPropertyValue('view-transition-name')).toBe('');
    expect(root.dataset.nav).toBeUndefined();
  });

  it('lets a recipe that stays glide as it is, while one that arrives fades in', () => {
    fakeViewTransitions();
    const card = item('babka');
    let arriving = card;
    transitionView(() => (arriving = item('zurek')), { motion: 'vault' });
    // The new view's names, as the transition runs. Kept: no cross-fade (index.css).
    const kind = (el: HTMLElement) => el.style.getPropertyValue('view-transition-class');
    expect(kind(card)).toBe('vault-item vault-kept');
    expect(kind(arriving)).toBe('vault-item');
  });

  // A second change before the first has finished: the first one's clean-up must not strip the
  // names the second has just given, or its recipes jump instead of gliding.
  it("keeps a newer vault change's names when the one it interrupts ends", async () => {
    const { finish } = fakeViewTransitions();
    const card = item('babka');
    transitionView(() => {}, { motion: 'vault' });
    transitionView(() => {}, { motion: 'vault' });

    finish(0);
    await settle();
    expect(card.style.getPropertyValue('view-transition-name')).toBe('vault-item-babka');

    finish(1);
    await settle();
    expect(card.style.getPropertyValue('view-transition-name')).toBe('');
  });
});

describe('the card flip', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    root.style.removeProperty('--flip-y');
  });

  const cardAt = (top: number, height: number) => {
    const card = document.createElement('div');
    card.getBoundingClientRect = () =>
      ({ top, bottom: top + height, height, width: 320 }) as DOMRect;
    return card;
  };

  it('turns a card on its middle line', () => {
    expect(setFlipAxis(cardAt(300, 90))).toBe(true);
    expect(root.style.getPropertyValue('--flip-y')).toBe('345px');
  });

  it('declines a card off screen, where the flip would never be seen', () => {
    expect(setFlipAxis(cardAt(-400, 90))).toBe(false);
    expect(setFlipAxis(null)).toBe(false);
    expect(root.style.getPropertyValue('--flip-y')).toBe('');
  });

  it('lets go of the line once the flip is over', async () => {
    const { finish } = fakeViewTransitions();
    setFlipAxis(cardAt(300, 90));
    transitionView(() => {}, { motion: 'flip-open' });
    finish(0);
    await settle();
    expect(root.style.getPropertyValue('--flip-y')).toBe('');
  });
});
