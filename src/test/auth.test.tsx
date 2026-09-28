import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { AuthGate } from '../components/auth/AuthGate';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { fetchFamilyMembership } from '../services/firestore';
import { UI_TEXT } from '../i18n/translations';

vi.mock('../services/firebase', () => ({
  isFirebaseConfigured: true,
  auth: {},
  googleProvider: {},
}));

const firebaseAuth = vi.hoisted(() => ({
  /** The app's onAuthStateChanged listener: call it to sign someone in or out. */
  onChange: null as ((user: User | null) => void) | null,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, next: (user: User | null) => void) => {
    firebaseAuth.onChange = next;
    return () => {};
  },
  signInWithPopup: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => {
    firebaseAuth.onChange?.(null);
    return Promise.resolve();
  }),
}));

vi.mock('../services/firestore', () => ({ fetchFamilyMembership: vi.fn() }));

const fetchMembership = vi.mocked(fetchFamilyMembership);
const CONFIRMED_KEY = 'family_kitchen_confirmed_member';
const mom = { email: 'Mom@Example.com', displayName: 'Krystyna Nowak' } as User;
const offline = () => Object.assign(new Error('offline'), { code: 'unavailable' });

function signIn(user: User | null) {
  act(() => firebaseAuth.onChange?.(user));
}

function remember(email: string, name: string | null = null) {
  localStorage.setItem(CONFIRMED_KEY, JSON.stringify({ email, name }));
}

describe('useAuth and the family list', () => {
  beforeEach(() => {
    localStorage.clear();
    firebaseAuth.onChange = null;
    fetchMembership.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('waits for the list on a first sign-in, then lets a family member in', async () => {
    fetchMembership.mockResolvedValue({ isMember: true, name: null });
    const { result } = renderHook(() => useAuth());

    signIn(mom);
    expect(result.current.isLoading).toBe(true);
    expect(fetchMembership).toHaveBeenCalledWith('mom@example.com');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFamilyMember).toBe(true);
    expect(JSON.parse(localStorage.getItem(CONFIRMED_KEY)!)).toEqual({
      email: 'mom@example.com',
      name: null,
    });
  });

  it('keeps out someone who is not on the list', async () => {
    fetchMembership.mockResolvedValue({ isMember: false, name: null });
    const { result } = renderHook(() => useAuth());

    signIn({ email: 'stranger@example.com' } as User);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFamilyMember).toBe(false);
    expect(localStorage.getItem(CONFIRMED_KEY)).toBeNull();
  });

  it('lets a returning member straight in, even offline', async () => {
    remember('mom@example.com');
    fetchMembership.mockRejectedValue(offline());
    const { result } = renderHook(() => useAuth());

    signIn(mom);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFamilyMember).toBe(true);

    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(result.current.isFamilyMember).toBe(true);
    expect(result.current.user).toBe(mom);
  });

  it('shuts out a returning member who has been taken off the list', async () => {
    remember('mom@example.com');
    fetchMembership.mockResolvedValue({ isMember: false, name: null });
    const { result } = renderHook(() => useAuth());

    signIn(mom);
    expect(result.current.isFamilyMember).toBe(true);

    await waitFor(() => expect(result.current.isFamilyMember).toBe(false));
    expect(localStorage.getItem(CONFIRMED_KEY)).toBeNull();
  });

  it("doesn't carry one person's membership over to another account", async () => {
    remember('mom@example.com');
    fetchMembership.mockResolvedValue({ isMember: false, name: null });
    const { result } = renderHook(() => useAuth());

    signIn({ email: 'stranger@example.com' } as User);
    expect(result.current.isFamilyMember).toBe(false);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFamilyMember).toBe(false);
  });

  it("signs out to try again later when a first check can't reach the list", async () => {
    fetchMembership.mockRejectedValue(offline());
    const { result } = renderHook(() => useAuth());

    signIn(mom);

    await waitFor(() => expect(result.current.familyListUnavailable).toBe(true));
    expect(result.current.user).toBeNull();
    expect(result.current.isFamilyMember).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('drops the "couldn\'t check" message once signed in again by any route', async () => {
    fetchMembership.mockRejectedValueOnce(offline());
    const { result } = renderHook(() => useAuth());
    signIn(mom);
    await waitFor(() => expect(result.current.familyListUnavailable).toBe(true));

    // Signed in from another tab: this tab's sign-in button was never pressed.
    fetchMembership.mockResolvedValue({ isMember: true, name: null });
    signIn(mom);

    expect(result.current.familyListUnavailable).toBe(false);
  });

  it('gives the name from the family list, and remembers it for offline starts', async () => {
    fetchMembership.mockResolvedValue({ isMember: true, name: 'Babcia' });
    const { result } = renderHook(() => useAuth());

    signIn(mom);

    await waitFor(() => expect(result.current.memberName).toBe('Babcia'));
    expect(JSON.parse(localStorage.getItem(CONFIRMED_KEY)!)).toEqual({
      email: 'mom@example.com',
      name: 'Babcia',
    });
  });

  it('forgets who this device vouched for on signing out', async () => {
    remember('mom@example.com');
    fetchMembership.mockResolvedValue({ isMember: true, name: null });
    const { result } = renderHook(() => useAuth());
    signIn(mom);
    await waitFor(() => expect(fetchMembership).toHaveBeenCalled());

    await act(() => result.current.signOut());

    expect(localStorage.getItem(CONFIRMED_KEY)).toBeNull();
    expect(result.current.user).toBeNull();
  });
});

describe('AuthGate and the family list', () => {
  const WhoAmI = () => <p>{useCurrentUser()?.name}</p>;

  beforeEach(() => {
    localStorage.clear();
    firebaseAuth.onChange = null;
    fetchMembership.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("credits a member by the family list's name over their Google name", async () => {
    fetchMembership.mockResolvedValue({ isMember: true, name: 'Babcia' });
    render(
      <AuthGate>
        <WhoAmI />
      </AuthGate>,
    );

    signIn(mom);

    expect(await screen.findByText('Babcia')).toBeInTheDocument();
    expect(screen.queryByText('Krystyna Nowak')).not.toBeInTheDocument();
  });

  it('falls back to their Google name when the list gives none', async () => {
    fetchMembership.mockResolvedValue({ isMember: true, name: null });
    render(
      <AuthGate>
        <WhoAmI />
      </AuthGate>,
    );

    signIn(mom);

    expect(await screen.findByText('Krystyna Nowak')).toBeInTheDocument();
  });

  it("says why on the sign-in screen when the list couldn't be checked", async () => {
    fetchMembership.mockRejectedValue(offline());
    render(
      <AuthGate>
        <WhoAmI />
      </AuthGate>,
    );

    signIn(mom);

    expect(await screen.findByRole('alert')).toHaveTextContent(UI_TEXT.en.familyListUnavailable);
    expect(screen.getByRole('button', { name: UI_TEXT.en.connectWithGoogle })).toBeInTheDocument();
  });
});
