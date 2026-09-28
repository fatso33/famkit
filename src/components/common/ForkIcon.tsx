import React from 'react';

// Each path: its branch from the fork, and its arrowhead. The stem rises from the bottom.
const BRANCHES: Record<2 | 3, readonly (readonly [string, string])[]> = {
  2: [
    ['M12 14C12 10 6 10 6 4.5', 'M3.7 6.8 6 4.5 8.3 6.8'],
    ['M12 14C12 10 18 10 18 4.5', 'M15.7 6.8 18 4.5 20.3 6.8'],
  ],
  3: [
    ['M12 14C12 10 4.5 10 4.5 4.5', 'M2.2 6.8 4.5 4.5 6.8 6.8'],
    ['M12 14V4.5', 'M9.7 6.8 12 4.5 14.3 6.8'],
    ['M12 14C12 10 19.5 10 19.5 4.5', 'M17.2 6.8 19.5 4.5 21.8 6.8'],
  ],
};

interface ForkIconProps {
  /** How many ways it splits. */
  paths: number;
  /** The branch to light up; all of them when left out. */
  lit?: number;
  className?: string;
}

/**
 * An arrow that splits two or three ways. A path's own icon lights its branch, left to right:
 * A the left, B the right (or the middle of three). index.css draws the lit branch out.
 */
export const ForkIcon: React.FC<ForkIconProps> = ({ paths, lit, className = '' }) => (
  <svg
    className={`fork-icon ${className}`.trim()}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path className="fork-icon-stem" pathLength={1} d="M12 21.5V14" />
    {BRANCHES[paths >= 3 ? 3 : 2].map(([line, head], i) => (
      <g key={i} className={`fork-icon-branch${lit === undefined || lit === i ? ' is-lit' : ''}`}>
        <path className="fork-icon-line" pathLength={1} d={line} />
        <path className="fork-icon-head" d={head} />
      </g>
    ))}
  </svg>
);
