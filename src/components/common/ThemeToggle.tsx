import React from 'react';
import { Theme } from '../../types/recipe';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  title?: string;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme,
  onToggle,
  title = 'Toggle Light/Dark Theme',
  className = '',
}) => {
  return (
    <button
      onClick={onToggle}
      className={`btn btn-icon cursor-pointer ${className}`}
      title={title}
      aria-label={title}
    >
      <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
};
