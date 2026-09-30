import React, { useEffect, useRef, useState } from 'react';
import { Moon, ShieldAlert, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { useFontScale } from '../../hooks/useFontScale';
import { prefersReducedMotion, transitionTheme } from '../../utils/viewTransition';
import { resolveSeason, Season, SEASONS } from '../../utils/season';
import { getStoredSeasonPreference } from '../../services/storage';
import { SplashEmblem } from './SplashEmblem';
import { SeasonalField } from './SeasonalField';
import { at } from './introTiming';

/**
 * intro: the emblem draws itself and everything arrives; controls ignore taps, and a tap
 * anywhere (or keyboard focus on a control) skips to the end.
 * live: the intro has finished; the emblem simmers and the controls work.
 * skipped: like live, with the rest of the intro dropped.
 */
type Phase = 'intro' | 'live' | 'skipped';

/**
 * The season the page is showing: the one on <html>, which the particle colours in index.css
 * follow, so the particles' shapes always match their colours. That attribute can lag the
 * calendar (App updates it when the phone wakes), so it wins over a fresh calendar read. The
 * calendar is only the fallback for a page without one.
 */
function pageSeason(): Season {
  const onPage = document.documentElement.dataset.season;
  return SEASONS.includes(onPage as Season)
    ? (onPage as Season)
    : resolveSeason(getStoredSeasonPreference(), new Date());
}

const isKeyboardFocus = (el: EventTarget) => {
  try {
    return el instanceof Element && el.matches(':focus-visible');
  } catch {
    // An engine without :focus-visible: treat focus as keyboard focus.
    return true;
  }
};

const GoogleLogo: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface SplashScreenProps {
  error: string | null;
  onSignIn: () => void;
  /** Signed in: it fades away over the page arriving beneath it, then onLeft says it's gone. */
  leaving?: boolean;
  onLeft?: () => void;
}

// Longer than its fade (index.css, .fk-splash.is-leaving).
const LEAVE_MS = 600;

/**
 * The signed-out page: the emblem draws itself, "Welcome to Family Kitchen" arrives, then the
 * language, theme and text-size pills and the Google button. It reads the stored preferences
 * each time it mounts, so they're current after a sign-out.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  error,
  onSignIn,
  leaving = false,
  onLeft,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const { percent, increaseScale, decreaseScale } = useFontScale();
  const [phase, setPhase] = useState<Phase>('intro');
  const [season] = useState(pageSeason);
  // After a language change the words swap with a quick blur instead of replaying the intro.
  const [swapped, setSwapped] = useState(false);
  const [tick, setTick] = useState<'up' | 'down' | null>(null);

  // The fade waits until the page beneath has been drawn: building it takes a moment, and a fade
  // started first would already be half over when the next frame finally shows. Time, not the
  // fade's end, then decides when it's gone (a backgrounded page runs no animations).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!leaving || !onLeft) return;
    let timer = 0;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        rootRef.current?.classList.add('is-fading');
        timer = window.setTimeout(onLeft, prefersReducedMotion() ? 0 : LEAVE_MS);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [leaving, onLeft]);

  const skipIntro = () => setPhase((p) => (p === 'intro' ? 'skipped' : p));

  const swapLanguage = () => {
    toggleLanguage();
    setSwapped(true);
  };

  const switchTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const pill = e.currentTarget.getBoundingClientRect();
    transitionTheme(toggleTheme, {
      x: pill.left + pill.width / 2,
      y: pill.top + pill.height / 2,
    });
  };

  const resize = (direction: 'up' | 'down') => {
    if (direction === 'up') increaseScale();
    else decreaseScale();
    setTick(direction);
  };

  const words = t.welcomeKitchen.split(' ');

  return (
    // A tap anywhere during the intro skips it, as a touch shortcut. Keyboard users skip it
    // by moving focus to any control (onFocus), which also makes the controls usable.
    // eslint-disable-next-line jsx-a11y-x/no-static-element-interactions, jsx-a11y-x/click-events-have-key-events
    <div
      ref={rootRef}
      className={`fk-splash is-${phase}${leaving ? ' is-leaving' : ''}`}
      aria-hidden={leaving || undefined}
      inert={leaving}
      onClick={skipIntro}
      onFocus={(e) => {
        if (isKeyboardFocus(e.target)) skipIntro();
      }}
    >
      <SeasonalField season={season} layer="back" />
      <main className="fk-splash-stage">
        {/* The greeting at the top, the pot centred below it, the controls within thumb reach. */}
        <div className="fk-splash-heading">
          <h1 className="fk-splash-title">
            <span className="fk-splash-welcome">
              {swapped ? (
                <span key={language} className="fk-splash-quick">
                  {t.welcomeTo}
                </span>
              ) : (
                <span className="fk-a fk-anim-rise" style={at(2.7, 0.8)}>
                  {t.welcomeTo}
                </span>
              )}
            </span>{' '}
            <span className="fk-splash-name">
              {words.map((word, i) => (
                <React.Fragment key={`${language}-${i}`}>
                  {i > 0 && ' '}
                  {swapped ? (
                    <span
                      className="fk-splash-word fk-splash-quick"
                      style={{ animationDelay: `${i * 0.07}s` }}
                    >
                      {word}
                    </span>
                  ) : (
                    <span
                      className="fk-splash-word fk-a fk-anim-unblur"
                      style={at(2.9 + i * 0.16, 1.05)}
                    >
                      {word}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </span>
          </h1>

          <svg
            className="fk-splash-flourish"
            viewBox="0 0 160 14"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className="fk-splash-flourish-line fk-a fk-anim-draw"
              pathLength={1}
              style={at(3.25, 0.75)}
              d="M70 7.5C56 3.5 42 11 26 7.5C18 5.8 11 5.8 4 7.5"
            />
            <path
              className="fk-splash-flourish-line fk-a fk-anim-draw"
              pathLength={1}
              style={at(3.25, 0.75)}
              d="M90 7.5C104 3.5 118 11 134 7.5C142 5.8 149 5.8 156 7.5"
            />
            <g className="fk-splash-flourish-gem fk-a fk-anim-pop" style={at(3.2, 0.5)}>
              <path d="M80 12.5C77 10.5 74.5 8.3 74.5 6C74.5 4.2 75.8 3 77.3 3C78.5 3 79.5 3.7 80 4.7C80.5 3.7 81.5 3 82.7 3C84.2 3 85.5 4.2 85.5 6C85.5 8.3 83 10.5 80 12.5Z" />
            </g>
          </svg>
        </div>

        <SplashEmblem label={t.liftTheLid} canTap={phase !== 'intro'} season={season} />

        <div className="fk-splash-controls">
          <div className="fk-splash-prefs">
            <button
              type="button"
              className="fk-segmented fk-splash-pill fk-a fk-anim-pill-left"
              style={at(3.5, 0.8)}
              data-value={language}
              aria-label={t.languageToggle}
              onClick={swapLanguage}
            >
              <span className="fk-segmented-thumb" aria-hidden="true" />
              <span className={language === 'en' ? 'is-active' : ''}>EN</span>
              <span className={language === 'pl' ? 'is-active' : ''}>PL</span>
            </button>

            {/* In the middle and unfolding first: the other two slide out from behind it. */}
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label={t.darkMode}
              className="fk-segmented fk-splash-pill fk-splash-theme fk-a fk-anim-pill-mid"
              style={at(3.35, 0.75)}
              data-value={theme}
              onClick={switchTheme}
            >
              <span className="fk-segmented-thumb" aria-hidden="true" />
              <span className={theme === 'light' ? 'is-active' : ''}>
                <Sun size="1.2em" aria-hidden="true" />
              </span>
              <span className={theme === 'dark' ? 'is-active' : ''}>
                <Moon size="1.2em" aria-hidden="true" />
              </span>
            </button>

            {/* The last pill in: when it lands, the intro is over. */}
            <div
              role="group"
              aria-label={t.textScaling}
              className="fk-stepper fk-splash-pill fk-a fk-anim-pill-right"
              style={at(3.5, 0.8)}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setPhase((p) => (p === 'intro' ? 'live' : p));
              }}
            >
              <button type="button" aria-label={t.decreaseTextSize} onClick={() => resize('down')}>
                <span className="fk-splash-a is-small" aria-hidden="true">
                  A
                </span>
                −
              </button>
              <span className="fk-stepper-value" aria-live="polite">
                <span key={percent} className={tick ? `fk-splash-tick is-${tick}` : undefined}>
                  {percent}%
                </span>
              </span>
              <button type="button" aria-label={t.increaseTextSize} onClick={() => resize('up')}>
                <span className="fk-splash-a is-large" aria-hidden="true">
                  A
                </span>
                +
              </button>
            </div>
          </div>

          <div className="fk-splash-google-wrap fk-a fk-anim-rise-button" style={at(3.65, 0.8)}>
            <span
              className="fk-splash-trace fk-a fk-anim-trace"
              style={at(3.95, 1.3)}
              aria-hidden="true"
            >
              <span className="fk-splash-trace-light" />
            </span>
            {/* After the intro, the lap of light comes round again every so often. */}
            <span className="fk-splash-trace fk-splash-trace-loop" aria-hidden="true">
              <span className="fk-splash-trace-light" />
            </span>
            <button type="button" className="fk-splash-google" onClick={onSignIn}>
              <GoogleLogo />
              {swapped ? (
                <span key={language} className="fk-splash-quick">
                  {t.connectWithGoogle}
                </span>
              ) : (
                <span>{t.connectWithGoogle}</span>
              )}
              <span
                className="fk-splash-sheen fk-a fk-anim-sheen"
                style={at(4.5, 1)}
                aria-hidden="true"
              />
            </button>
          </div>

          {error && (
            <p className="fk-splash-error" role="alert">
              <ShieldAlert size="1.1em" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>
      </main>
      <SeasonalField season={season} layer="front" />
    </div>
  );
};
