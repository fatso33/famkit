import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../App';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateRecipe: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;

const babka: Recipe = {
  id: 'babka',
  name: 'Babka',
  author: 'Ola',
  category: 'family',
  heroImage: '',
  yieldHeader: 'For 1 loaf:',
  ingredients: [{ text: 'Flour - 500g' }],
  steps: [{ num: 1, text: 'Knead.' }],
  createdAt: 1000,
};

interface FakeAnimation {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  target: Element;
  finish: () => Promise<void>;
}

/**
 * jsdom has no Web Animations. This stands in for a browser playing them: each animation
 * finishes only when the test says so.
 */
function playAnimations() {
  const played: FakeAnimation[] = [];
  Element.prototype.animate = vi.fn(function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    let resolve = () => {};
    const finished = new Promise<void>((r) => (resolve = r));
    played.push({
      keyframes,
      options,
      target: this,
      finish: () => act(async () => resolve()),
    });
    return {
      finished,
      playState: 'running',
      startTime: null,
      currentTime: 0,
      effect: { getComputedTiming: () => ({ progress: 1 }) },
      pause: vi.fn(),
      cancel: vi.fn(),
    } as unknown as Animation;
  }) as unknown as typeof Element.prototype.animate;
  return {
    played,
    /** The marker for what follows the unroll: an animation with no keyframes. */
    cue: () => played.find((a) => a.keyframes.length === 0)!,
    /** The body rolling back up, which holds its end state for the page's last snapshot. */
    rollUp: () =>
      played.find(
        (a) => a.options.fill === 'forwards' && a.target.classList.contains('detail-body'),
      )!,
  };
}

const backButton = () => screen.queryByRole('button', { name: t.backToRecipes });
const vaultHeading = () =>
  screen.queryByRole('heading', { name: `${t.vaultKicker} ${t.vaultTitle}`, level: 1 });

describe('a recipe unrolling out of its photo', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([babka]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'animate');
  });

  it('grows the back button out of the menu button once the recipe has unrolled', async () => {
    const animations = playAnimations();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));

    // The recipe is on its way down: there's no top back pill, and no back button yet.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Babka');
    expect(backButton()).toBeNull();
    // Hidden before the first frame, so the page is snapshotted with only its photo.
    const reveal = animations.played.find((a) => a.target.classList.contains('detail-body'))!;
    expect(reveal.options.fill).toBe('backwards');
    expect(reveal.keyframes[0].clipPath).toMatch(/^inset\(0 0 calc\(100% - -?\d+px\) 0\)$/);

    await animations.cue().finish();
    expect(backButton()).toBeInTheDocument();
  });

  it('rolls the recipe up before the vault comes back', async () => {
    const animations = playAnimations();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    await animations.cue().finish();

    fireEvent.click(backButton()!);
    // Still the recipe while it rolls up; the back button has already tucked away.
    expect(vaultHeading()).toBeNull();
    expect(backButton()).toBeNull();

    await animations.rollUp().finish();
    expect(vaultHeading()).toBeInTheDocument();
  });

  it('ignores a second tap while the recipe rolls up', async () => {
    const animations = playAnimations();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    await animations.cue().finish();

    const back = backButton()!;
    fireEvent.click(back);
    fireEvent.click(back);
    expect(animations.played.filter((a) => a.options.fill === 'forwards')).toHaveLength(2);
  });

  it('stays where the menu went if it was used while the recipe rolled up', async () => {
    const animations = playAnimations();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    await animations.cue().finish();

    fireEvent.click(backButton()!);
    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    const menu = screen.getByRole('dialog', { name: t.menu });
    fireEvent.click(within(menu).getByRole('button', { name: t.settings }));
    expect(screen.getByRole('heading', { name: t.settings, level: 1 })).toBeInTheDocument();

    // The roll-up ends after the page has already changed: nothing more happens.
    await animations.rollUp().finish();
    expect(screen.getByRole('heading', { name: t.settings, level: 1 })).toBeInTheDocument();
  });

  it('tucks the back button into the menu button while the menu is open', async () => {
    const animations = playAnimations();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    await animations.cue().finish();

    fireEvent.click(screen.getByRole('button', { name: t.openMenu }));
    expect(backButton()).toBeNull();
    const menu = screen.getByRole('dialog', { name: t.menu });
    expect(within(menu).getByRole('button', { name: t.shareRecipe })).toBeInTheDocument();
  });

  it('shows the recipe and its back button at once where nothing animates', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Babka' }));
    expect(backButton()).toBeInTheDocument();

    fireEvent.click(backButton()!);
    expect(vaultHeading()).toBeInTheDocument();
  });
});
