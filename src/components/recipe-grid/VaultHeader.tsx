import React, { useLayoutEffect, useRef } from 'react';
import { UiTranslations } from '../../i18n/translations';

interface VaultHeaderProps {
  counts: { recipes: number; cooks: number };
  /** Plays the banner's entrance (arriving at the vault, not coming back from a recipe). */
  entering: boolean;
  /** The toolbar, pinned under the title while the vault scrolls. */
  children: React.ReactNode;
  t: UiTranslations;
}

// How far the page must travel down before the pinned toolbar tucks away, and back up before
// it returns: a small jiggle of the finger shouldn't flicker it.
const TUCK_AFTER_PX = 24;
const SHOW_AFTER_PX = 6;

/**
 * The vault's banner: "Recipe Vault" over the splash's heart flourish and a count of recipes
 * and cooks. As the page scrolls it sinks away (a scroll-driven animation in index.css), and
 * when the bar holding the toolbar reaches the top it pins there, gaining a background and a
 * small "Recipe Vault" title.
 *
 * Pinned, the toolbar tucks away under the title while the page scrolls down, leaving only the
 * title strip with a small heart flourish, and comes back on any scroll up. The banner's own
 * flourish and count fold away once the page leaves the top, and draw in again only when it is
 * back at the very top, not while the banner is still sliding into place.
 *
 * All of this is set on the elements directly (data attributes), not in React state, so
 * scrolling never re-renders the vault.
 */
export const VaultHeader: React.FC<VaultHeaderProps> = ({ counts, entering, children, t }) => {
  const mastheadRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // A layout effect, so the bar is already right on the first frame: coming back from a
  // recipe restores a scrolled-down vault inside the page transition's snapshot.
  useLayoutEffect(() => {
    const bar = barRef.current;
    const masthead = mastheadRef.current;
    if (!bar || !masthead) return;
    let frame = 0;
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
      const stuckAt = parseFloat(getComputedStyle(bar).top) || 0;
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
    // Keyboard focus reaching the tucked toolbar brings it back.
    const onFocusIn = () => {
      travel = 0;
      bar.toggleAttribute('data-tucked', false);
    };
    update();
    // Only now may their states animate: the first reading applies at once. Styles are flushed
    // first, so the first reading can't be taken for a change.
    void getComputedStyle(masthead).opacity;
    bar.toggleAttribute('data-ready', true);
    masthead.toggleAttribute('data-ready', true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    bar.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      bar.removeEventListener('focusin', onFocusIn);
      cancelAnimationFrame(frame);
    };
  }, []);

  const words = t.vaultTitle.split(' ');

  return (
    <>
      <header ref={mastheadRef} className={`vault-masthead${entering ? ' is-entering' : ''}`}>
        <div className="vault-masthead-inner">
          <h1 className="vault-heading">
            <span className="vault-title">
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
          <Flourish className="vault-flourish" />
          {counts.recipes > 0 && (
            <p className="vault-caption">{t.vaultCaption(counts.recipes, counts.cooks)}</p>
          )}
        </div>
      </header>

      <div ref={barRef} className="vault-bar">
        {/* The pinned title repeats the heading for sighted users only. */}
        <div className="vault-bar-title" aria-hidden="true">
          <span className="vault-bar-name">{t.vaultTitle}</span>
          <Flourish className="vault-bar-flourish" />
        </div>
        <div className="vault-bar-tools">{children}</div>
      </div>
    </>
  );
};

/** The splash's heart flourish: a line drawn out to each side of a small heart. */
const Flourish: React.FC<{ className: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 160 14" aria-hidden="true" focusable="false">
    <path
      className="vault-flourish-line"
      pathLength={1}
      d="M70 7.5C56 3.5 42 11 26 7.5C18 5.8 11 5.8 4 7.5"
    />
    <path
      className="vault-flourish-line"
      pathLength={1}
      d="M90 7.5C104 3.5 118 11 134 7.5C142 5.8 149 5.8 156 7.5"
    />
    <path
      className="vault-flourish-heart"
      d="M80 12.5C77 10.5 74.5 8.3 74.5 6C74.5 4.2 75.8 3 77.3 3C78.5 3 79.5 3.7 80 4.7C80.5 3.7 81.5 3 82.7 3C84.2 3 85.5 4.2 85.5 6C85.5 8.3 83 10.5 80 12.5Z"
    />
  </svg>
);
