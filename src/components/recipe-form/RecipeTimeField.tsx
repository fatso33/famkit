import React, { useId } from 'react';
import { Clock, Flame, LucideIcon, Moon, Slice, Sparkles } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { TIME_KINDS, TimeKind, TimeTexts, parseDuration } from '../../utils/timeText';

const ICONS: Record<TimeKind, LucideIcon> = { prep: Slice, cook: Flame, rest: Moon };

interface RecipeTimeFieldProps {
  times: TimeTexts;
  /** An older recipe's single total, in minutes, while no time is typed; null when none. */
  manualMinutes: number | null;
  /** The estimate from the steps as they are now: 0 while there are none. */
  estimate: number;
  onChange: (kind: TimeKind, text: string) => void;
  t: UiTranslations;
}

/**
 * The recipe's times, typed as the author would say them: prep, cook and rest. Under each, how
 * it reads ("1h 10m"), or that it'll be shown as typed. While the cook time is empty, the steps'
 * estimate is offered for it.
 */
export const RecipeTimeField: React.FC<RecipeTimeFieldProps> = ({
  times,
  manualMinutes,
  estimate,
  onChange,
  t,
}) => {
  const id = useId();
  const typed = TIME_KINDS.some((kind) => times[kind].trim());

  const reading = (kind: TimeKind) => {
    const text = times[kind].trim();
    if (!text) return null;
    const minutes = parseDuration(text);
    return minutes === null ? (
      <span className="time-entry-reading is-as-typed">{t.timeAsTyped}</span>
    ) : (
      <span className="time-entry-reading">{t.totalTime(minutes)}</span>
    );
  };

  return (
    <div className="time-field" role="group" aria-labelledby={`${id}-label`}>
      <div className="form-label time-field-label" id={`${id}-label`}>
        <Clock size="1.1em" aria-hidden="true" />
        {t.recipeTime}
      </div>
      <div className={`time-field-card${typed ? ' is-set' : ''}`}>
        {TIME_KINDS.map((kind) => {
          const Icon = ICONS[kind];
          return (
            <div key={kind} className="time-entry">
              <Icon className="time-entry-icon" size="1.25rem" aria-hidden="true" />
              <label className="time-entry-label" htmlFor={`${id}-${kind}`}>
                {t.timeLabels[kind]}
              </label>
              <input
                id={`${id}-${kind}`}
                className="form-control time-entry-input"
                type="text"
                autoComplete="off"
                enterKeyHint="next"
                maxLength={80}
                aria-describedby={`${id}-hint`}
                value={times[kind]}
                onChange={(e) => onChange(kind, e.target.value)}
              />
              <span className="time-entry-status" aria-live="polite">
                {reading(kind)}
              </span>
            </div>
          );
        })}
        <p className="time-field-hint" id={`${id}-hint`}>
          {t.timesHint}
        </p>
        {!typed && manualMinutes !== null && (
          <p className="time-field-hint">{t.timeSetBefore(t.totalTime(manualMinutes))}</p>
        )}
        {!times.cook.trim() &&
          (estimate > 0 ? (
            <button
              type="button"
              className="time-suggest"
              onClick={() => onChange('cook', t.totalTime(estimate))}
            >
              <Sparkles size="1em" aria-hidden="true" />
              {t.stepsSuggest(t.estimatedTime(estimate))}
            </button>
          ) : (
            !typed && <p className="time-field-hint">{t.timeFromSteps}</p>
          ))}
      </div>
    </div>
  );
};
