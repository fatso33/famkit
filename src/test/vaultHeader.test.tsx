import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { VaultHeader } from '../components/recipe-grid/VaultHeader';
import { UI_TEXT } from '../i18n/translations';

const t = UI_TEXT.en;

// jsdom has no layout: the bar counts as pinned from the start, which is what these tests want
// once the page has left the top. The page is made tall enough to scroll.
function renderHeader() {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 5000,
  });
  const view = render(
    <VaultHeader counts={{ recipes: 3, cooks: 2 }} entering={false} t={t}>
      <input aria-label="search" />
      <button type="button">filter</button>
    </VaultHeader>,
  );
  const bar = view.container.querySelector<HTMLElement>('.vault-bar')!;
  const masthead = view.container.querySelector<HTMLElement>('.vault-masthead')!;
  return { ...view, bar, masthead };
}

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(20);
  });
}

describe('the vault header', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scrollTo(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('draws its flourish and count only at the very top of the page', () => {
    const { masthead } = renderHeader();
    expect(masthead).not.toHaveAttribute('data-away');
    scrollTo(300);
    expect(masthead).toHaveAttribute('data-away');
    // Still sliding back in: not yet.
    scrollTo(40);
    expect(masthead).toHaveAttribute('data-away');
    scrollTo(0);
    expect(masthead).not.toHaveAttribute('data-away');
  });

  it('tucks the pinned toolbar away scrolling down, and brings it back on any scroll up', () => {
    const { bar } = renderHeader();
    scrollTo(400);
    expect(bar).toHaveAttribute('data-tucked');
    scrollTo(900);
    expect(bar).toHaveAttribute('data-tucked');
    scrollTo(890);
    expect(bar).not.toHaveAttribute('data-tucked');
    // A small jiggle back down doesn't tuck it again; a real scroll does.
    scrollTo(900);
    expect(bar).not.toHaveAttribute('data-tucked');
    scrollTo(940);
    expect(bar).toHaveAttribute('data-tucked');
  });

  it('keeps the toolbar while a search is being typed', () => {
    const { bar, getByLabelText } = renderHeader();
    act(() => getByLabelText('search').focus());
    scrollTo(400);
    scrollTo(800);
    expect(bar).not.toHaveAttribute('data-tucked');
  });

  it('keeps tucking after a toolbar button was tapped, which leaves it focused on phones', () => {
    const { bar, getByRole } = renderHeader();
    act(() => getByRole('button', { name: 'filter' }).focus());
    scrollTo(400);
    scrollTo(800);
    expect(bar).toHaveAttribute('data-tucked');
  });

  it('measures the title again when something above moves the banner without resizing it', () => {
    const observed: Element[] = [];
    let notify = () => {};
    class FakeObserver {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    let bannerBottom = 200;
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const bottom = this.classList.contains('vault-masthead') ? bannerBottom : 0;
        return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom } as DOMRect;
      });
    try {
      const { masthead } = renderHeader();
      const pin = () => masthead.style.getPropertyValue('--vault-pin');
      expect(pin()).toBe('200.0px');

      // The install card appears above: the banner moves down, its size unchanged, and the
      // page holding it grows.
      expect(observed).toContain(masthead.parentElement);
      bannerBottom = 320;
      act(() => notify());
      expect(pin()).toBe('320.0px');
    } finally {
      rect.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('brings the toolbar back when keyboard focus reaches it', () => {
    const { bar, getByRole } = renderHeader();
    scrollTo(400);
    scrollTo(800);
    expect(bar).toHaveAttribute('data-tucked');
    act(() => getByRole('button', { name: 'filter' }).focus());
    expect(bar).not.toHaveAttribute('data-tucked');
  });
});
