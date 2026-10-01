import React from 'react';

interface BoxIconProps {
  size?: string | number;
  /** Lighter than the app's usual 2: the box has more lines, which must stay apart on a phone. */
  strokeWidth?: number;
  className?: string;
  /** Always hidden from screen readers: it's a picture beside its label. Taken like an icon's. */
  'aria-hidden'?: boolean | 'true' | 'false';
}

// The recipe tin both icons share: its front and the brass label holder. Each card stops at the
// front's top edge, so it reads as standing inside the box.
const Box: React.FC<BoxIconProps & { children: React.ReactNode }> = ({
  size = 24,
  strokeWidth = 1.75,
  className,
  children,
}) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
    <path d="M3 11h18v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5z" />
    <rect x="9.2" y="14.4" width="5.6" height="2.4" rx=".5" />
  </svg>
);

/** The Recipe Box: a recipe tin with its card settled inside. */
export const RecipeBoxIcon: React.FC<BoxIconProps> = (props) => (
  <Box {...props}>
    <path d="M7.01 11 7.54 7.68Q7.76 6.3 9.14 6.52L15.26 7.48Q16.64 7.7 16.43 9.09L16.13 11" />
  </Box>
);

/** A recipe from the Recipe Box: the same tin, with its card pulled up out of it. */
export const RecipeCardIcon: React.FC<BoxIconProps> = (props) => (
  <Box {...props}>
    <path d="M6.31 11 7.54 3.28Q7.76 1.9 9.14 2.12L15.26 3.08Q16.64 3.3 16.43 4.69L15.43 11" />
    <path d="M9.59 4.72 13.81 5.39" />
  </Box>
);
