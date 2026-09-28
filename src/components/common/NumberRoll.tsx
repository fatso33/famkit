import React, { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../utils/viewTransition';

const GLIDE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** A number (or short text) that rolls to its new value: up when it grows, down when it shrinks. */
export const NumberRoll: React.FC<{ value: number | string; className?: string }> = ({
  value,
  className = '',
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = value;
    const el = ref.current;
    if (before === value || !el?.animate || prefersReducedMotion()) return;
    const up = typeof value !== 'number' || typeof before !== 'number' || value > before;
    el.animate(
      [
        { transform: `translateY(${up ? 70 : -70}%)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 380, easing: GLIDE },
    );
  }, [value]);

  return (
    <span ref={ref} className={`number-roll ${className}`.trim()}>
      {value}
    </span>
  );
};
