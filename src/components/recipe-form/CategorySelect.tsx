import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Shapes } from 'lucide-react';
import { RecipeCategory } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { CATEGORY_ICONS } from '../recipe-grid/vaultIcons';
import { RECIPE_CATEGORIES } from '../../utils/vault';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';

interface CategorySelectProps {
  value: RecipeCategory | '';
  onChange: (category: RecipeCategory) => void;
  /** Shown under the field, e.g. when a new recipe is saved without one. */
  error?: string;
  t: UiTranslations;
}

/** The category, picked from a list that drops down from the field, each with its icon. */
export const CategorySelect: React.FC<CategorySelectProps> = ({ value, onChange, error, t }) => {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const valueId = useId();
  const listId = useId();
  const errorId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const Icon = value ? CATEGORY_ICONS[value] : Shapes;

  return (
    <div className={`category-select${open ? ' is-open' : ''}`}>
      <span className="form-label" id={labelId}>
        {t.categoryLabel}
      </span>
      <button
        ref={trigger}
        type="button"
        className={`form-control category-select-trigger${value ? '' : ' is-empty'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-describedby={error ? errorId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon className="category-select-icon" size="1.25em" aria-hidden="true" />
        <span id={valueId} className="category-select-value">
          {value ? t.recipeCategories[value] : t.chooseCategory}
        </span>
        <ChevronDown className="category-select-chevron" size="1.2em" aria-hidden="true" />
      </button>
      {open && (
        <CategoryList
          id={listId}
          labelId={labelId}
          value={value}
          onPick={(category) => {
            onChange(category);
            trigger.current?.focus({ preventScroll: true });
          }}
          onClosed={() => setOpen(false)}
          t={t}
        />
      )}
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

interface CategoryListProps {
  id: string;
  labelId: string;
  value: RecipeCategory | '';
  onPick: (category: RecipeCategory) => void;
  onClosed: () => void;
  t: UiTranslations;
}

// Mounted only while open. A tap outside or Escape closes it; arrow keys move through it.
const CategoryList: React.FC<CategoryListProps> = ({ id, labelId, value, onPick, onClosed, t }) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClosed);
  const backdropProps = useDialogDismiss(requestClose);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  // The pick it opened on. Only then does focus move in: after a new pick the list is closing,
  // and focus belongs back on the field.
  const [openedOn] = useState(value);

  useEffect(() => {
    const chosen = Math.max(0, RECIPE_CATEGORIES.indexOf(openedOn as RecipeCategory));
    options.current[chosen]?.focus({ preventScroll: true });
  }, [openedOn]);

  const moveFocus = (from: number, by: number) => {
    const count = RECIPE_CATEGORIES.length;
    options.current[(from + by + count) % count]?.focus();
  };

  return (
    <div ref={ref} className={`category-list-layer${isClosing ? ' is-closing' : ''}`}>
      <div className="category-list-catcher" aria-hidden="true" {...backdropProps} />
      <div className="category-list" role="listbox" id={id} aria-labelledby={labelId}>
        {RECIPE_CATEGORIES.map((category, i) => {
          const Icon = CATEGORY_ICONS[category];
          const selected = category === value;
          return (
            <button
              key={category}
              ref={(el) => {
                options.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={selected}
              className="category-option"
              style={{ '--i': i } as React.CSSProperties}
              onClick={() => {
                onPick(category);
                requestClose();
              }}
              onKeyDown={(e) => {
                const moves: Record<string, number> = {
                  ArrowDown: 2,
                  ArrowUp: -2,
                  ArrowRight: 1,
                  ArrowLeft: -1,
                };
                if (e.key in moves) {
                  e.preventDefault();
                  moveFocus(i, moves[e.key]);
                } else if (e.key === 'Tab') {
                  requestClose();
                }
              }}
            >
              <Icon className="category-option-icon" size="1.2em" aria-hidden="true" />
              <span className="category-option-label">{t.recipeCategories[category]}</span>
              {selected && (
                <Check className="category-option-check" size="1.1em" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
