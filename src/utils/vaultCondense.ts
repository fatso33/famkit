/**
 * The vault banner's title condensing into the pinned bar's small title as the page scrolls
 * (VaultHeader measures, index.css animates on the scroll timeline). Positions are in page
 * coordinates, i.e. measured on screen plus the scroll at the time.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CondenseLayout {
  /** The banner's heading, which holds only the big title (untransformed). */
  heading: Box;
  /** The big title's own size and font size. */
  title: { width: number; height: number; fontSize: number };
  /** The pinned bar's small title. */
  name: { width: number; height: number; fontSize: number };
  /** The strip the small title is centred in, drawn above the bar (horizontal extent). */
  strip: { left: number; width: number; height: number };
  /** Where the banner ends: the bar starts right under it. */
  mastheadBottom: number;
  /** The bar's sticky offset from the top of the screen. */
  stuckAt: number;
}

export interface Condense {
  /** The scroll at which the bar pins: the title has fully condensed by then. */
  pin: number;
  /** How far the big title moves (from its own place) and shrinks to sit on the small one. */
  dx: number;
  dy: number;
  scale: number;
}

export function condenseGeometry(layout: CondenseLayout): Condense {
  const { heading, title, name, strip, mastheadBottom, stuckAt } = layout;
  const pin = Math.max(0, mastheadBottom - stuckAt);
  // Pinned, the strip's bottom edge is the bar's top, at its sticky offset.
  const toX = strip.left + strip.width / 2;
  const toY = stuckAt - strip.height / 2;
  const fromX = heading.left + heading.width / 2;
  // On screen when the bar pins, the title has been carried up by the scroll.
  const fromY = heading.top + heading.height / 2 - pin;
  const fontRatio = title.fontSize > 0 ? name.fontSize / title.fontSize : 1;
  // Matching widths lands the words exactly on each other. A title wrapped onto two lines
  // can't match the one-line small title, so it shrinks by the font sizes instead.
  const wrapped = title.height * fontRatio > name.height * 1.6;
  const scale = !wrapped && title.width > 0 ? name.width / title.width : fontRatio;
  return { pin, dx: toX - fromX, dy: toY - fromY, scale };
}
