import { useState, useEffect } from 'react';
import { Theme } from '../types/recipe';
import { getStoredTheme, setStoredTheme } from '../services/storage';
import { syncThemeColor } from './useSeason';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    syncThemeColor();
    setStoredTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return { theme, toggleTheme };
}
