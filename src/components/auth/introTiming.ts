import type React from 'react';

/**
 * When one part of the splash intro plays: its delay and duration in seconds, read by the
 * `.fk-a` rule in index.css (which also scales both by `--fk-splash-pace`).
 */
export const at = (delay: number, duration: number) =>
  ({ '--d': `${delay}s`, '--t': `${duration}s` }) as React.CSSProperties;
