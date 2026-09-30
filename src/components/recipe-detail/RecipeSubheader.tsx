import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { NumberRoll } from '../common/NumberRoll';
import { SubheaderAt, SubheaderSection, sameSubheader, subheaderAt } from '../../utils/subheader';

interface RecipeSubheaderProps {
  /** The recipe page, whose [data-subheader] sections the bar names. */
  page: RefObject<HTMLElement | null>;
}

// Only where the page is one column: side by side, both columns' headings are in view.
const ONE_COLUMN = '(max-width: 860px)';

const bottomOf = (el: Element | null) => el?.getBoundingClientRect().bottom ?? Infinity;

/**
 * Where the page's sections are now. The method is left unmeasured while it's still below the
 * bar: on phones it isn't laid out until it nears the screen (content-visibility), and
 * measuring inside it would lay it all out.
 */
function measureSections(page: HTMLElement, barBottom: number): SubheaderSection[] {
  const sections: SubheaderSection[] = [];
  for (const el of page.querySelectorAll<HTMLElement>('[data-subheader]')) {
    const scope = el.closest('.method-panel');
    if (scope && scope.getBoundingClientRect().top > barBottom) break;
    sections.push({
      name: el.dataset.subheader ?? '',
      headingBottom: bottomOf(el.querySelector('[data-subheader-title]')),
      bottom: el.getBoundingClientRect().bottom,
      groups: Array.from(el.querySelectorAll<HTMLElement>('[data-subheader-group]'), (group) => ({
        name: group.dataset.subheaderGroup ?? '',
        headingBottom: bottomOf(group.firstElementChild),
        bottom: group.getBoundingClientRect().bottom,
      })),
    });
  }
  return sections;
}

/**
 * A slim bar pinned to the top of the recipe page, naming the section being read ("Ingredients ·
 * For the sauce", "Shaping") once that section's own heading has scrolled away. It slides down as
 * the heading goes under it and back up when the section ends; the names roll the way the page
 * moves. Decorative for screen readers, which have the real headings.
 */
export const RecipeSubheader: React.FC<RecipeSubheaderProps> = ({ page }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<SubheaderAt | null>(null);
  // What the bar last named, kept on it as it slides away.
  const [last, setLast] = useState<SubheaderAt | null>(null);
  const [lastGroup, setLastGroup] = useState('');
  if (at && !sameSubheader(at, last)) setLast(at);
  if (at?.group && at.group !== lastGroup) setLastGroup(at.group);

  // Scrolling is the outside system here: the bar follows the page's scroll position.
  useEffect(() => {
    const oneColumn = window.matchMedia?.(ONE_COLUMN);
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = page.current;
      const bar = barRef.current;
      if (!el || !bar || oneColumn?.matches === false) {
        setAt(null);
        return;
      }
      // Pinned at the top, so its height is where its bottom edge sits (even while tucked away).
      const barBottom = bar.offsetHeight;
      const next = subheaderAt(measureSections(el, barBottom), barBottom);
      setAt((prev) => (sameSubheader(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    oneColumn?.addEventListener?.('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      oneColumn?.removeEventListener?.('change', schedule);
    };
  }, [page]);

  const shown = at ?? last;
  return (
    <div
      ref={barRef}
      className="recipe-subheader"
      data-shown={at ? true : undefined}
      aria-hidden="true"
    >
      <div className="recipe-subheader-inner">
        {shown && (
          <>
            <NumberRoll className="recipe-subheader-title" value={shown.title} rank={shown.index} />
            <span className="recipe-subheader-crumb" data-empty={!shown.group || undefined}>
              <NumberRoll
                value={shown.group || lastGroup}
                rank={shown.index * 1000 + shown.groupIndex}
              />
            </span>
          </>
        )}
      </div>
    </div>
  );
};
