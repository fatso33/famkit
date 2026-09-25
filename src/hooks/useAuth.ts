import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';

export interface AuthState {
  user: User | null;
  isFamilyMember: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const rawFamilyEmails = import.meta.env.VITE_FAMILY_EMAILS || '';
  const familyEmails = useMemo(() => {
    return rawFamilyEmails
      .split(',')
      .map((email: string) => email.trim().toLowerCase())
      .filter(Boolean);
  }, [rawFamilyEmails]);

  const isFamilyMember = useMemo(() => {
    if (!isFirebaseConfigured) return true; // In unconfigured/dev mode, allow access
    if (!user || !user.email) return false;
    // If no emails are specified in allowlist, default to open for authenticated users,
    // otherwise strictly match allowlist
    if (familyEmails.length === 0) return true;
    return familyEmails.includes(user.email.toLowerCase());
  }, [user, familyEmails]);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Auth state error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

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
    setUser(null);
  }, []);

  return {
    user,
    isFamilyMember,
    isLoading,
    isConfigured: isFirebaseConfigured,
    error,
    signInWithGoogle,
    signOut,
  };
}
