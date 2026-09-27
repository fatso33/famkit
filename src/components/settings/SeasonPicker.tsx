import React, { useId } from 'react';
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
  /** The season the calendar gives today, shown under "Automatic". */
  calendarSeason: Season;
  /** `origin` is the centre of the tapped option, where the new colours spread from. */
  onChange: (preference: SeasonPreference, origin: { x: number; y: number }) => void;
  t: UiTranslations;
}

/**
 * Radio options for the app's season: "Automatic", then one tile per season. Each tile carries
 * its own `data-season`, so it's drawn in that season's colours whatever the app shows now.
 */
export const SeasonPicker: React.FC<SeasonPickerProps> = ({
  preference,
  calendarSeason,
  onChange,
  t,
}) => {
  const name = useId();

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
          <span className="season-option-name">{t.seasonAuto}</span>
          <span className="season-option-sub">{t.seasonAutoNow(calendarSeason)}</span>
        </span>
        <Check className="season-check" size="1.15em" strokeWidth={2.6} aria-hidden="true" />
      </label>

      <div className="season-grid">
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
