import React, { useRef } from 'react';
import { Flame, LucideIcon, Moon, Slice } from 'lucide-react';
import { RecipeTimes } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { useFitText } from '../../hooks/useFitText';
import { mostCrowded } from '../../utils/fitText';
import { TIME_KINDS, TimeKind, shownTime } from '../../utils/timeText';

const ICONS: Record<TimeKind, LucideIcon> = { prep: Slice, cook: Flame, rest: Moon };

// A narrow tile may wrap a time between its words ("przez / noc"), but never part a number
// from what follows it ("1g 10m", "2 dni").
const keepNumbersWhole = (text: string) => text.replace(/(\d\S*) /g, '$1\u00a0');

// The tiles' values (or labels) share one size: as wide as the row, times how many times wider
// than its tile the most crowded of them is.
const tilesWidth = (part: string) => (row: HTMLElement) =>
  row.clientWidth *
  mostCrowded(
    [...row.querySelectorAll<HTMLElement>(part)].map((el) => ({
      needed: el.scrollWidth,
      available: el.clientWidth,
    })),
  );
const valuesWidth = tilesWidth('.time-tile-value');
const labelsWidth = tilesWidth('.time-tile-label');

interface RecipeTimeTilesProps {
  times: RecipeTimes;
  t: UiTranslations;
}

/**
 * The times the author typed, one tile each under the byline: a knife for prep, a flame for
 * cooking, a moon for resting. Only the ones given. On a narrow phone at large text, the values
 * (and the labels) shrink alike until the widest fits, never breaking.
 */
export const RecipeTimeTiles: React.FC<RecipeTimeTilesProps> = ({ times, t }) => {
  const shown = TIME_KINDS.flatMap((kind) => {
    const time = times[kind];
    const text = time ? shownTime(time, t) : '';
    return text ? [{ kind, text }] : [];
  });
  const rowRef = useRef<HTMLDListElement>(null);
  useFitText(rowRef, valuesWidth, shown.map((s) => s.text).join(), '--fit-time');
  useFitText(rowRef, labelsWidth, shown.map((s) => t.timeLabels[s.kind]).join(), '--fit-label');
  if (shown.length === 0) return null;

  return (
    // A dl names nothing itself, so the group around it carries the name.
    <div className="time-tiles-group" role="group" aria-label={t.recipeTime}>
      <dl
        ref={rowRef}
        className="time-tiles"
        style={{ '--tiles': shown.length } as React.CSSProperties}
      >
        {shown.map(({ kind, text }) => {
          const Icon = ICONS[kind];
          return (
            <div key={kind} className="time-tile">
              <Icon className="time-tile-icon" size="1.25rem" strokeWidth={2} aria-hidden="true" />
              <dt className="time-tile-label">{t.timeLabels[kind]}</dt>
              <dd className="time-tile-value">{keepNumbersWhole(text)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
};
