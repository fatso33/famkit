import React, { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../utils/viewTransition';

const GLIDE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * A number (or short text) that rolls to its new value: up when it grows, down when it shrinks.
 * Text rolls up, unless `rank` says where it sits in order (e.g. "½×" before "2×").
 */
export const NumberRoll: React.FC<{
  value: number | string;
  rank?: number;
  className?: string;
}> = ({ value, rank, className = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const shownRank = useRef(rank);

  useLayoutEffect(() => {
    const before = shown.current;
    const rankBefore = shownRank.current;
    shown.current = value;
    shownRank.current = rank;
    const el = ref.current;
    if (before === value || !el?.animate || prefersReducedMotion()) return;
    const up =
      rank !== undefined && rankBefore !== undefined
        ? rank > rankBefore
        : typeof value !== 'number' || typeof before !== 'number' || value > before;
    el.animate(
      [
        { transform: `translateY(${up ? 70 : -70}%)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 380, easing: GLIDE },
    );
  }, [value, rank]);

  return (
    <span ref={ref} className={`number-roll ${className}`.trim()}>
      {value}
    </span>
  );
};
