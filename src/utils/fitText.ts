/** The least text is shrunk to: past this, a word is better off running over than unreadable. */
export const MIN_FIT = 0.5;

/**
 * How much text must shrink, as a factor of its full size, for something `needed` wide at full
 * size to fit `available`: 1 where it already fits. Rounded down to hundredths, so what it gives
 * always fits; never below MIN_FIT.
 */
export function fitScale(available: number, needed: number): number {
  if (!(available > 0) || !(needed > available)) return 1;
  return Math.max(MIN_FIT, Math.floor((available / needed) * 100) / 100);
}

/**
 * How many times wider than its room the most crowded of several lines is at full size, so they
 * can all shrink alike until it fits: below 1 where all fit, 0 where none has room to measure.
 */
export function mostCrowded(lines: readonly { needed: number; available: number }[]): number {
  let most = 0;
  for (const { needed, available } of lines) {
    if (available > 0) most = Math.max(most, needed / available);
  }
  return most;
}

/**
 * The widest run of parts a line can't break between: the widths of words set side by side,
 * with null wherever a space lets the line break (e.g. a name and the "?" after it are one run).
 */
export function widestRun(parts: readonly (number | null)[]): number {
  let widest = 0;
  let run = 0;
  for (const part of parts) {
    run = part === null ? 0 : run + part;
    widest = Math.max(widest, run);
  }
  return widest;
}

/** Below this, a tool strip's labels are too small to read, so its keys take two rows instead. */
export const MIN_ONE_ROW_FIT = 0.8;

/**
 * How many rows a strip of `keys` takes, given how far its labels must shrink to fit on one:
 * two (three keys over two) when one row would shrink them past MIN_ONE_ROW_FIT. A strip of
 * three keys or fewer has room on one row.
 */
export function toolStripRows(oneRowScale: number, keys: number): 1 | 2 {
  return oneRowScale < MIN_ONE_ROW_FIT && keys > 3 ? 2 : 1;
}
