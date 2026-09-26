import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { DEFAULT_RECIPE } from '../data/defaultRecipe';

// Stands in for the browser's WakeLockSentinel. The browser calls release()
// itself when the tab is hidden or the phone locks, which fires 'release'.
class FakeSentinel extends EventTarget {
  released = false;
  readonly type = 'screen';
  release = vi.fn(() => {
    if (!this.released) {
      this.released = true;
      this.dispatchEvent(new Event('release'));
    }
    return Promise.resolve();
  });
}

let sentinels: FakeSentinel[];
const request = vi.fn(() => {
  const sentinel = new FakeSentinel();
  sentinels.push(sentinel);
  return Promise.resolve(sentinel);
});

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function openRecipeAndTurnOnCookMode() {
  render(<App />);
  fireEvent.click(screen.getByText(DEFAULT_RECIPE.name));
  fireEvent.click(screen.getByRole('button', { name: /cook mode: off/i }));
  await act(() => Promise.resolve());
  expect(screen.getByRole('button', { name: /cook mode: on/i })).toBeInTheDocument();
}

describe('Cook Mode (screen wake lock)', () => {
  beforeEach(() => {
    sentinels = [];
    request.mockClear();
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('re-acquires the lock after the browser releases it when the user switches apps', async () => {
    await openRecipeAndTurnOnCookMode();
    expect(request).toHaveBeenCalledTimes(1);

    // Phone locked / app switched: the browser drops the lock on its own.
    await act(async () => {
      setVisibility('hidden');
      await sentinels[0].release();
    });
    await act(async () => {
      setVisibility('visible');
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /cook mode: on/i })).toBeInTheDocument();
  });

  it('stays off after the user explicitly turns Cook Mode off', async () => {
    await openRecipeAndTurnOnCookMode();

    fireEvent.click(screen.getByRole('button', { name: /cook mode: on/i }));
    await act(() => Promise.resolve());
    expect(sentinels[0].release).toHaveBeenCalled();

    await act(async () => {
      setVisibility('hidden');
      setVisibility('visible');
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /cook mode: off/i })).toBeInTheDocument();
  });
});
