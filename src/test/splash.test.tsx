import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { AuthGate } from '../components/auth/AuthGate';
import * as authHook from '../hooks/useAuth';
import { UI_TEXT } from '../i18n/translations';

const en = UI_TEXT.en;
const pl = UI_TEXT.pl;
const root = document.documentElement;

type AuthState = ReturnType<typeof authHook.useAuth>;

const signedOut = (overrides: Partial<AuthState> = {}): AuthState => ({
  user: null,
  isFamilyMember: false,
  memberName: null,
  isLoading: false,
  isConfigured: true,
  error: null,
  familyListUnavailable: false,
  signInWithGoogle: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
  ...overrides,
});

// A fresh element each time, so a rerender really renders the gate again.
const gate = () => (
  <AuthGate>
    <div>App Content</div>
  </AuthGate>
);

function renderSplash(overrides: Partial<AuthState> = {}) {
  const auth = signedOut(overrides);
  vi.spyOn(authHook, 'useAuth').mockReturnValue(auth);
  render(gate());
  return auth;
}

describe('sign-in splash', () => {
  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-season');
    root.lang = 'en';
    root.style.removeProperty('--font-scale');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Here rather than in the test, so a failing test can't leave the clock faked.
    vi.useRealTimers();
  });

  it('waits for the sign-in check on a quiet launch screen, not the old icon picture', () => {
    renderSplash({ isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent(en.appLoading);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('App Content')).not.toBeInTheDocument();
  });

  it('shows the welcome, the pot, the preferences and the Google button', () => {
    renderSplash();

    expect(screen.getByRole('heading', { name: 'Welcome to Family Kitchen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.liftTheLid })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.connectWithGoogle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.languageToggle })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: en.textScaling })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: en.darkMode })).toBeInTheDocument();
    expect(screen.queryByText('App Content')).not.toBeInTheDocument();
  });

  it("drifts the season's particles across the page, and hides them from screen readers", () => {
    localStorage.setItem('wandas_season', 'winter');
    renderSplash();

    const layers = document.querySelectorAll('[data-season-field]');
    expect(layers).toHaveLength(2);
    for (const layer of layers) {
      expect(layer).toHaveAttribute('data-season-field', 'winter');
      expect(layer).toHaveAttribute('aria-hidden', 'true');
    }
    const kinds = new Set(
      [...document.querySelectorAll('.fk-particle')].map((p) => p.getAttribute('data-kind')),
    );
    expect(kinds).toEqual(new Set(['flake', 'crystal']));
  });

  it('follows the calendar when no season is chosen (autumn leaves in October)', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 15), toFake: ['Date'] });
    renderSplash();
    const kinds = new Set(
      [...document.querySelectorAll('.fk-particle')].map((p) => p.getAttribute('data-kind')),
    );
    expect(kinds).toEqual(new Set(['maple', 'beech', 'willow']));
  });

  it("matches the particles to the page's colours when the calendar has moved on", () => {
    // Regression: a phone kept awake past 1 December still shows autumn's colours on <html>
    // (App updates it when the phone wakes), and signing out then drew winter's snow in
    // autumn's rust and ochre.
    vi.useFakeTimers({ now: new Date(2026, 11, 1), toFake: ['Date'] });
    root.dataset.season = 'autumn';
    renderSplash();
    const kinds = new Set(
      [...document.querySelectorAll('.fk-particle')].map((p) => p.getAttribute('data-kind')),
    );
    expect(kinds).toEqual(new Set(['maple', 'beech', 'willow']));
  });

  it('switches everything to Polish', () => {
    renderSplash();

    fireEvent.click(screen.getByRole('button', { name: en.languageToggle }));

    expect(screen.getByRole('heading', { name: 'Witamy w Rodzinnej Kuchni' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pl.connectWithGoogle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pl.liftTheLid })).toBeInTheDocument();
    expect(root.lang).toBe('pl');
  });

  it('changes the text size with A+ and A−', () => {
    renderSplash();
    const sizes = screen.getByRole('group', { name: en.textScaling });

    fireEvent.click(within(sizes).getByRole('button', { name: en.increaseTextSize }));
    expect(root.style.getPropertyValue('--font-scale')).toBe('1.05');
    expect(within(sizes).getByText('105%')).toBeInTheDocument();

    fireEvent.click(within(sizes).getByRole('button', { name: en.decreaseTextSize }));
    fireEvent.click(within(sizes).getByRole('button', { name: en.decreaseTextSize }));
    expect(root.style.getPropertyValue('--font-scale')).toBe('0.95');
    expect(within(sizes).getByText('95%')).toBeInTheDocument();
  });

  it('switches between light and dark', () => {
    localStorage.setItem('wandas_theme', 'light');
    renderSplash();
    const darkMode = screen.getByRole('switch', { name: en.darkMode });
    expect(darkMode).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(darkMode);

    expect(darkMode).toHaveAttribute('aria-checked', 'true');
    expect(root.dataset.theme).toBe('dark');
  });

  it('signs in with Google, and shows why sign-in failed', () => {
    const auth = renderSplash({ error: 'The sign-in popup was blocked.' });

    fireEvent.click(screen.getByRole('button', { name: en.connectWithGoogle }));

    expect(auth.signInWithGoogle).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('The sign-in popup was blocked.');
  });

  it('fades away over the app once signed in, instead of vanishing', () => {
    vi.useFakeTimers();
    const useAuth = vi.spyOn(authHook, 'useAuth').mockReturnValue(signedOut());
    const { rerender } = render(gate());
    const splash = screen.getByRole('button', { name: en.connectWithGoogle }).closest('.fk-splash');

    useAuth.mockReturnValue(
      signedOut({
        user: { email: 'mom@example.com', displayName: 'Mom' } as User,
        isFamilyMember: true,
      }),
    );
    rerender(gate());
    // The app arrives beneath the same splash (not a fresh one replaying its intro), which is
    // leaving and out of reach.
    expect(screen.getByText('App Content')).toBeInTheDocument();
    expect(document.querySelector('.fk-splash')).toBe(splash);
    expect(splash).toHaveClass('is-leaving');
    expect(screen.queryByRole('button', { name: en.connectWithGoogle })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(document.querySelector('.fk-splash')).toBeNull();
    expect(screen.getByText('App Content')).toBeInTheDocument();
  });

  it('stays up, not swapped for the launch screen, while a new sign-in is checked', () => {
    const useAuth = vi.spyOn(authHook, 'useAuth').mockReturnValue(signedOut());
    const { rerender } = render(gate());
    const splash = document.querySelector('.fk-splash');

    // Signed in with Google; the family list is still being checked.
    useAuth.mockReturnValue(
      signedOut({ user: { email: 'mom@example.com' } as User, isLoading: true }),
    );
    rerender(gate());
    expect(document.querySelector('.fk-splash')).toBe(splash);
    expect(splash).not.toHaveClass('is-leaving');
    expect(screen.queryByText(en.appLoading)).toBeNull();
  });

  it('uses preferences changed while signed in once the family member signs out', () => {
    // Regression: the splash kept the theme and language from when the app first loaded,
    // and ignored the stored text size.
    const useAuth = vi.spyOn(authHook, 'useAuth').mockReturnValue(
      signedOut({
        user: { email: 'mom@example.com', displayName: 'Mom' } as User,
        isFamilyMember: true,
      }),
    );
    const { rerender } = render(gate());
    expect(screen.getByText('App Content')).toBeInTheDocument();

    // Changed in the app's menu while signed in.
    localStorage.setItem('wandas_theme', 'dark');
    localStorage.setItem('wandas_language', 'pl');
    localStorage.setItem('wandas_font_scale', '1.20');
    useAuth.mockReturnValue(signedOut());
    rerender(gate());

    expect(screen.getByRole('heading', { name: 'Witamy w Rodzinnej Kuchni' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: pl.darkMode })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText('120%')).toBeInTheDocument();
    expect(root.dataset.theme).toBe('dark');
    expect(root.lang).toBe('pl');
    expect(root.style.getPropertyValue('--font-scale')).toBe('1.2');
  });

  it('skips the intro on a tap, and only then lets the pot be tapped', () => {
    renderSplash();
    const pot = screen.getByRole('button', { name: en.liftTheLid });
    const emblem = pot.querySelector('svg');
    const splash = screen.getByRole('main').parentElement;
    expect(splash).toHaveClass('is-intro');

    // During the intro, a tap (even on the pot) just skips to the end.
    fireEvent.click(pot);
    expect(splash).toHaveClass('is-skipped');
    expect(emblem).not.toHaveClass('is-tapped');

    // Now the lid jumps.
    fireEvent.click(pot);
    expect(emblem).toHaveClass('is-tapped');
    fireEvent.click(pot);
    expect(emblem).toHaveClass('is-tapped');
  });

  it('ends the intro when the last preference pill has landed', () => {
    renderSplash();
    const splash = screen.getByRole('main').parentElement;
    const sizes = screen.getByRole('group', { name: en.textScaling });

    // Animations inside the pill (its value ticking) don't count.
    fireEvent.animationEnd(within(sizes).getByText('100%'));
    expect(splash).toHaveClass('is-intro');

    fireEvent.animationEnd(sizes);
    expect(splash).toHaveClass('is-live');
  });
});
