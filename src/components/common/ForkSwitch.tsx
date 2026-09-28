import React, { useRef } from 'react';
import { ForkIcon } from './ForkIcon';

interface ForkSwitchProps {
  /** Each path's name on the switch. */
  labels: string[];
  active: number;
  onChange: (index: number) => void;
  /** What the choice is, for screen readers. */
  label: string;
  className?: string;
}

/**
 * The two- or three-way switch for a fork, on the recipe page and in the editor. Each path shows
 * the split arrow with its own branch lit; choosing one slides the thumb over and draws its branch
 * out (index.css). A radio group: arrow keys move between the paths.
 */
export const ForkSwitch: React.FC<ForkSwitchProps> = ({
  labels,
  active,
  onChange,
  label,
  className = '',
}) => {
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const choose = (index: number) => {
    const next = (index + labels.length) % labels.length;
    onChange(next);
    options.current[next]?.focus();
  };

  return (
    <div
      className={`fork-switch ${className}`.trim()}
      role="radiogroup"
      aria-label={label}
      style={{ '--paths': labels.length } as React.CSSProperties}
    >
      <span
        className="fork-switch-thumb"
        aria-hidden="true"
        style={{ transform: `translateX(${active * 100}%)` }}
      />
      {labels.map((text, i) => (
        <button
          key={i}
          ref={(el) => {
            options.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === active}
          tabIndex={i === active ? 0 : -1}
          className={`fork-switch-option${i === active ? ' is-on' : ''}`}
          onClick={() => onChange(i)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              choose(i + 1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              choose(i - 1);
            }
          }}
        >
          <ForkIcon paths={labels.length} lit={i} />
          <span className="fork-switch-label">{text}</span>
        </button>
      ))}
    </div>
  );
};
