import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { formatFraction } from '../../utils/fractions';
import { NumberRoll } from '../common/NumberRoll';

interface PortionScalerProps {
  scale: number;
  onIncrease: () => void;
  onDecrease: () => void;
  t: UiTranslations;
}

/** How many times the recipe is made: the text size stepper's pill, − and + as raised keys. */
export const PortionScaler: React.FC<PortionScalerProps> = ({
  scale,
  onIncrease,
  onDecrease,
  t,
}) => {
  return (
    <div className="scaler-control" role="group" aria-label={t.scaleIngredients}>
      <button
        type="button"
        className="scaler-btn"
        id="scaleDecBtn"
        aria-label={t.decreasePortion}
        onClick={onDecrease}
      >
        <Minus size="1.15rem" strokeWidth={2.4} aria-hidden="true" />
      </button>
      <span className="scaler-display" id="scaleDisplay" aria-live="polite">
        <NumberRoll value={`${formatFraction(scale)}×`} rank={scale} />
      </span>
      <button
        type="button"
        className="scaler-btn"
        id="scaleIncBtn"
        aria-label={t.increasePortion}
        onClick={onIncrease}
      >
        <Plus size="1.15rem" strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
};
