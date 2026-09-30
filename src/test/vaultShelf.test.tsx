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

// Where each divider's top, and its section's last card's top, is on screen; the shelf sits at
// 100–140.
let tops: number[];
let ends: number[];
const SHELF = { top: 100, height: 40 };

function Box() {
  const list = useRef<HTMLDivElement>(null);
  return (
    <>
      <VaultShelf tabs={tabs} list={list} />
      <div ref={list}>
        {tabs.map((tab, i) => (
          <section key={tab.key} className="vault-group">
            <div className="vault-divider" data-i={i} />
            <div className="vault-slot" data-end={i} />
          </section>
        ))}
      </div>
    </>
  );
}

const shelf = () => document.querySelector('.vault-shelf')!;
const bands = () => [...document.querySelectorAll<HTMLElement>('.vault-shelf-band')];
const named = () =>
  shelf().hasAttribute('data-shown')
    ? bands().find((band) => band.hasAttribute('data-current'))?.textContent
    : undefined;

describe('the pinned divider tab, driven by the scroll', () => {
  beforeEach(() => {
    vi.stubGlobal('CSS', { supports: () => true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('holds a band for each section, shown by its tab and carried away by its last card', () => {
    render(<Box />);
    expect(shelf()).toHaveClass('follows-scroll');
    expect(bands().map((band) => band.textContent)).toEqual(['Breakfast2', 'Soups3', 'Mains5']);
    expect(bands().map((band) => band.style.getPropertyValue('--band-timelines'))).toEqual([
      '--vault-tab-0, --vault-end-0',
      '--vault-tab-1, --vault-end-1',
      '--vault-tab-2, --vault-end-2',
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
  const scrollTo = (next: number[], nextEnds = next.map((top) => top + 200)) =>
    act(() => {
      tops = next;
      ends = nextEnds;
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(20);
    });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    tops = [400, 700, 1000];
    ends = [600, 900, 1200];
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains('vault-shelf')) return { ...SHELF, bottom: 140 } as DOMRect;
      const { i, end } = (this as HTMLElement).dataset;
      const top = i !== undefined ? tops[Number(i)] : end !== undefined ? ends[Number(end)] : 0;
      return { top, height: 40 } as DOMRect;
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

  it("goes with its section's last card, and the next section's tab takes over at the shelf", () => {
    render(<Box />);
    scrollTo([-200, 300, 600], [150, 500, 800]);
    expect(named()).toBe('Breakfast2');
    // The last Breakfast card is halfway up the shelf: the tab has gone with it.
    scrollTo([-230, 270, 570], [120, 470, 770]);
    expect(named()).toBeUndefined();
    scrollTo([-430, 100, 370], [-80, 270, 570]);
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
    ends = [300, 600, 900];
    render(<Box />);
    expect(named()).toBe('Breakfast2');
    // Bigger text: the Soups tab has now reached the shelf, though nothing scrolled.
    tops = [-400, 100, 500];
    ends = [-100, 300, 700];
    act(() => {
      for (const callback of observers) callback();
      vi.advanceTimersByTime(20);
    });
    expect(named()).toBe('Soups3');
  });
});
