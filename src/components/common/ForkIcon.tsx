import React from 'react';

/**
 * An arrow that splits two ways. The stem drops from the top and each branch leaves on a
 * diagonal with a corner arrowhead, so it points down the page, the way a recipe reads, and an
 * arrowhead's inner arm never runs alongside its branch at small sizes.
 */
export const ForkIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
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
    <path d="M12 3V10" />
    <path d="M12 10Q12 12.5 10 14.5L5 19.5" />
    <path d="M5 15.5v4h4" />
    <path d="M12 10Q12 12.5 14 14.5L19 19.5" />
    <path d="M19 15.5v4h-4" />
  </svg>
);
