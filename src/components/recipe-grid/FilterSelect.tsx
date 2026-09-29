import React, { useEffect, useId, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  /** How many recipes choosing it would show. */
  count: number;
  icon: React.ReactNode;
  /** Takes a whole row where the options sit two to a row. */
  wide?: boolean;
}

interface FilterSelectProps {
  label: string;
  options: FilterOption[];
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  /** Two options to a row (short labels), or one (names). */
  columns?: 1 | 2;
  style?: React.CSSProperties;
}

/**
 * A choice in the filter menu: a field showing what's chosen, which unfolds its options in
 * place beneath it. Only one is open at a time (the menu decides). Picking an option leaves it
 * unfolded, the choice ticked; the field (or Escape) folds it back.
 */
export const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  options,
  value,
  open,
  onOpenChange,
  onChange,
  columns = 1,
  style,
}) => {
  const labelId = useId();
  const valueId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = options.find((option) => option.value === value) ?? options[0];
  const chosenIndex = Math.max(0, options.indexOf(chosen));

  // Focus moves in only when the list was opened from the keyboard (see openFromKeys).
  const focusOnOpen = useRef(false);
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    optionRefs.current[chosenIndex]?.focus({ preventScroll: true });
  }, [open, chosenIndex]);

  const openFromKeys = () => {
    if (open) {
      optionRefs.current[chosenIndex]?.focus({ preventScroll: true });
      return;
    }
    focusOnOpen.current = true;
    onOpenChange(true);
  };

  const close = () => {
    onOpenChange(false);
    trigger.current?.focus({ preventScroll: true });
  };

  /** Once unfolded, the menu scrolls just enough to show all of it. */
  const revealList = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (!open || e.target !== e.currentTarget || e.propertyName !== 'grid-template-rows') return;
    const root = rootRef.current;
    const scroller = root?.closest('.vault-popover');
    if (!root || !scroller) return;
    const hidden =
      root.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom + 12;
    if (hidden > 0) scroller.scrollBy({ top: hidden, behavior: 'smooth' });
  };

  const moveFocus = (from: number, by: number) => {
    const count = options.length;
    optionRefs.current[(from + by + count) % count]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`vault-select vault-pop-in${open ? ' is-open' : ''}`}
      style={style}
    >
      <span id={labelId} className="vault-popover-title">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className="vault-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openFromKeys();
          }
        }}
      >
        <span className="vault-select-icon" aria-hidden="true">
          {chosen.icon}
        </span>
        <span id={valueId} className="vault-select-value">
          {chosen.label}
        </span>
        <span className="vault-select-count" aria-hidden="true">
          {chosen.count}
        </span>
        <ChevronDown className="vault-select-chevron" size="1.2em" aria-hidden="true" />
      </button>

      {/* Always there, so it can unfold and fold; out of reach while folded. */}
      <div
        className="vault-select-drawer"
        inert={!open}
        aria-hidden={!open || undefined}
        onTransitionEnd={revealList}
      >
        <div className="vault-select-clip">
          <div
            id={listId}
            className={`vault-select-list${columns === 2 ? ' is-paired' : ''}`}
            role="listbox"
            aria-labelledby={labelId}
          >
            {options.map((option, i) => {
              const selected = option.value === chosen.value;
              return (
                <button
                  key={option.value}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`vault-select-option${option.wide ? ' is-wide' : ''}${option.count === 0 ? ' is-empty' : ''}`}
                  style={{ '--i': i } as React.CSSProperties}
                  // The list stays unfolded, so a mistaken tap can be put right at once.
                  onClick={() => {
                    if (!selected) onChange(option.value);
                  }}
                  onKeyDown={(e) => {
                    const moves: Record<string, number> =
                      columns === 2
                        ? { ArrowDown: 2, ArrowUp: -2, ArrowRight: 1, ArrowLeft: -1 }
                        : { ArrowDown: 1, ArrowUp: -1 };
                    if (e.key in moves) {
                      e.preventDefault();
                      moveFocus(i, moves[e.key]);
                    } else if (e.key === 'Home' || e.key === 'End') {
                      e.preventDefault();
                      optionRefs.current[e.key === 'Home' ? 0 : options.length - 1]?.focus();
                    } else if (e.key === 'Escape') {
                      // Folds the list only; the menu stays open (useDialogDismiss skips it).
                      e.preventDefault();
                      close();
                    }
                  }}
                >
                  <span className="vault-select-icon" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className="vault-select-option-label">{option.label}</span>
                  <span className="vault-select-count">{option.count}</span>
                  {selected && (
                    <Check className="vault-select-check" size="1.05em" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
