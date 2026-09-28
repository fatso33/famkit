import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Recipe, Language, VaultFilter, VaultSort, VaultView } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { transitionView } from '../../utils/viewTransition';
import {
  NO_FILTER,
  categoryCounts,
  filterEntries,
  groupEntries,
  isRecipeCategory,
  sortEntries,
  vaultCounts,
  type VaultEntry,
} from '../../utils/vault';
import { RecipeCard } from './RecipeCard';
import { RecipeRow } from './RecipeRow';
import { VaultHeader } from './VaultHeader';
import { VaultToolbar } from './VaultToolbar';

// Longer than the entrance's last animation (index.css, .vault-page.is-entering).
const ENTRANCE_MS = 1800;
// Only the first few recipes join the entrance; the rest are below the fold anyway.
const ENTRANCE_ITEMS = 6;

interface RecipeGridViewProps {
  recipes: Recipe[];
  language: Language;
  /** The filter, sort and layout are kept by the app, so they survive a visit to a recipe. */
  filter: VaultFilter;
  onFilterChange: (filter: VaultFilter) => void;
  sort: VaultSort;
  onSortChange: (sort: VaultSort) => void;
  view: VaultView;
  onViewChange: (view: VaultView) => void;
  /** The recipe whose photo morphs to and from its card or row when opening or leaving it. */
  morphRecipeId: string | null;
  onSelectRecipe: (id: string) => void;
  /** Plays the banner's entrance: true arriving at the vault, false coming back to it. */
  animateIn: boolean;
  /** Shown above the vault title, e.g. the install prompt. */
  banner?: React.ReactNode;
  t: UiTranslations;
}

export const RecipeGridView: React.FC<RecipeGridViewProps> = ({
  recipes,
  language,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  morphRecipeId,
  onSelectRecipe,
  animateIn,
  banner,
  t,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState(animateIn);
  useEffect(() => {
    if (!entering) return;
    // Recipes that appear later (a filter changing) don't play the entrance.
    const timer = window.setTimeout(() => setEntering(false), ENTRANCE_MS);
    return () => window.clearTimeout(timer);
  }, [entering]);

  const entries: VaultEntry[] = recipes.map((recipe) => ({
    recipe,
    shown: getLocalizedRecipe(recipe, language) ?? recipe,
  }));
  const shown = sortEntries(filterEntries(entries, filter), sort, language);
  const groups = groupEntries(shown, sort);

  /**
   * With the bar pinned, a changed vault starts from its top, just under the bar. The pinned bar
   * sits its title's height below the top of the screen, with its usual gap to the list. (Its
   * summary line unfolding moves the list down with it, so the bar's height now is enough.)
   */
  const keepListInView = () => {
    const list = listRef.current;
    const bar = list?.parentElement?.querySelector<HTMLElement>('.vault-bar');
    if (!list || !bar) return;
    const style = getComputedStyle(bar);
    const underBar =
      (parseFloat(style.top) || 0) + bar.offsetHeight + (parseFloat(style.marginBottom) || 0);
    const top = list.getBoundingClientRect().top + window.scrollY - underBar;
    // Only ever back up: an unpinned bar already has the list below it.
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' });
  };

  // Recipes glide to their new places (utils/viewTransition, motion 'vault'), changing shape
  // when the layout switches.
  const changeVault = (change: () => void, relayout = false) =>
    transitionView(
      () => {
        flushSync(change);
        keepListInView();
      },
      { motion: 'vault', relayout },
    );

  const typeQuery = (query: string) => {
    flushSync(() => onFilterChange({ ...filter, query }));
    keepListInView();
  };

  let itemIndex = 0;
  const enterIndex = () => (entering ? Math.min(itemIndex++, ENTRANCE_ITEMS) : undefined);

  const groupHeading = (key: string) =>
    key && (
      <h2 className="vault-group-heading">
        {sort === 'category' && isRecipeCategory(key) ? t.recipeCategories[key] : key}
      </h2>
    );

  return (
    <section
      id="viewGrid"
      className={`recipe-grid-view vault-page${entering ? ' is-entering' : ''}`}
    >
      {banner}

      <VaultHeader counts={vaultCounts(recipes)} entering={entering} t={t}>
        {recipes.length > 0 && (
          <VaultToolbar
            filter={filter}
            counts={categoryCounts(entries, filter)}
            shownCount={shown.length}
            onFilterChange={(next) => changeVault(() => onFilterChange(next))}
            onQueryChange={typeQuery}
            sort={sort}
            onSortChange={(next) => changeVault(() => onSortChange(next))}
            view={view}
            onViewChange={(next) => changeVault(() => onViewChange(next), true)}
            t={t}
          />
        )}
      </VaultHeader>

      <div
        ref={listRef}
        className={view === 'list' ? 'vault-list' : 'recipe-grid'}
        id="recipesGrid"
      >
        {recipes.length === 0 && <p className="vault-empty">{t.emptyVault}</p>}
        {recipes.length > 0 && shown.length === 0 && (
          <div className="vault-empty">
            <p>{t.noMatches}</p>
            <button
              type="button"
              className="vault-empty-reset"
              onClick={() => changeVault(() => onFilterChange(NO_FILTER))}
            >
              {t.showAllRecipes}
            </button>
          </div>
        )}
        {view === 'cards'
          ? groups.map(({ key, entries: group }) => (
              <React.Fragment key={key || 'all'}>
                {groupHeading(key)}
                {group.map(({ recipe }) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    language={language}
                    isMorphTarget={recipe.id === morphRecipeId}
                    enterIndex={enterIndex()}
                    onSelect={onSelectRecipe}
                    t={t}
                  />
                ))}
              </React.Fragment>
            ))
          : groups.map(({ key, entries: group }) => (
              <section key={key || 'all'} className="vault-list-group">
                {groupHeading(key)}
                <div className="vault-list-card">
                  {group.map(({ recipe, shown: text }) => (
                    <RecipeRow
                      key={recipe.id}
                      recipe={recipe}
                      shown={text}
                      isMorphTarget={recipe.id === morphRecipeId}
                      enterIndex={enterIndex()}
                      onSelect={onSelectRecipe}
                      t={t}
                    />
                  ))}
                </div>
              </section>
            ))}
      </div>
    </section>
  );
};
