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

const realRect = Element.prototype.getBoundingClientRect;

/** Moves the dividers and lets the shelf's next frame see it. */
const scrollTo = (next: number[]) =>
  act(() => {
    tops = next;
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(20);
  });

const shelf = () => document.querySelector('.vault-shelf')!;
const named = () =>
  document.querySelector('.vault-shelf-label:not(.is-leaving) .vault-tab-name')?.textContent;
const leaving = () =>
  document.querySelector('.vault-shelf-label.is-leaving .vault-tab-name')?.textContent;

describe('the pinned divider tab', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
      ],
    });
    tops = [400, 700, 1000];
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains('vault-shelf')) return { ...SHELF, bottom: 140 } as DOMRect;
      const i = (this as HTMLElement).dataset.i;
      return { top: i === undefined ? 0 : tops[Number(i)], height: 40 } as DOMRect;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    Element.prototype.getBoundingClientRect = realRect;
  });

  it('appears over the first tab exactly as it reaches the shelf', () => {
    render(<Box />);
    expect(shelf()).not.toHaveAttribute('data-shown');
    scrollTo([101, 400, 700]);
    expect(shelf()).not.toHaveAttribute('data-shown');
    scrollTo([100, 399, 699]);
    expect(shelf()).toHaveAttribute('data-shown');
    expect(named()).toBe('Breakfast');
    // Taking over from the tab under it, not rolling in.
    expect(leaving()).toBeUndefined();
  });

  it('rolls on to the next tab once that one is halfway under it', () => {
    render(<Box />);
    scrollTo([-200, 121, 400]);
    expect(named()).toBe('Breakfast');
    vi.advanceTimersByTime(300);
    scrollTo([-220, 120, 380]);
    expect(named()).toBe('Soups');
    expect(leaving()).toBe('Breakfast');
    expect(document.querySelector('.is-arriving')).toHaveAttribute('data-direction', '1');
  });

  it('skips the tabs a fast scroll flies past, naming where it lands', () => {
    render(<Box />);
    scrollTo([-200, 121, 400]);
    vi.advanceTimersByTime(300);
    scrollTo([-400, -100, 300]); // Soups, straight after Breakfast...
    scrollTo([-800, -500, 100]); // ...then Mains, all within a moment.
    expect(named()).toBe('Soups');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(named()).toBe('Mains');
    expect(leaving()).toBe('Soups');
  });

  it('rolls back down on the way up, and goes once the list is back below it', () => {
    render(<Box />);
    scrollTo([-400, -100, 110]);
    vi.advanceTimersByTime(300);
    scrollTo([-300, 0, 300]);
    expect(named()).toBe('Soups');
    expect(document.querySelector('.is-arriving')).toHaveAttribute('data-direction', '-1');

    scrollTo([150, 450, 750]);
    expect(shelf()).not.toHaveAttribute('data-shown');
    // Fading out, it keeps the name it had.
    expect(named()).toBe('Soups');
  });
});

describe('the pinned divider tab, as the page reflows', () => {
  // What a browser's ResizeObservers would hear about: each resize, on cue.
  let observers: { callback: () => void; targets: Element[] }[] = [];
  let labelWidth = 120;
  const resize = () =>
    act(() => {
      for (const o of observers) if (o.targets.length) o.callback();
      vi.advanceTimersByTime(20);
    });

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
      ],
    });
    observers = [];
    labelWidth = 120;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        entry: { callback: () => void; targets: Element[] };
        constructor(callback: () => void) {
          this.entry = { callback, targets: [] };
          observers.push(this.entry);
        }
        observe(el: Element) {
          this.entry.targets.push(el);
        }
        disconnect() {
          this.entry.targets = [];
        }
      },
    );
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('vault-shelf-label') ? labelWidth : 0;
      },
    });
    tops = [-200, 400, 700];
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains('vault-shelf')) return { ...SHELF, bottom: 140 } as DOMRect;
      const i = (this as HTMLElement).dataset.i;
      return { top: i === undefined ? 0 : tops[Number(i)], height: 40 } as DOMRect;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
    Element.prototype.getBoundingClientRect = realRect;
  });

  const tabWidth = () =>
    (document.querySelector('.vault-tab.is-pinned') as HTMLElement).style.getPropertyValue(
      '--tab-width',
    );

  it('fits its outline to the name again when the name resizes (the text size changing)', () => {
    render(<Box />);
    expect(named()).toBe('Breakfast');
    expect(tabWidth()).toBe('120px');
    labelWidth = 150;
    resize();
    expect(tabWidth()).toBe('150px');
  });

  it('names the right section after the list reflows, without waiting for a scroll', () => {
    render(<Box />);
    expect(named()).toBe('Breakfast');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Bigger text: the Soups tab is now halfway under the shelf, though nothing scrolled.
    tops = [-400, 110, 500];
    resize();
    expect(named()).toBe('Soups');
  });
});
