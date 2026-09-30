import React from 'react';
import { Shuffle } from 'lucide-react';

/**
 * A remix's mark by its name, on a vault card or row. Only a picture there: the whole card is
 * what's tapped (it opens the recipe), so the mark's popover lives on the recipe page.
 */
export const RemixMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`remix-mark ${className}`.trim()} aria-hidden="true">
    <Shuffle size="1em" strokeWidth={2.1} />
  </span>
);

/** How many remixes a recipe has, at the end of its card's cook-and-time row. A picture too. */
export const RemixBadge: React.FC<{ count: number }> = ({ count }) => (
  <span className="remix-badge" aria-hidden="true">
    <Shuffle size="1em" strokeWidth={2.2} />
    <span className="remix-badge-count">{count}</span>
  </span>
);
