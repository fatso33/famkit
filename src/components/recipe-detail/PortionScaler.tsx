import React from 'react';
import { UiTranslations } from '../../i18n/translations';

interface PortionScalerProps {
  scale: number;
  onIncrease: () => void;
  onDecrease: () => void;
  t: UiTranslations;
}

export const PortionScaler: React.FC<PortionScalerProps> = ({
  scale,
  onIncrease,
  onDecrease,
  t,
}) => {
  return (
    <div className="scaler-control" title={t.scaleIngredients}>
      <button
        className="scaler-btn"
        id="scaleDecBtn"
        aria-label={t.decreasePortion}
        onClick={onDecrease}
      >
        −
      </button>
      <span className="scaler-display" id="scaleDisplay">
        {scale}x
      </span>
      <button
        className="scaler-btn"
        id="scaleIncBtn"
        aria-label={t.increasePortion}
        onClick={onIncrease}
      >
        +
      </button>
    </div>
  );
};
