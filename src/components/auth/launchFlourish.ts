/**
 * When the launch screen last came and went, on the page's clock: whether its heart flourish was
 * showing when the app arrived (LaunchScreen keeps this, My Counter asks).
 */
let shownAt: number | null = null;
let goneAt: number | null = null;

// Its flourish starts showing 0.7s in and has drawn most of its lines by 1.3s (index.css).
const FLOURISH_SHOWING_MS = 1300;
// The page replacing it asks straight away; any later, it's some other arrival.
const JUST_GONE_MS = 600;

/** The launch screen has come up. */
export function launchScreenShown(): void {
  shownAt = performance.now();
  goneAt = null;
}

/** The launch screen has gone. */
export function launchScreenGone(): void {
  goneAt = performance.now();
}

/**
 * Where the launch screen's heart flourish was, if it was showing as the app arrived just now:
 * My Counter's flourish then glides up from there instead of drawing in. Only just after the
 * launch screen went: any later arrival of the counter is another one.
 */
export function launchFlourishShown(): DOMRectReadOnly | null {
  const was = shownAt;
  const gone = goneAt;
  if (was === null || gone === null) return null;
  if (gone - was < FLOURISH_SHOWING_MS || performance.now() - gone > JUST_GONE_MS) return null;
  // As index.css lays it out: 10rem wide, centred, with 8vh of margin under it.
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const width = 10 * rem;
  const height = (width * 14) / 160;
  const vh = window.innerHeight;
  return new DOMRectReadOnly(
    (window.innerWidth - width) / 2,
    (vh - (height + 0.08 * vh)) / 2,
    width,
    height,
  );
}
