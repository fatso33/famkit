import React from 'react';
import { Theme } from '../../types/recipe';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  title?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme,
  onToggle,
  title = 'Toggle Light/Dark Theme',
}) => {
  return (
    <button
      onClick={onToggle}
      className="btn btn-icon cursor-pointer"
      title={title}
      aria-label={title}
    >
      <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
};
