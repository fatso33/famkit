import { useState, useEffect } from 'react';
import { getStoredFontScale, setStoredFontScale } from '../services/storage';

export function useFontScale() {
  const [scale, setScaleState] = useState<number>(getStoredFontScale);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', scale.toString());
    setStoredFontScale(scale);
  }, [scale]);

  const increaseScale = () => {
    setScaleState((prev) => Math.min(1.4, Number((prev + 0.05).toFixed(2))));
  };

  const decreaseScale = () => {
    setScaleState((prev) => Math.max(0.85, Number((prev - 0.05).toFixed(2))));
  };

  const percent = Math.round(scale * 100);

  return { scale, percent, increaseScale, decreaseScale };
}
