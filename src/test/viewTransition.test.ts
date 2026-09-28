import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { transitionTheme, transitionView, vaultItemKey } from '../utils/viewTransition';

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

  const namesDuring = (card: HTMLElement, relayout: boolean) => {
    let during: string[] = [];
    transitionView(
      () => {
        during = [card, ...card.children].map((el) =>
          (el as HTMLElement).style.getPropertyValue('view-transition-name'),
        );
      },
      { motion: 'vault', relayout },
    );
    return during;
  };

  it('names each recipe, its photo and its name when the layout changes, and clears them after', async () => {
    const { finish } = fakeViewTransitions();
    const card = item('recipe 1/ż');
    const during = namesDuring(card, true);
    expect(during).toEqual([
      'vault-item-recipe_1__',
      'vault-photo-recipe_1__',
      'vault-name-recipe_1__',
    ]);
    expect(root.dataset.nav).toBe('vault');

    finish(0);
    await settle();
    expect(card.style.getPropertyValue('view-transition-name')).toBe('');
    expect(card.children[0].getAttribute('style') ?? '').toBe('');
    expect(root.dataset.nav).toBeUndefined();
  });

  // A filter or sort keeps every card's shape, so each glides whole: a third of the
  // animations, which kept the glide from dropping frames on a slow phone.
  it('names only the recipe itself when it is re-filtered or re-sorted', async () => {
    const { finish } = fakeViewTransitions();
    const card = item('babka');
    expect(namesDuring(card, false)).toEqual(['vault-item-babka', '', '']);

    finish(0);
    await settle();
    expect(card.style.getPropertyValue('view-transition-name')).toBe('');
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

  it('cross-fades every recipe when the layout changes, as each one changes shape', () => {
    fakeViewTransitions();
    const card = item('babka');
    transitionView(() => {}, { motion: 'vault', relayout: true });
    expect(card.style.getPropertyValue('view-transition-class')).toBe('vault-item');
  });
});

describe('recipe photo morph', () => {
  beforeEach(() => {
    // jsdom can't nest morphs; the browsers this path is for can.
    vi.stubGlobal('CSS', { supports: () => true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'startViewTransition');
    document.body.innerHTML = '';
    delete root.dataset.nav;
    delete root.dataset.morph;
  });

  /** A photo in its frame, as a list row or the recipe's hero lays it out. */
  const framedPhoto = (loaded: boolean) => {
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => ({ width: 56, height: 56 }) as DOMRect;
    const img = document.createElement('img');
    img.dataset.morphPhoto = '';
    Object.defineProperty(img, 'naturalWidth', { value: loaded ? 800 : 0 });
    Object.defineProperty(img, 'naturalHeight', { value: loaded ? 600 : 0 });
    frame.appendChild(img);
    document.body.appendChild(frame);
    return frame;
  };

  const open = (heroLoaded: boolean) => {
    const row = framedPhoto(true);
    transitionView(
      () => {
        row.remove();
        framedPhoto(heroLoaded);
      },
      { motion: 'forward', morph: 'recipe' },
    );
  };

  // A list row's thumbnail blown up to the hero's size smears, then sharpens part way.
  it('flies only the sharper snapshot when both ends are the whole photo', async () => {
    const { finish } = fakeViewTransitions();
    open(true);
    expect(root.dataset.morphWhole).toBe('');

    finish(0);
    await settle();
    expect(root.dataset.morphWhole).toBeUndefined();
  });

  it('keeps the cross-fade while the hero photo is still loading', () => {
    fakeViewTransitions();
    open(false);
    expect(root.dataset.morphWhole).toBeUndefined();
  });
});
