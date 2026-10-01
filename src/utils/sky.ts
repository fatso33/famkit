import type React from 'react';

/**
 * The seconds on the sky's clock: since the page loaded. Every field of particles starts its
 * animations this far into them (--fk-sky-age), so a particle is in the same place in every
 * field at any moment. The splash's field and My Counter's then show the very same sky, and the
 * splash can hand over to the counter without a single particle jumping.
 */
export const skyClock = () => performance.now() / 1000;

/** The --fk-sky-age a field's animations start at: `age` seconds on the sky's clock. */
export const skyAgeStyle = (age: number | undefined): React.CSSProperties | undefined =>
  age === undefined ? undefined : ({ '--fk-sky-age': `${age.toFixed(3)}s` } as React.CSSProperties);
