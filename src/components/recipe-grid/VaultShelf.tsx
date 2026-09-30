import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { shelfEndTimeline, shelfFollowsScroll, shelfTimeline } from '../../utils/vaultShelf';
import { VaultTabLabel, type VaultTab } from './VaultTabLabel';

interface VaultShelfProps {
  /** The divider tabs down the list, in order. */
  tabs: VaultTab[];
  /** The list, whose `.vault-divider`s are those tabs, each heading a `.vault-group`. */
  list: RefObject<HTMLElement | null>;
}

/**
 * The divider tab pinned under the Recipe Box's bar (it rides in the bar, so it tucks up with
 * the toolbar). As a section's tab reaches it, the tab seems to stick there: its twin appears
 * exactly over it, on a band as wide as the bar that the section's cards slip under. It stays
 * until the section's last card comes up to it, then rides away on top of that card, as if
 * fixed to it, and the next section's tab comes up the list to take its place. Scrolling back,
 * it comes down on that card and sticks again.
 *
 * The scroll drives it all on the compositor (index.css): the list's tab and the section's
 * last card are view timelines the band follows, so nothing runs on the page's thread while
 * it scrolls. Where the browser can't do that, the shelf shows the section being read, found
 * from the scroll. Decorative for screen readers, which have the list's own headings.
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
        if (divider.getBoundingClientRect().top <= top + 0.5) index = i;
      });
      // Gone with its section's last card, once that card is halfway up it.
      const last = index >= 0 ? dividers[index].parentElement?.lastElementChild : null;
      const carried = !!last && last.getBoundingClientRect().top <= top + height / 2;
      shelf.toggleAttribute('data-shown', index >= 0 && !carried);
      shelf.querySelectorAll('.vault-shelf-band').forEach((band, i) => {
        band.toggleAttribute('data-current', i === index);
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
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          className="vault-shelf-band"
          // Appears with its own tab in the list; carried away by the section's last card.
          style={
            followsScroll
              ? ({
                  '--band-timelines': `${shelfTimeline(i)}, ${shelfEndTimeline(i)}`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <div className="vault-shelf-inner">
            <div className="vault-tab is-pinned">
              <VaultTabLabel tab={tab} />
            </div>
            <div className="vault-tab-edge" />
          </div>
        </div>
      ))}
    </div>
  );
};
