import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Language, Recipe } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { recipePhoto } from '../../utils/vault';
import { creditName } from '../../utils/ownership';
import { CategoryTile } from '../recipe-grid/CategoryTile';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { RecipeCardIcon } from '../common/RecipeBoxIcon';
import { Photo } from '../common/Photo';

interface RecipeLinkSelectProps {
  /** The recipe picked, by id ('' for none yet). */
  value: string;
  recipes: Recipe[];
  language: Language;
  onChange: (recipeId: string) => void;
  /** Shown under the field, e.g. when a make is saved without one. */
  error?: string;
  t: UiTranslations;
}

/** Letters only, without accents or case, so "zurek" finds "Żurek". */
const folded = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();

/**
 * Which recipe a make was made from: a field that drops down the Recipe Box's recipes, A to Z,
 * each with its photo and cook, with a search at the top.
 */
export const RecipeLinkSelect: React.FC<RecipeLinkSelectProps> = ({
  value,
  recipes,
  language,
  onChange,
  error,
  t,
}) => {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const valueId = useId();
  const listId = useId();
  const errorId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const shown = (r: Recipe) => getLocalizedRecipe(r, language) ?? r;
  const picked = recipes.find((r) => r.id === value);

  return (
    <div className={`category-select recipe-link-select${open ? ' is-open' : ''}`}>
      <span className="form-label" id={labelId}>
        {t.makeRecipe}
      </span>
      <button
        ref={trigger}
        type="button"
        className={`form-control category-select-trigger${picked ? '' : ' is-empty'}`}
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
        <RecipeCardIcon className="category-select-icon recipe-link-icon" size="1.35em" />
        <span id={valueId} className="category-select-value">
          {picked ? shown(picked).name : t.chooseRecipe}
        </span>
        <ChevronDown className="category-select-chevron" size="1.2em" aria-hidden="true" />
      </button>
      {open && (
        <RecipeList
          id={listId}
          labelId={labelId}
          value={value}
          recipes={[...recipes]
            .map((r) => ({ recipe: r, text: shown(r) }))
            .sort((a, b) => a.text.name.localeCompare(b.text.name, language))}
          onPick={(id) => {
            onChange(id);
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

interface RecipeListProps {
  id: string;
  labelId: string;
  value: string;
  /** Each recipe, with its words in the viewer's language, in the order they're listed. */
  recipes: { recipe: Recipe; text: Recipe }[];
  onPick: (id: string) => void;
  onClosed: () => void;
  t: UiTranslations;
}

// Mounted only while open. A tap outside or Escape closes it; typing narrows it; arrow keys move
// through it.
const RecipeList: React.FC<RecipeListProps> = ({
  id,
  labelId,
  value,
  recipes,
  onPick,
  onClosed,
  t,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClosed);
  const backdropProps = useDialogDismiss(requestClose);
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  // The list as it opened, and the pick it opened on: focus starts on that pick (or the first
  // recipe), scrolled into view. Not on the search, which would open a phone's keyboard over the
  // list before anyone asked to type.
  const [opened] = useState(() => ({ recipes, value }));

  const words = folded(query.trim());
  const matches = words
    ? recipes.filter(({ text }) => folded(`${text.name} ${creditName(text)}`).includes(words))
    : recipes;

  useEffect(() => {
    const chosen = Math.max(
      0,
      opened.recipes.findIndex((r) => r.recipe.id === opened.value),
    );
    // The list drops below the field: the form scrolls it fully into view. Measured by its laid-out
    // height, as it's still growing in from a smaller scale.
    const panel = ref.current?.querySelector<HTMLElement>('.category-list');
    const scroller = panel?.closest<HTMLElement>('.editor-scroll');
    if (panel && scroller) {
      const below =
        panel.getBoundingClientRect().top + panel.offsetHeight + 16 - window.innerHeight;
      if (below > 0) {
        scroller.scrollBy({ top: below, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    }
    const option = options.current[chosen];
    // The pick it opened on, in the middle of the list (the list scrolls; the page doesn't).
    const list = option?.parentElement;
    if (option && list)
      list.scrollTop = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
    (option ?? search.current)?.focus({ preventScroll: true });
  }, [opened, ref]);

  const moveFocus = (from: number, by: number) => {
    const next = from + by;
    if (next < 0) search.current?.focus();
    else options.current[Math.min(next, matches.length - 1)]?.focus();
  };

  return (
    <div ref={ref} className={`category-list-layer${isClosing ? ' is-closing' : ''}`}>
      <div className="category-list-catcher" aria-hidden="true" {...backdropProps} />
      <div className="category-list recipe-link-list">
        <label className="recipe-link-search">
          <Search size="1.1em" aria-hidden="true" />
          <span className="sr-only">{t.searchRecipes}</span>
          <input
            ref={search}
            type="search"
            className="recipe-link-search-input"
            placeholder={t.searchRecipes}
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                options.current[0]?.focus();
              } else if (e.key === 'Enter' && matches.length === 1) {
                e.preventDefault();
                onPick(matches[0].recipe.id);
                requestClose();
              }
            }}
          />
        </label>
        <div className="recipe-link-options" role="listbox" id={id} aria-labelledby={labelId}>
          {matches.length === 0 && <p className="recipe-link-none">{t.noRecipesMatch}</p>}
          {matches.map(({ recipe, text }, i) => {
            const selected = recipe.id === value;
            return (
              <button
                key={recipe.id}
                ref={(el) => {
                  options.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                className="category-option recipe-link-option"
                style={{ '--i': Math.min(i, 8) } as React.CSSProperties}
                onClick={() => {
                  onPick(recipe.id);
                  requestClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    moveFocus(i, e.key === 'ArrowDown' ? 1 : -1);
                  } else if (e.key === 'Tab') {
                    requestClose();
                  }
                }}
              >
                <span className="recipe-link-thumb" aria-hidden="true">
                  <Photo
                    value={recipePhoto(text)}
                    alt=""
                    decoding="async"
                    loading="lazy"
                    fallback={<CategoryTile recipe={recipe} />}
                  />
                </span>
                <span className="recipe-link-text">
                  <span className="category-option-label">{text.name}</span>
                  <span className="recipe-link-cook">{creditName(text)}</span>
                </span>
                {selected && (
                  <Check className="category-option-check" size="1.1em" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
