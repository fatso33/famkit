import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
  isLoading: false,
  isConfigured: true,
  error: null,
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
    root.lang = 'en';
    root.style.removeProperty('--font-scale');
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
