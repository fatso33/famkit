/**
 * The Recipe Box's pinned divider tab (VaultShelf) follows the list's own divider tabs. Where
 * the browser can, each list tab is a named view timeline that its twin in the shelf animates
 * along (index.css), so the scroll alone drives the shelf.
 */

/** The view timeline the list's divider tab at `index` brings its pinned twin in with. */
export const shelfTimeline = (index: number): string => `--vault-tab-${index}`;

/** The view timeline of that section's last card, which carries the pinned tab away. */
export const shelfEndTimeline = (index: number): string => `--vault-end-${index}`;

/**
 * Whether the browser can drive the shelf from the scroll alone: the list's tabs named as view
 * timelines, which the shelf's tabs (elsewhere in the page) can see through `timeline-scope`.
 */
export const shelfFollowsScroll = (): boolean =>
  typeof CSS !== 'undefined' &&
  CSS.supports?.('timeline-scope', '--a') === true &&
  CSS.supports?.('view-timeline-name', '--a') === true;
