import React, { useLayoutEffect, useRef } from 'react';
import { UiTranslations } from '../../i18n/translations';
import { condenseGeometry, condenseSnap } from '../../utils/vaultCondense';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { HeartFlourish } from '../common/HeartFlourish';

interface VaultHeaderProps {
  counts: { recipes: number; cooks: number };
  /** Plays the banner's entrance (arriving at the vault, not coming back from a recipe). */
  entering: boolean;
  /** The toolbar, pinned under the title while the vault scrolls. */
  children: React.ReactNode;
  /** The pinned divider tab (VaultShelf), under the toolbar and tucking up with it. */
  shelf?: React.ReactNode;
  t: UiTranslations;
}

// How far the page must travel down before the pinned toolbar tucks away, and back up before
// it returns: a small jiggle of the finger shouldn't flicker it.
const TUCK_AFTER_PX = 24;
const SHOW_AFTER_PX = 6;

/**
 * The vault's banner: "Recipe Box" over the splash's heart flourish and a count of recipes
 * and cooks. When the bar holding the toolbar reaches the top it pins there, gaining a
 * background and a small "Recipe Box" title. Where the browser has scroll-driven animations,
 * the big title shrinks into the small one as the page scrolls, tracking the finger (index.css,
 * from the geometry measured here), and grows back out of it on the way up. A scroll that stops
 * halfway settles onward, so the title is never left between sizes.
 *
 * Pinned, the toolbar tucks away under the title while the page scrolls down, leaving only the
 * title strip with a small heart flourish, and comes back on any scroll up. The banner's own
 * flourish and count fold away once the page leaves the top, and draw in again only when it is
 * back at the very top, not while the banner is still sliding into place.
 *
 * Under the toolbar hangs the pinned divider tab (the shelf), which rides up with the toolbar
 * as it tucks. The list's cards lean back and slip under it (index.css).
 *
 * All of this is set on the elements directly (data attributes), not in React state, so
 * scrolling never re-renders the vault.
 */
