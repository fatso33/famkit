import React from 'react';
import { HeartFlourish } from '../common/HeartFlourish';

/**
 * Shown while the app finds out who is signed in. Usually that's a blink (the saved session
 * being read), so at first it's only the season's page colour, and the vault or the splash makes
 * its own entrance straight after. If it takes longer, e.g. the family list being checked on a
 * first sign-in, the splash's heart flourish draws in and softly beats until it's done.
 */
export const LaunchScreen: React.FC<{ label: string }> = ({ label }) => (
  <div className="launch-screen" role="status">
    <span className="sr-only">{label}</span>
    <HeartFlourish className="launch-flourish" />
  </div>
);
