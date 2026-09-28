import React, { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../utils/viewTransition';

const GLIDE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * Shows one of several panels (the caller keys it). Changing `index` slides the new panel in
 * from its side while the frame's height eases to fit it.
 */
export const PanelSwap: React.FC<{
  index: number;
  className?: string;
  children: React.ReactNode;
}> = ({ index, className = '', children }) => {
  const ref = useRef<HTMLDivElement>(null);
  // The height as last drawn, kept current as the panel's text grows or shrinks.
  const last = useRef<{ index: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.offsetHeight;
    const before = last.current;
    last.current = { index, height };
    if (!before || before.index === index || !el.animate || prefersReducedMotion()) return;

    const from = index > before.index ? 1 : -1;
    const timing = { duration: 460, easing: GLIDE };
    el.style.overflow = 'clip';
    const settle = () => el.style.removeProperty('overflow');
    el.animate([{ height: `${before.height}px` }, { height: `${height}px` }], timing).finished.then(
      settle,
      settle,
    );
    const panel = el.firstElementChild as HTMLElement | null;
    panel?.animate(
      [
        { opacity: 0, transform: `translateX(${from * 1.5}rem)` },
        { opacity: 1, transform: 'none' },
      ],
      timing,
    );
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};
