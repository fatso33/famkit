import React, { useId } from 'react';
import { Clock, Minus, PencilLine, Plus, Sparkles } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { NumberRoll } from '../common/NumberRoll';
import { Reveal } from '../common/Reveal';

interface RecipeTimeFieldProps {
  /** The time the author set, or null while it's worked out from the steps. */
  manualMinutes: number | null;
  /** The estimate from the steps as they are now. */
  estimate: number;
  onChange: (minutes: number | null) => void;
  t: UiTranslations;
}

const STEP = 5;
const MAX_HOURS = 99;

/**
 * The recipe's total time: worked out from the steps (Auto), or set by hand in hours and
 * five-minute steps (Set).
 */
export const RecipeTimeField: React.FC<RecipeTimeFieldProps> = ({
  manualMinutes,
  estimate,
  onChange,
  t,
}) => {
  const labelId = useId();
  const isSet = manualMinutes !== null;
  const minutes = manualMinutes ?? estimate;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  // Never down to nothing: a recipe takes at least five minutes.
  const setTo = (next: number) => onChange(Math.max(STEP, Math.min(MAX_HOURS * 60 + 55, next)));

  return (
    <div className="time-field" role="group" aria-labelledby={labelId}>
      <div className="form-label time-field-label" id={labelId}>
        <Clock size="1.1em" aria-hidden="true" />
        {t.recipeTime}
      </div>
      <div className={`time-field-card${isSet ? ' is-set' : ''}`}>
        <div className="time-field-top">
          <div className="time-field-reading" aria-live="polite">
            <NumberRoll
              className="time-field-value"
              value={isSet ? t.totalTime(minutes) : t.estimatedTime(estimate)}
            />
            <span className="time-field-caption">
              {isSet ? (
                <PencilLine size="1em" aria-hidden="true" />
              ) : (
                <Sparkles size="1em" aria-hidden="true" />
              )}
              {isSet ? t.timeSetByYou : t.timeWorkedOut}
            </span>
          </div>
          <div className="choice-pill time-field-mode" data-value={isSet ? 'set' : 'auto'}>
            <span className="choice-pill-thumb" aria-hidden="true" />
            {(['auto', 'set'] as const).map((mode) => (
              <label key={mode} className={(mode === 'set') === isSet ? 'is-active' : ''}>
                <input
                  type="radio"
                  name={`${labelId}-mode`}
                  checked={(mode === 'set') === isSet}
                  onChange={() => onChange(mode === 'set' ? Math.max(STEP, estimate) : null)}
                />
                {mode === 'set' ? t.timeSet : t.timeAuto}
              </label>
            ))}
          </div>
        </div>
        <Reveal open={isSet}>
          <div className="time-field-keys">
            <div className="time-stepper">
              <button
                type="button"
                className="time-key"
                aria-label={t.hourLess}
                onClick={() => setTo(minutes - 60)}
              >
                <Minus size="1.1em" aria-hidden="true" />
              </button>
              <span className="time-stepper-value">
                <NumberRoll value={hours} />
                <span>{t.hoursShort}</span>
              </span>
              <button
                type="button"
                className="time-key"
                aria-label={t.hourMore}
                onClick={() => setTo(minutes + 60)}
              >
                <Plus size="1.1em" aria-hidden="true" />
              </button>
            </div>
            <div className="time-stepper">
              <button
                type="button"
                className="time-key"
                aria-label={t.minutesLess}
                onClick={() => setTo(minutes - STEP)}
              >
                <Minus size="1.1em" aria-hidden="true" />
              </button>
              <span className="time-stepper-value">
                <NumberRoll value={mins} />
                <span>{t.minutesShort}</span>
              </span>
              <button
                type="button"
                className="time-key"
                aria-label={t.minutesMore}
                onClick={() => setTo(minutes + STEP)}
              >
                <Plus size="1.1em" aria-hidden="true" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
};
