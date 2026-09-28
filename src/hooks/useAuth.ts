import { useState, useEffect, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';
import { fetchFamilyMembership } from '../services/firestore';
import { getConfirmedMember, setConfirmedMember } from '../services/storage';

export interface AuthState {
  user: User | null;
  isFamilyMember: boolean;
  /** The name the family list gives this person, overriding their Google name; null if unset. */
  memberName: string | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  /** Signed out because the family list couldn't be checked (e.g. the connection dropped). */
  familyListUnavailable: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** The family list's answer for one email (lowercase). */
interface Membership {
  email: string;
  isMember: boolean;
  name: string | null;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(
    isFirebaseConfigured && auth !== null,
  );
  const [error, setError] = useState<string | null>(null);
  // A returning member starts with the answer this device last confirmed, so the vault opens
  // straight away (and offline); the list is checked again below.
  const [membership, setMembership] = useState<Membership | null>(() => {
    const confirmed = getConfirmedMember();
    return confirmed ? { ...confirmed, isMember: true } : null;
  });
  const [familyListUnavailable, setFamilyListUnavailable] = useState(false);

  const email = user?.email?.trim().toLowerCase() ?? '';
  const known = membership && email && membership.email === email ? membership : null;
  const isFamilyMember = !isFirebaseConfigured || Boolean(known?.isMember);
  // Signed in but the list hasn't answered for this person yet (first sign-in on this device).
  const isCheckingMembership = isFirebaseConfigured && Boolean(email) && !known;

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setIsAuthLoading(false);
        setError(null);
        // Signed in again (by any route, e.g. another tab): the old "couldn't check" no longer applies.
        if (currentUser) setFamilyListUnavailable(false);
      },
      (err) => {
        console.error('Auth state error:', err);
        setError(err.message);
        setIsAuthLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // Asks the family list (Firestore) about whoever is signed in. firestore.rules enforce the
  // same list, so this only decides which screen to show.
  useEffect(() => {
    if (!isFirebaseConfigured || !email) return;
    let cancelled = false;

    fetchFamilyMembership(email)
      .then(({ isMember, name }) => {
        if (cancelled) return;
        setConfirmedMember(isMember ? { email, name } : null);
        setMembership({ email, isMember, name });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Someone this device already confirmed carries on with that answer until the list
        // can be reached again.
        if (getConfirmedMember()?.email === email) {
          console.warn('Could not recheck the family list; using the answer from last time:', err);
          return;
        }
        console.warn('Could not check the family list, so signing out to try again later:', err);
        setFamilyListUnavailable(true);
        if (auth) {
          firebaseSignOut(auth).catch((signOutErr: unknown) => {
            console.error('Sign out after a failed family list check failed:', signOutErr);
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [email]);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setUser({
        uid: 'dev-family-user',
        email: 'family@kitchen.local',
        displayName: 'Family Chef',
      } as unknown as User);
      return;
    }
    setError(null);
    setFamilyListUnavailable(false);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Google sign-in failed:', err);
      // Suppress popup-closed-by-user noise
      if (!msg.includes('auth/popup-closed-by-user')) {
        setError(msg);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (err: unknown) {
        console.error('Sign out failed:', err);
      }
    }
    // Forget who this device vouched for, so the next person to sign in is checked afresh.
    setConfirmedMember(null);
    setMembership(null);
    setUser(null);
  }, []);

  return {
    user,
    isFamilyMember,
    memberName: known?.name ?? null,
    isLoading: isAuthLoading || isCheckingMembership,
    isConfigured: isFirebaseConfigured,
    error,
    familyListUnavailable,
    signInWithGoogle,
    signOut,
  };
}
