import React, { useId, useRef } from 'react';
import { useFitText } from '../../hooks/useFitText';
import { mostCrowded } from '../../utils/fitText';
import {
  CalendarSync,
  Check,
  Leaf,
  LucideIcon,
  LucideProps,
  Snowflake,
  Sprout,
  Sun,
} from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { Season, SeasonPreference, SEASONS } from '../../utils/season';

const SEASON_ICONS: Record<Season, LucideIcon> = {
  spring: Sprout,
  summer: Sun,
  autumn: Leaf,
  winter: Snowflake,
};

export const SeasonIcon: React.FC<{ season: Season } & LucideProps> = ({ season, ...props }) => {
  const Icon = SEASON_ICONS[season];
  return <Icon {...props} />;
};

interface SeasonPickerProps {
  preference: SeasonPreference;
  /** The season the calendar gives today, shown under "Auto". */
  calendarSeason: Season;
  /** `origin` is the centre of the tapped option, where the new colours spread from. */
  onChange: (preference: SeasonPreference, origin: { x: number; y: number }) => void;
  t: UiTranslations;
}

// How wide a line of the option's text is with its longest word unbroken.
const lineWidth = (line: HTMLElement) => line.scrollWidth;

// The tiles' names (or notes) share one size: as wide as the grid, times how many times wider
// than its line the most crowded of them is.
const tilesWidth = (line: string) => (grid: HTMLElement) =>
  grid.clientWidth *
  mostCrowded(
    [...grid.querySelectorAll<HTMLElement>(line)].map((el) => ({
      needed: el.scrollWidth,
      available: el.clientWidth,
    })),
  );
const tileNamesWidth = tilesWidth('.season-option-name');
const tileNotesWidth = tilesWidth('.season-option-sub');

/**
 * A line of "Auto"'s text. On a narrow phone at large text it shrinks until its longest word
 * fits: full size wherever it fits, whatever the other line needs.
 */
const FitLine: React.FC<{ className: string; text: string }> = ({ className, text }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useFitText(ref, lineWidth, text);
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
};

/**
 * Radio options for the app's season: "Auto", then one tile per season. Each tile carries
 * its own `data-season`, so it's drawn in that season's colours whatever the app shows now.
 */
export const SeasonPicker: React.FC<SeasonPickerProps> = ({
  preference,
  calendarSeason,
  onChange,
  t,
}) => {
  const name = useId();
  // On a narrow phone at large text the tiles' names, and their notes, shrink alike until the
  // longest word of each fits its tile ("Wiosna" on a 320px screen), so the tiles stay matched.
  const gridRef = useRef<HTMLDivElement>(null);
  useFitText(gridRef, tileNamesWidth, SEASONS.map((s) => t.seasonNames[s]).join(), '--fit-name');
  useFitText(gridRef, tileNotesWidth, SEASONS.map((s) => t.seasonPalettes[s]).join(), '--fit-note');

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rect = (
      event.currentTarget.closest('label') ?? event.currentTarget
    ).getBoundingClientRect();
    onChange(event.currentTarget.value as SeasonPreference, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  const radio = (value: SeasonPreference) => (
    <input
      type="radio"
      className="season-radio"
      name={name}
      value={value}
      checked={preference === value}
      onChange={pick}
    />
  );

  return (
    <fieldset className="season-picker">
      <legend className="sr-only">{t.seasonSection}</legend>

      <label className={`season-auto${preference === 'auto' ? ' is-selected' : ''}`}>
        {radio('auto')}
        <span className="season-auto-wheel" aria-hidden="true">
          {SEASONS.map((season) => (
            <span key={season} data-season={season} className="season-auto-slice" />
          ))}
          <span className="season-auto-hub">
            <CalendarSync size="1.1em" strokeWidth={2} />
          </span>
        </span>
        <span className="season-option-text">
          <FitLine className="season-option-name" text={t.seasonAuto} />
          <FitLine className="season-option-sub" text={t.seasonAutoNow(calendarSeason)} />
        </span>
        <Check className="season-check" size="1.15em" strokeWidth={2.6} aria-hidden="true" />
      </label>

      <div ref={gridRef} className="season-grid">
        {SEASONS.map((season) => {
          return (
            <label
              key={season}
              data-season={season}
              className={`season-tile${preference === season ? ' is-selected' : ''}`}
            >
              {radio(season)}
              <span className="season-preview" aria-hidden="true">
                <span className="season-preview-card">
                  <span className="season-preview-photo">
                    <SeasonIcon season={season} size="1.25em" strokeWidth={1.8} />
                  </span>
                  <span className="season-preview-line is-accent" />
                  <span className="season-preview-line" />
                  <span className="season-preview-line is-short" />
                </span>
                <span className="season-preview-dots">
                  <span className="is-accent" />
                  <span className="is-gold" />
                </span>
              </span>
              <span className="season-option-text">
                <span className="season-option-name">{t.seasonNames[season]}</span>
                <span className="season-option-sub">{t.seasonPalettes[season]}</span>
              </span>
              <Check className="season-check" size="1.15em" strokeWidth={2.6} aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
