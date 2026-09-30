import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { VaultShelf } from '../components/recipe-grid/VaultShelf';
import type { VaultTab } from '../components/recipe-grid/VaultTabLabel';

const tabs: VaultTab[] = [
  { key: 'breakfast', label: 'Breakfast', count: 2, category: 'breakfast' },
  { key: 'soups', label: 'Soups', count: 3, category: 'soups' },
  { key: 'mains', label: 'Mains', count: 5, category: 'mains' },
];

// Where each divider's top is on screen; the shelf sits at 100–140.
let tops: number[];
const SHELF = { top: 100, height: 40 };

function Box() {
  const list = useRef<HTMLDivElement>(null);
  return (
    <>
      <VaultShelf tabs={tabs} list={list} />
      <div ref={list}>
        {tabs.map((tab, i) => (
          <div key={tab.key} className="vault-divider" data-i={i} />
        ))}
      </div>
    </>
  );
}

const shelf = () => document.querySelector('.vault-shelf')!;
const pinned = () => [...document.querySelectorAll<HTMLElement>('.vault-tab.is-pinned')];
const named = () => pinned().find((tab) => tab.hasAttribute('data-current'))?.textContent;

describe('the pinned divider tab, driven by the scroll', () => {
  beforeEach(() => {
    vi.stubGlobal('CSS', { supports: () => true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("holds a twin of each list tab, rising with its own and pushed out by the next's", () => {
    render(<Box />);
    expect(shelf()).toHaveClass('follows-scroll');
    expect(pinned().map((tab) => tab.textContent)).toEqual(['Breakfast2', 'Soups3', 'Mains5']);
    const timelines = pinned().map((tab) => tab.style.getPropertyValue('--shelf-timelines'));
    expect(timelines).toEqual([
      '--vault-tab-0, --vault-tab-0, --vault-tab-1',
      '--vault-tab-1, --vault-tab-1, --vault-tab-2',
      // The last is never pushed out.
      '--vault-tab-2, --vault-tab-2',
    ]);
  });

  it('leaves the scroll to the compositor, never measuring it', () => {
    const measured = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    render(<Box />);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(measured).not.toHaveBeenCalled();
    expect(shelf()).not.toHaveAttribute('data-shown');
    measured.mockRestore();
  });
});

describe('the pinned divider tab, where the browser cannot drive it', () => {
  const realRect = Element.prototype.getBoundingClientRect;

  /** Moves the dividers and lets the shelf's next frame see it. */
  const scrollTo = (next: number[]) =>
    act(() => {
      tops = next;
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(20);
    });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    tops = [400, 700, 1000];
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains('vault-shelf')) return { ...SHELF, bottom: 140 } as DOMRect;
      const i = (this as HTMLElement).dataset.i;
      return { top: i === undefined ? 0 : tops[Number(i)], height: 40 } as DOMRect;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Element.prototype.getBoundingClientRect = realRect;
  });

  it('appears over the first tab exactly as it reaches the shelf', () => {
    render(<Box />);
    expect(shelf()).not.toHaveClass('follows-scroll');
    expect(shelf()).not.toHaveAttribute('data-shown');
    scrollTo([101, 400, 700]);
    expect(shelf()).not.toHaveAttribute('data-shown');
    scrollTo([100, 399, 699]);
    expect(shelf()).toHaveAttribute('data-shown');
    expect(named()).toBe('Breakfast2');
  });

  it('names the next section once its tab is halfway under the shelf', () => {
    render(<Box />);
    scrollTo([-200, 121, 400]);
    expect(named()).toBe('Breakfast2');
    scrollTo([-220, 120, 380]);
    expect(named()).toBe('Soups3');
  });

  it('names where a fast scroll lands, and goes once the list is back below it', () => {
    render(<Box />);
    scrollTo([-800, -500, 100]);
    expect(named()).toBe('Mains5');
    scrollTo([150, 450, 750]);
    expect(shelf()).not.toHaveAttribute('data-shown');
  });

  it('names the right section after the list reflows, without waiting for a scroll', () => {
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    tops = [-200, 400, 700];
    render(<Box />);
    expect(named()).toBe('Breakfast2');
    // Bigger text: the Soups tab is now halfway under the shelf, though nothing scrolled.
    tops = [-400, 110, 500];
    act(() => {
      for (const callback of observers) callback();
      vi.advanceTimersByTime(20);
    });
    expect(named()).toBe('Soups3');
  });
});
