import { createContext, useContext } from 'react';

/**
 * Whether the sign-in splash is still up over the app, handing over to the page beneath it.
 * Provided by AuthGate. My Counter keeps its own particles hidden until then: the splash's are
 * the same ones, in the same places, so when it goes nothing seems to change.
 */
export const SplashUpContext = createContext(false);

export function useSplashUp(): boolean {
  return useContext(SplashUpContext);
}
