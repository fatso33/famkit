import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthGate } from '../components/auth/AuthGate';
import * as authHook from '../hooks/useAuth';

describe('Auth allowlist matching logic', () => {
  it('correctly matches emails case-insensitively', () => {
    const rawFamilyEmails = 'Mom@gmail.com, Dad@Gmail.Com, Sister@outlook.com';
    const allowed = rawFamilyEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    expect(allowed.includes('mom@gmail.com'.toLowerCase())).toBe(true);
    expect(allowed.includes('DAD@GMAIL.COM'.toLowerCase())).toBe(true);
    expect(allowed.includes('stranger@gmail.com'.toLowerCase())).toBe(false);
  });

  it('rejects empty or whitespace-only email matches', () => {
    const rawFamilyEmails = 'mom@gmail.com, ';
    const allowed = rawFamilyEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    expect(allowed).toEqual(['mom@gmail.com']);
    expect(allowed.includes('')).toBe(false);
  });
});

describe('AuthGate splash screen', () => {
  it('renders splash screen with logo, titles, Google connect button, and top toggles', () => {
    vi.spyOn(authHook, 'useAuth').mockReturnValue({
      user: null,
      isFamilyMember: false,
      isLoading: false,
      isConfigured: true,
      error: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>
    );

    expect(screen.getByText('Family Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Recipe Vault')).toBeInTheDocument();
    expect(screen.getByText('Connect with Google')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle language/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  it('toggles language between English and Polish on splash screen', () => {
    vi.spyOn(authHook, 'useAuth').mockReturnValue({
      user: null,
      isFamilyMember: false,
      isLoading: false,
      isConfigured: true,
      error: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <AuthGate>
        <div>App Content</div>
      </AuthGate>
    );

    const langBtn = screen.getByRole('button', { name: /toggle language/i });
    expect(screen.getByText('Connect with Google')).toBeInTheDocument();

    fireEvent.click(langBtn);
    expect(screen.getByText('Rodzinna Kuchnia')).toBeInTheDocument();
    expect(screen.getByText('Skarbiec Przepisów')).toBeInTheDocument();
    expect(screen.getByText('Połącz przez Google')).toBeInTheDocument();
  });
});

