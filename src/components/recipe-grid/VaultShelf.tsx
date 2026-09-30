import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { shelfFollowsScroll, shelfTimeline } from '../../utils/vaultShelf';
import { VaultTabLabel, type VaultTab } from './VaultTabLabel';

interface VaultShelfProps {
  /** The divider tabs down the list, in order. */
  tabs: VaultTab[];
  /** The list, whose `.vault-divider`s are those tabs. */
  list: RefObject<HTMLElement | null>;
}

/**
 * The divider tab pinned under the Recipe Box's bar (it rides in the bar, so it tucks up with
 * the toolbar). The list's tabs flow into it: as a section's tab slides up under the shelf, its
 * twin rises into the shelf in step with it and pushes the one above out of the top, like
 * section headers in a phone's contact list. So the shelf always names the section being read,
 * until that section's last card has gone by. Before the list's first tab reaches it, the shelf
 * isn't there at all, so that tab seems to stick.
 *
 * The scroll drives it all on the compositor (index.css): each tab in the list is a view
 * timeline its twin here follows, so nothing runs on the page's thread while it scrolls. Where
 * the browser can't do that, the shelf just names the section, found from the scroll.
 * Decorative for screen readers, which have the list's own headings.
 */
export const VaultShelf: React.FC<VaultShelfProps> = ({ tabs, list }) => {
  const shelfRef = useRef<HTMLDivElement>(null);
  const [followsScroll] = useState(shelfFollowsScroll);
  // Which tabs there are, in order: a filter or sort changing them moves the dividers.
  const layout = tabs.map((tab) => tab.key).join('|');

  // Where the scroll can't drive it: the shelf follows the list's position from here, setting
  // what it shows on the element itself, so scrolling never re-renders it.
  useEffect(() => {
    const shelf = shelfRef.current;
    if (followsScroll || !shelf) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const dividers = list.current?.querySelectorAll('.vault-divider');
      if (!dividers) return;
      const { top, height } = shelf.getBoundingClientRect();
      let index = -1;
      dividers.forEach((divider, i) => {
        // The first pins as it meets the shelf; the rest take over once halfway under it.
        if (divider.getBoundingClientRect().top <= (i === 0 ? top + 0.5 : top + height / 2)) {
          index = i;
        }
      });
      shelf.toggleAttribute('data-shown', index >= 0);
      shelf.querySelectorAll('.vault-tab.is-pinned').forEach((tab, i) => {
        tab.toggleAttribute('data-current', i === Math.max(index, 0));
      });
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
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reflow?.disconnect();
    };
  }, [followsScroll, list, layout]);

  return (
    <div
      ref={shelfRef}
      className={`vault-shelf${followsScroll ? ' follows-scroll' : ''}`}
      aria-hidden="true"
    >
      <div className="vault-shelf-inner">
        <div className="vault-shelf-tabs">
          {tabs.map((tab, i) => (
            <div
              key={tab.key}
              className="vault-tab is-pinned"
              // Rises in with its own tab in the list, and is pushed out by the next one.
              style={
                followsScroll
                  ? ({
                      // Arrives and rises with its own tab; pushed out by the next (the last
                      // never is, index.css).
                      '--shelf-timelines': [i, i, i + 1]
                        .filter((n) => n < tabs.length)
                        .map(shelfTimeline)
                        .join(', '),
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <VaultTabLabel tab={tab} />
            </div>
          ))}
        </div>
        <div className="vault-tab-edge" />
      </div>
    </div>
  );
};
