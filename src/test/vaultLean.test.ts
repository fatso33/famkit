import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LEAN_LEAD_REM,
  LEAN_POSES,
  holdLean,
  isWebKit,
  leanPose,
  leanProgress,
  releaseLean,
} from '../utils/vaultLean';
import { transitionView } from '../utils/viewTransition';

const css = readFileSync(resolve('src/index.css'), 'utf8');

describe('the Box cards held in their lean during a page change', () => {
  afterEach(() => {
    releaseLean();
    document.body.innerHTML = '';
    Reflect.deleteProperty(document, 'startViewTransition');
    delete document.documentElement.dataset.nav;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // The hold copies the lean's keyframes and range; they must stay in step with index.css.
  it('poses cards as the lean in index.css does', () => {
    const keyframes = (name: string) =>
      css.match(new RegExp(`@keyframes ${name} \\{([^}]*\\}[^}]*)\\}`))?.[1] ?? '';
    for (const [name, pose] of [
      ['vault-card-lean', LEAN_POSES.list],
      ['vault-card-lean-soft', LEAN_POSES.cards],
    ] as const) {
      const to = keyframes(name).split('to')[1];
      expect(to).toContain(`perspective(${pose.perspective}px) rotateX(${pose.angle}deg)`);
      expect(to).toContain(`opacity: ${pose.opacity}`);
    }
    expect(css).toContain(`animation-range: exit -${LEAN_LEAD_REM}rem exit 100%`);
    expect(css).toContain(
      'animation-timeline: view(block calc(var(--vault-bar-title) + var(--vault-shelf-height)) 0px)',
    );
  });

  it('measures how far into its lean a card is', () => {
    // Line at 90px, lean starting 30px before a card's top reaches it.
    expect(leanProgress(200, 100, 90, 30)).toBe(0);
    expect(leanProgress(120, 100, 90, 30)).toBe(0);
    expect(leanProgress(55, 100, 90, 30)).toBeCloseTo(0.5);
    expect(leanProgress(-10, 100, 90, 30)).toBe(1);
    expect(leanProgress(-400, 100, 90, 30)).toBe(1);
  });

  it('turns a card in 3D, or draws the turn flat for WebKit', () => {
    expect(leanPose(0.5, 'list', 80, false)).toEqual({
      transform: 'perspective(600px) rotateX(23deg)',
      opacity: '0.6',
    });
    expect(leanPose(1, 'cards', 80, false).opacity).toBe('0.5');
    const flat = leanPose(0.5, 'list', 80, true);
    expect(flat.opacity).toBe('0.6');
    const squash = Number(flat.transform.match(/^scale\(1, ([\d.]+)\)$/)?.[1]);
    // The turn's own foreshortening of the 80px still showing: a little more than its cosine.
    const turn = (23 * Math.PI) / 180;
    expect(squash).toBeCloseTo((Math.cos(turn) * 600) / (600 + 80 * Math.sin(turn)), 4);
    expect(squash).toBeLessThan(Math.cos(turn));
    expect(leanPose(0, 'list', 80, true).transform).toBe('scale(1, 1)');
  });

  it("tells WebKit's browsers from the rest", () => {
    const iphoneSafari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const iphoneChrome =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';
    const pixelChrome =
      'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
    const edge =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0';
    const firefox = 'Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0';
    expect(isWebKit(iphoneSafari)).toBe(true);
    expect(isWebKit(iphoneChrome)).toBe(true);
    expect(isWebKit(pixelChrome)).toBe(false);
    expect(isWebKit(edge)).toBe(false);
    expect(isWebKit(firefox)).toBe(false);
  });

  /** The Box's list with cards at these tops (100px tall), the lean line at 90px. */
  function box(tops: number[]) {
    document.body.innerHTML = `<section id="viewGrid"><div class="vault-box is-list"><section class="vault-group">${tops
      .map(() => '<div class="vault-slot"></div>')
      .join('')}<div class="vault-slot"></div></section></div></section>`;
    vi.stubGlobal('CSS', { supports: () => true });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/129.0',
    );
    const slots = [...document.querySelectorAll<HTMLElement>('.vault-slot')];
    // The probe measuring the line (the cards have their own below).
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      height: 90,
    } as DOMRect);
    slots.forEach((slot, i) =>
      vi
        .spyOn(slot, 'getBoundingClientRect')
        .mockReturnValue({ top: tops[i] ?? -500, height: 100 } as DOMRect),
    );
    return slots;
  }

  it('holds each card in its pose, hides those past the line, and lets them go', () => {
    const [past, leaning, upright, last] = box([-200, 60, 300]);
    holdLean();
    expect(past.style.visibility).toBe('hidden');
    expect(leaning.style.transform).toMatch(/^perspective\(600px\) rotateX\([\d.]+deg\)$/);
    expect(Number(leaning.style.opacity)).toBeGreaterThan(0.2);
    expect(Number(leaning.style.opacity)).toBeLessThan(1);
    expect(upright.getAttribute('style')).toBeNull();
    // A section's last card carries its tab away, never leaning.
    expect(last.getAttribute('style')).toBeNull();
    releaseLean();
    for (const slot of [past, leaning]) expect(slot.getAttribute('style') ?? '').toBe('');
  });

  it('holds the cards for as long as a page change runs', async () => {
    const [past, leaning] = box([-200, 60]);
    let finish = () => {};
    document.startViewTransition = ((update: () => void) => {
      update();
      const finished = new Promise<void>((resolve) => (finish = resolve));
      return { ready: Promise.resolve(), finished } as unknown as ViewTransition;
    }) as unknown as typeof document.startViewTransition;
    transitionView(() => {}, { motion: 'side-next' });
    expect(past.style.visibility).toBe('hidden');
    expect(leaning.style.transform).not.toBe('');
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(leaning.style.transform).toBe('');
    expect(past.style.visibility).toBe('');
  });
});
