import React from 'react';

interface PortionScalerProps {
  scale: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

export const PortionScaler: React.FC<PortionScalerProps> = ({
  scale,
  onIncrease,
  onDecrease,
}) => {
  return (
    <div className="scaler-control" title="Scale ingredient quantities">
      <button
        className="scaler-btn"
        id="scaleDecBtn"
        aria-label="Decrease portion"
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
        aria-label="Increase portion"
        onClick={onIncrease}
      >
        +
      </button>
    </div>
  );
};
