import React, { RefObject, useLayoutEffect, useRef } from 'react';
import { UiTranslations } from '../../i18n/translations';
import { fitScale } from '../../utils/fitText';

export type JumpPlace = 'ingredients' | 'steps' | 'extras';

interface EditorJumpPillsProps {
  /** Shown once the page is scrolled into the recipe (see AddRecipeModal's scroll rules). */
  shown: boolean;
  /** The place being read, lit. */
  current: JumpPlace;
  /** The places there are (in Read, extras only when the tip or source is written). */
  places: JumpPlace[];
  onJump: (place: JumpPlace) => void;
  /** The pills' box, which a jump lands clear of. */
  ref?: RefObject<HTMLElement | null>;
  t: UiTranslations;
}

/**
 * The jump pills: Ingredients · Method · Tip and source, in one glass capsule under the editor's
 * bar. The lit one is a thumb that slides between them. Put away, they're out of reach.
 *
 * Never cut off: where the capsule doesn't fit (a narrow phone, large text) the pills take their
 * short names, closer together (data-fit="short": Ingredients · Steps · Tip), and only if that
 * still doesn't fit does their text shrink (--fit), as the app's other too-wide words do.
 */
export const EditorJumpPills: React.FC<EditorJumpPillsProps> = ({
  shown,
  current,
  places,
  onJump,
  ref,
  t,
}) => {
  const own = useRef<HTMLElement>(null);
  const nav = ref ?? own;
  const row = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  // Fitted first, then the thumb put under the lit pill: measured, and moved by transform (its
  // width follows). Its first placing doesn't slide in from the start. Again whenever the width
  // changes (text size, rotation) or a font arrives, which widens the words.
  useLayoutEffect(() => {
    const box = nav.current;
    const pills = row.current;
    const mark = thumb.current;
    if (!box || !pills || !mark) return;
    const fit = () => {
      box.style.removeProperty('--fit');
      box.dataset.fit = 'full';
      const style = getComputedStyle(box);
      // Inside the capsule's edge: the room its pills (and its padding) have.
      const available =
        box.clientWidth -
        parseFloat(style.paddingLeft || '0') -
        parseFloat(style.paddingRight || '0') -
        (pills.offsetWidth - pills.clientWidth);
      if (pills.scrollWidth <= available) return;
      box.dataset.fit = 'short';
      // The capsule's own padding doesn't shrink, so the scale is worked out twice.
      for (let i = 0; i < 2 && pills.scrollWidth > available + 0.5; i++) {
        const now = parseFloat(box.style.getPropertyValue('--fit') || '1');
        box.style.setProperty('--fit', String(now * fitScale(available, pills.scrollWidth)));
      }
    };
    const place = () => {
      const pill = pills.querySelector<HTMLElement>(`[data-place="${current}"]`);
      if (!pill) {
        mark.style.opacity = '0';
        return;
      }
      if (!placed.current) mark.style.transition = 'none';
      mark.style.opacity = '';
      mark.style.width = `${pill.offsetWidth}px`;
      mark.style.transform = `translateX(${pill.offsetLeft}px)`;
      if (!placed.current) {
        void mark.offsetWidth;
        mark.style.transition = '';
        placed.current = true;
      }
    };
    fit();
    place();
    let width = box.clientWidth;
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        fit();
        place();
      });
    };
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (box.clientWidth === width) return;
            width = box.clientWidth;
            again();
          });
    observer?.observe(box);
    document.fonts?.addEventListener?.('loadingdone', again);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', again);
    };
  }, [nav, current, places.length]);

  const names: Record<JumpPlace, [full: string, short: string]> = {
    ingredients: [t.ingredients, t.ingredients],
    steps: [t.jumpMethod, t.stepsHeading],
    extras: [t.jumpExtras, t.tip],
  };

  return (
    <nav ref={nav} className="editor-jump" data-shown={shown} aria-label={t.jumpTo} inert={!shown}>
      <div ref={row} className="editor-jump-row">
        <span ref={thumb} className="editor-jump-thumb" aria-hidden="true" />
        {places.map((place) => (
          <button
            key={place}
            type="button"
            className="editor-jump-pill"
            data-place={place}
            // Its full name, whichever it shows.
            aria-label={names[place][0]}
            aria-current={place === current ? 'location' : undefined}
            onClick={() => onJump(place)}
          >
            <span className="editor-jump-full" aria-hidden="true">
              {names[place][0]}
            </span>
            <span className="editor-jump-short" aria-hidden="true">
              {names[place][1]}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
