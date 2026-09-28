import { createContext, useContext } from 'react';

/** The signed-in family member, as the rest of the app needs them. */
export interface CurrentUser {
  email: string;
  /** The family list's name for them, else their Google display name, else the email. */
  name: string;
}

/** Provided by AuthGate once someone is signed in; null elsewhere (e.g. isolated tests). */
export const CurrentUserContext = createContext<CurrentUser | null>(null);

export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserContext);
}
