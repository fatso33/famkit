import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, TOAST_DURATION_MS } from '../hooks/useToast';

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides the toast after its duration, keeping the text until the fade-out ends', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Copied'));
    expect(result.current.visible).toBe(true);
    expect(result.current.toast).toEqual({ message: 'Copied', tone: 'success' });

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(result.current.visible).toBe(false);
    expect(result.current.toast?.message).toBe('Copied');

    act(() => result.current.clearToast());
    expect(result.current.toast).toBeNull();
  });

  it("gives a second toast its full time instead of hiding on the first one's timer", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('First'));
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 500);
    });
    act(() => result.current.showToast('Second', 'error'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.visible).toBe(true);
    expect(result.current.toast).toEqual({ message: 'Second', tone: 'error' });

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(result.current.visible).toBe(false);
  });
});
