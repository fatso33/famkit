import React, { useEffect } from 'react';
import { HeartFlourish } from '../common/HeartFlourish';
import { launchScreenGone, launchScreenShown } from './launchFlourish';

/**
 * Shown while the app finds out who is signed in. Usually that's a blink (the saved session
 * being read), so at first it's only the season's page colour, and the counter or the splash
 * makes its own entrance straight after. If it takes longer, e.g. the family list being checked
 * on a first sign-in, the splash's heart flourish draws in and softly beats until it's done, and
 * then glides up into My Counter's greeting (launchFlourish).
 */
export const LaunchScreen: React.FC<{ label: string }> = ({ label }) => {
  useEffect(() => {
    launchScreenShown();
    return launchScreenGone;
  }, []);
  return (
    <div className="launch-screen" role="status">
      <span className="sr-only">{label}</span>
      <HeartFlourish className="launch-flourish" />
    </div>
  );
};
