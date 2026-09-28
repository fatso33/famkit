import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { UiTranslations } from '../../i18n/translations';
import { prefersReducedMotion } from '../../utils/viewTransition';

interface VaultHeaderProps {
  counts: { recipes: number; cooks: number };
  /** Plays the banner's entrance (arriving at the vault, not coming back from a recipe). */
  entering: boolean;
  /** The toolbar, pinned under the title while the vault scrolls. */
  children: React.ReactNode;
  t: UiTranslations;
}

/**
 * The vault's banner: "The Family / Recipe Vault" over the heart flourish and a count of
 * recipes and cooks. As the page scrolls it sinks away (a scroll-driven animation in
 * index.css), and when the bar holding the toolbar reaches the top it pins there, gaining a
 * background and a small "Recipe Vault" title. Scrolling back up hands the banner back, and
 * its flourish draws itself again as it comes fully back into view.
 *
 * The bar's pinned state is set on the element directly (data-condensed), not in React
 * state, so scrolling never re-renders the vault.
 */
export const VaultHeader: React.FC<VaultHeaderProps> = ({ counts, entering, children, t }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const barTitleRef = useRef<HTMLDivElement>(null);
  const flourishRef = useRef<SVGSVGElement>(null);

  // A layout effect, so the bar is already right on the first frame: coming back from a
  // recipe restores a scrolled-down vault inside the page transition's snapshot.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let frame = 0;
    // Pinned once the bar has reached its sticky offset (the pinned title's height).
    const update = () => {
      frame = 0;
      const stuckAt = parseFloat(getComputedStyle(bar).top) || 0;
      bar.toggleAttribute('data-condensed', bar.getBoundingClientRect().top <= stuckAt + 0.5);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    // Only now may its state animate: the first reading applies at once.
    bar.toggleAttribute('data-ready', true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // The flourish draws itself again each time it comes fully back into view from under the
  // bar, so scrolling back to the top ends on a flourish. Not on the first sighting: the
  // entrance draws it then.
  useEffect(() => {
    const flourish = flourishRef.current;
    const barTitle = barTitleRef.current;
    if (!flourish || !barTitle || typeof IntersectionObserver === 'undefined') return;
    let hidden: boolean | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hidden) redrawFlourish(flourish);
        hidden = !entry.isIntersecting;
      },
      { threshold: 1, rootMargin: `-${barTitle.offsetHeight * 2}px 0px 0px 0px` },
    );
    observer.observe(flourish);
    return () => observer.disconnect();
  }, []);

  const words = t.vaultTitle.split(' ');

  return (
    <>
      <header className={`vault-masthead${entering ? ' is-entering' : ''}`}>
        <div className="vault-masthead-inner">
          <h1 className="vault-heading">
            <span className="vault-kicker">{t.vaultKicker}</span>{' '}
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
          {/* The splash's heart flourish, drawn out from the heart. */}
          <svg
            ref={flourishRef}
            className="vault-flourish"
            viewBox="0 0 160 14"
            aria-hidden="true"
            focusable="false"
          >
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
          {counts.recipes > 0 && (
            <p className="vault-caption">{t.vaultCaption(counts.recipes, counts.cooks)}</p>
          )}
        </div>
      </header>

      <div ref={barRef} className="vault-bar">
        {/* The pinned title repeats the heading for sighted users only. */}
        <div ref={barTitleRef} className="vault-bar-title" aria-hidden="true">
          <span>{t.vaultTitle}</span>
        </div>
        {children}
      </div>
    </>
  );
};

/** The flourish draws itself out from the heart again, and the heart gives one soft beat. */
function redrawFlourish(svg: SVGSVGElement | null) {
  if (!svg?.animate || prefersReducedMotion()) return;
  for (const line of svg.querySelectorAll('.vault-flourish-line')) {
    line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: 760,
      easing: 'cubic-bezier(0.5, 0.05, 0.25, 1)',
      delay: 60,
      fill: 'backwards',
    });
  }
  svg
    .querySelector('.vault-flourish-heart')
    ?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.32)', offset: 0.35 },
        { transform: 'scale(0.94)', offset: 0.7 },
        { transform: 'scale(1)' },
      ],
      { duration: 620, easing: 'ease-in-out' },
    );
}
