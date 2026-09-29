/**
 * The lines a fork hangs from: one line from the middle of the method that splits into a branch
 * for each path's switch button, and after the path, the branches joining back into the step
 * that follows. Coordinates are in pixels, measured from the fork's own box.
 */

/** How tall the split above the switch is. */
export const SPLIT_HEIGHT = 52;
/** How tall the join below the chosen path is. */
export const JOIN_HEIGHT = 46;
/** The straight run between the middle and the curve. */
const STEM = 12;

const at = (n: number) => Math.round(n * 10) / 10;

/** A branch from the top middle (`centre`) down to the top of the button at `to`. */
export function splitPath(centre: number, to: number, height = SPLIT_HEIGHT): string {
  const cx = at(centre);
  const x = at(to);
  if (Math.abs(x - cx) < 1) return `M${cx} 0V${height}`;
  const mid = at((STEM + height) / 2);
  return `M${cx} 0V${STEM}C${cx} ${mid} ${x} ${mid} ${x} ${height}`;
}

/** A branch from under the path at `from` back to the bottom middle (`centre`). */
export function joinPath(centre: number, from: number, height = JOIN_HEIGHT): string {
  const cx = at(centre);
  const x = at(from);
  if (Math.abs(x - cx) < 1) return `M${x} 0V${height}`;
  const mid = at((height - STEM) / 2);
  return `M${x} 0C${x} ${mid} ${cx} ${mid} ${cx} ${height - STEM}V${height}`;
}

/** How far the switch's names may shrink before a long word has to hyphenate... */
export const LABEL_FIT_FLOOR = 0.8;
/** ...or further, while they stay at least this big (px), for large text on narrow buttons. */
export const LABEL_MIN_PX = 14;

/** The floor for names whose full size is `fontPx`: 80%, or down to 14px if that's lower. */
export function labelFloor(fontPx: number): number {
  if (!(fontPx > 0)) return LABEL_FIT_FLOOR;
  return Math.min(LABEL_FIT_FLOOR, LABEL_MIN_PX / fontPx);
}

/**
 * Whether the words can't sit whole even with the columns sharing the width unevenly: the
 * widest word of each name at `scale`, plus each button's padding (`pad`) and the gaps between
 * buttons (`gap`), is more than the switch's `width`.
 */
export function labelsOverflow(
  widest: number[],
  scale: number,
  pad: number,
  gap: number,
  width: number,
): boolean {
  if (!(width > 0)) return false;
  const need = widest.reduce((sum, word) => sum + word * scale + pad, 0);
  return need + gap * (widest.length - 1) > width + 0.5;
}

/**
 * How far to shrink a switch's names so every word fits its button whole: 1 when they already
 * fit, never below `floor`. All the names shrink together, so the buttons stay a matched set.
 * `room` is each name's width; `widest` is its widest word at full size.
 */
export function labelFit(room: number[], widest: number[], floor = LABEL_FIT_FLOOR): number {
  let fit = 1;
  room.forEach((width, i) => {
    const word = widest[i] ?? 0;
    if (width > 0 && word > width) fit = Math.min(fit, width / word);
  });
  return Math.max(floor, Math.floor(fit * 1000) / 1000);
}
