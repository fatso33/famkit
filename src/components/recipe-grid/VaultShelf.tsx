import React, { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { VaultTabLabel, type VaultTab } from './VaultTabLabel';

interface VaultShelfProps {
  /** The divider tabs down the list, in order. */
  tabs: VaultTab[];
  /** The list, whose `.vault-divider`s are those tabs. */
  list: RefObject<HTMLElement | null>;
}

// A name stays at least this long before the next rolls in, so a fast fling through the box
// doesn't flicker every category past: it skips to where the scroll lands.
const MIN_DWELL_MS = 240;

interface Shown {
  /** The tab named, or -1 while the list's first tab is still below the shelf. */
  index: number;
  /** The one it rolled on from, and which way: 1 down the list, -1 back up it. */
  previous: number;
  direction: 1 | -1;
  /** Counts the changes, so each roll plays afresh. */
  roll: number;
}

/**
 * The divider tab pinned under the Recipe Box's bar (it rides in the bar, so it tucks up with
 * the toolbar). It appears exactly over the list's first tab as that one reaches it, as if the
 * tab had stuck there, and from then on names the section being read: when the next section's
 * tab slides halfway under it, the name rolls over to that one, up the way the list moves (down
 * on the way back). One tab stays put rather than tabs chasing each other off the top, which
 * keeps a fast scroll calm. Decorative for screen readers, which have the list's own headings.
 */
export const VaultShelf: React.FC<VaultShelfProps> = ({ tabs, list }) => {
  const shelfRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<Shown>({ index: -1, previous: -1, direction: 1, roll: 0 });
  // Which tabs there are, in order: a filter or sort changing them moves the dividers.
  const layout = tabs.map((tab) => tab.key).join('|');

  // Scrolling is the outside system here: the shelf follows the list's position.
  useEffect(() => {
    let frame = 0;
    let timer = 0;
    let changedAt = 0;
    let wanted = -1;
    let current = -1;
    const show = (index: number) => {
      window.clearTimeout(timer);
      changedAt = performance.now();
      const from = current;
      current = index;
      setShown((s) =>
        s.index === index
          ? s
          : {
              index,
              previous: from,
              direction: index > from ? 1 : -1,
              roll: s.roll + 1,
            },
      );
    };
    const measure = () => {
      frame = 0;
      const shelf = shelfRef.current;
      const dividers = list.current?.querySelectorAll('.vault-divider');
      if (!shelf || !dividers) return;
      const { top, height } = shelf.getBoundingClientRect();
      let index = -1;
      dividers.forEach((divider, i) => {
        // The first pins as it meets the shelf; the rest take over once halfway under it.
        if (divider.getBoundingClientRect().top <= (i === 0 ? top + 0.5 : top + height / 2)) {
          index = i;
        }
      });
      if (index === wanted) return;
      wanted = index;
      // Appearing and going are immediate: the shelf takes over from a tab exactly under it.
      const wait = MIN_DWELL_MS - (performance.now() - changedAt);
      if (index < 0 || current < 0 || wait <= 0) show(index);
      else {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => show(wanted), wait);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // The list reflowing without a scroll (the text size changing, recipes or photos arriving)
    // moves its tabs too.
    const reflow = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (list.current) reflow?.observe(list.current);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reflow?.disconnect();
    };
  }, [list, layout]);

  const tab = tabs[shown.index];
  const previous = shown.previous >= 0 ? tabs[shown.previous] : undefined;
  // Going (back above the list's first tab), it keeps its last name as it fades.
  const face = tab ?? previous;
  const rolling = !!tab && !!previous;

  // The tab is as wide as the name it shows, and eases between names' widths as they roll: its
  // outline's right end slides there (index.css), which the compositor animates without laying
  // anything out again.
  // Measured again whenever the name itself resizes: the text size changing, or its font arriving.
  useLayoutEffect(() => {
    const el = tabRef.current;
    const label = labelRef.current;
    if (!el || !label) return;
    const fit = () => el.style.setProperty('--tab-width', `${label.offsetWidth}px`);
    fit();
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    resized?.observe(label);
    return () => resized?.disconnect();
  }, [face?.key, face?.label, face?.count, shown.roll]);

  return (
    <div
      ref={shelfRef}
      className="vault-shelf"
      data-shown={tab ? '' : undefined}
      aria-hidden="true"
    >
      <div className="vault-shelf-inner">
        <div ref={tabRef} className="vault-tab is-pinned">
          <span className="vault-tab-strip" />
          <span className="vault-tab-cap" />
          {rolling && previous && (
            <span
              key={`out-${shown.roll}`}
              className="vault-shelf-label is-leaving"
              data-direction={shown.direction}
            >
              <VaultTabLabel tab={previous} />
            </span>
          )}
          {face && (
            <span
              key={`in-${shown.roll}`}
              ref={labelRef}
              className={`vault-shelf-label${rolling ? ' is-arriving' : ''}`}
              data-direction={shown.direction}
            >
              <VaultTabLabel tab={face} />
            </span>
          )}
        </div>
        <div className="vault-tab-edge" />
      </div>
    </div>
  );
};