export const VaultHeader: React.FC<VaultHeaderProps> = ({
  counts,
  entering,
  children,
  shelf,
  t,
}) => {
  const mastheadRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);

  // A layout effect, so the bar is already right on the first frame: coming back from a
  // recipe restores a scrolled-down vault inside the page transition's snapshot.
  useLayoutEffect(() => {
    const bar = barRef.current;
    const masthead = mastheadRef.current;
    const heading = headingRef.current;
    const title = titleRef.current;
    const strip = stripRef.current;
    const name = nameRef.current;
    if (!bar || !masthead || !heading || !title || !strip || !name) return;
    let frame = 0;
    // The scroll at which the bar pins, where the title has fully condensed.
    let pin = 0;
    // How far below the top the bar sticks (the pinned title's height), read once per layout
    // change rather than on every frame of a scroll.
    let stuckAt = 0;
    const condenses =
      typeof CSS !== 'undefined' &&
      CSS.supports?.('animation-timeline: scroll()') === true &&
      !prefersReducedMotion();

    // Where the title starts and ends, for the scroll-driven condense. Measured again whenever
    // any of it changes size (fonts arriving, the language or text size changing).
    const measure = () => {
      const y = window.scrollY;
      stuckAt = parseFloat(getComputedStyle(bar).top) || 0;
      const box = heading.getBoundingClientRect();
      const stripBox = strip.getBoundingClientRect();
      const geometry = condenseGeometry({
        heading: { left: box.left, top: box.top + y, width: box.width, height: box.height },
        title: {
          width: title.offsetWidth,
          height: title.offsetHeight,
          fontSize: parseFloat(getComputedStyle(title).fontSize) || 0,
        },
        name: {
          width: name.offsetWidth,
          height: name.offsetHeight,
          fontSize: parseFloat(getComputedStyle(name).fontSize) || 0,
        },
        strip: { left: stripBox.left, width: stripBox.width, height: stripBox.height },
        mastheadBottom: masthead.getBoundingClientRect().bottom + y,
        stuckAt,
      });
      pin = geometry.pin;
      for (const el of [masthead, bar]) {
        el.style.setProperty('--vault-pin', `${geometry.pin.toFixed(1)}px`);
      }
      masthead.style.setProperty('--vault-title-dx', `${geometry.dx.toFixed(1)}px`);
      masthead.style.setProperty('--vault-title-dy', `${geometry.dy.toFixed(1)}px`);
      masthead.style.setProperty('--vault-title-scale', geometry.scale.toFixed(4));
    };
    let lastY = window.scrollY;
    // Distance travelled in the current direction: positive down, negative up.
    let travel = 0;
    const update = () => {
      frame = 0;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      // Clamped, so the rubber band past either end doesn't count as scrolling back.
      const y = Math.min(Math.max(window.scrollY, 0), Math.max(maxY, 0));
      const dy = y - lastY;
      lastY = y;
      masthead.toggleAttribute('data-away', y > 1);

      // Pinned once the bar has reached its sticky offset (the pinned title's height).
      const pinned = bar.getBoundingClientRect().top <= stuckAt + 0.5;
      bar.toggleAttribute('data-condensed', pinned);

      if (dy !== 0 && Math.sign(dy) !== Math.sign(travel)) travel = 0;
      travel += dy;
      // Never while someone is using the toolbar: typing a search, or in a menu. (A button that
      // keeps focus after a tap doesn't count.)
      const active = document.activeElement;
      const typing = active instanceof HTMLInputElement && bar.contains(active);
      const inUse = typing || !!bar.querySelector('.vault-popover-layer');
      if (!pinned || inUse || travel < -SHOW_AFTER_PX) bar.toggleAttribute('data-tucked', false);
      else if (travel > TUCK_AFTER_PX) bar.toggleAttribute('data-tucked', true);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Came to rest halfway through the condense: carry on to the end the page was moving
    // towards.
    const onScrollEnd = () => {
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const target = condenseSnap(window.scrollY, pin, maxY, travel < 0);
      if (target !== null) window.scrollTo({ top: target, behavior: 'smooth' });
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    // Keyboard focus reaching the tucked toolbar brings it back.
    const onFocusIn = () => {
      travel = 0;
      bar.toggleAttribute('data-tucked', false);
    };
    measure();
    update();
    // Only now may their states animate: the first reading applies at once. Styles are flushed
    // first, so the first reading can't be taken for a change.
    void getComputedStyle(masthead).opacity;
    bar.toggleAttribute('data-ready', true);
    masthead.toggleAttribute('data-ready', true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    if (condenses) window.addEventListener('scrollend', onScrollEnd);
    bar.addEventListener('focusin', onFocusIn);
    // The page holding the banner too: something appearing above it (the install card) moves
    // the banner without resizing it, and the page grows or shrinks with it.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    for (const el of [masthead, title, name, masthead.parentElement]) if (el) observer?.observe(el);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scrollend', onScrollEnd);
      bar.removeEventListener('focusin', onFocusIn);
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const words = t.vaultTitle.split(' ');

  return (
    <>
      <header ref={mastheadRef} className={`vault-masthead${entering ? ' is-entering' : ''}`}>
        <div className="vault-masthead-inner">
          <h1 ref={headingRef} className="vault-heading">
            <span ref={titleRef} className="vault-title">
              {words.map((word, i) => (
                <React.Fragment key={`${t.vaultTitle}-${i}`}>
                  {i > 0 && ' '}
                  <span className="vault-word" style={{ '--i': i } as React.CSSProperties}>
                    {word}
                  </span>
                </React.Fragment>
              ))}
            </span>
          </h1>
          <div className="vault-masthead-extras">
            <HeartFlourish className="vault-flourish" />
            {counts.recipes > 0 && (
              <p className="vault-caption">{t.vaultCaption(counts.recipes, counts.cooks)}</p>
            )}
          </div>
        </div>
      </header>

      <div ref={barRef} className="vault-bar">
        {/* The pinned title repeats the heading for sighted users only. */}
        <div ref={stripRef} className="vault-bar-title" aria-hidden="true">
          <span ref={nameRef} className="vault-bar-name">
            {t.vaultTitle}
          </span>
          <HeartFlourish className="vault-bar-flourish" />
        </div>
        <div className="vault-bar-tools">
          <div className="vault-bar-toolset">{children}</div>
          <div className="vault-bar-shelf">{shelf}</div>
        </div>
      </div>
    </>
  );
};
