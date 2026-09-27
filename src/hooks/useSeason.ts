import { useEffect, useState } from 'react';
import { getStoredSeasonPreference, setStoredSeasonPreference } from '../services/storage';
import {
  PAGE_BACKGROUND,
  resolveSeason,
  Season,
  SeasonPreference,
  seasonOn,
} from '../utils/season';

/**
 * Points the browser's theme colour (Android's status bar, Safari's toolbar) at the page
 * background of the current season and theme, so the bar blends into the page. Reads both
 * from <html>, where index.html's pre-paint script and the theme and season hooks set them.
 */
export function syncThemeColor(): void {
  const root = document.documentElement;
  const season = root.dataset.season as Season | undefined;
  const theme = root.dataset.theme === 'dark' ? 'dark' : 'light';
  const color = PAGE_BACKGROUND[season ?? seasonOn(new Date())]?.[theme];
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

export function useSeason() {
  const [preference, setPreferenceState] = useState<SeasonPreference>(getStoredSeasonPreference);
  const [calendarSeason, setCalendarSeason] = useState(() => seasonOn(new Date()));
  const season: Season = preference === 'auto' ? calendarSeason : preference;

  // A phone left open across 1 December moves on to winter the next time it's looked at.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setCalendarSeason(seasonOn(new Date()));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.season = season;
    syncThemeColor();
  }, [season]);

  const setPreference = (next: SeasonPreference) => {
    // Re-read the calendar too: a screen kept on (Cook Mode) never fires visibilitychange.
    if (next === 'auto') setCalendarSeason(seasonOn(new Date()));
    setPreferenceState(next);
    setStoredSeasonPreference(next);
  };

  /** The season a preference would show today, to tell whether picking it changes anything. */
  const seasonFor = (next: SeasonPreference) => resolveSeason(next, new Date());

  return { preference, season, calendarSeason, setPreference, seasonFor };
}
