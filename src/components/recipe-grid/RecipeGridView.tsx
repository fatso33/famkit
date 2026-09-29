import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Recipe,
  RecipeDraft,
  Language,
  VaultFilter,
  VaultSort,
  VaultView,
} from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { transitionView } from '../../utils/viewTransition';
import {
  NO_FILTER,
  filterCounts,
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
  /** Whether this person has opened the recipe (or added it), for the Unseen filter. */
  isSeen: (recipe: Recipe) => boolean;
  /** The recipe whose photo morphs to and from its card or row when opening or leaving it. */
  morphRecipeId: string | null;
  onSelectRecipe: (id: string) => void;
  /** This person's drafts of new recipes, first in the vault while nothing is filtered. */
  drafts?: RecipeDraft[];
  /** Opens the editor on a draft, out of its card or row. */
  onOpenDraft?: (draft: RecipeDraft, from: HTMLElement) => void;
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
  isSeen,
  morphRecipeId,
  onSelectRecipe,
  drafts = [],
  onOpenDraft,
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
    seen: isSeen(recipe),
  }));
  const shown = sortEntries(filterEntries(entries, filter), sort, language);
  const counts = filterCounts(entries, filter, language);
  const groups = groupEntries(shown, sort.by);

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

  // Drafts show while the whole vault does: a filter or search is looking for recipes.
  const filtering =
    filter.category !== NO_FILTER.category ||
    filter.author !== NO_FILTER.author ||
    filter.unseen ||
    filter.query.trim() !== '';
  const shownDrafts = filtering || !onOpenDraft ? [] : drafts;
  // A draft shows as the recipe it will be, named even before it has a title.
  const draftRecipe = (draft: RecipeDraft): Recipe => ({
    ...draft.recipe,
    id: draft.id,
    name: draft.recipe.name.trim() || t.untitledDraft,
  });
  const openDraft = (id: string, from: HTMLElement) => {
    const draft = drafts.find((d) => d.id === id);
    if (draft) onOpenDraft?.(draft, from);
  };

  let itemIndex = 0;
  const enterIndex = () => (entering ? Math.min(itemIndex++, ENTRANCE_ITEMS) : undefined);

  // Under the drafts, the recipes get a heading of their own when the sort gives them none.
  const groupHeading = (key: string) =>
    key ? (
      <h2 className="vault-group-heading">
        {sort.by === 'category' && isRecipeCategory(key) ? t.recipeCategories[key] : key}
      </h2>
    ) : (
      shownDrafts.length > 0 && <h2 className="vault-group-heading">{t.familyRecipes}</h2>
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
            counts={counts}
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
        {recipes.length === 0 && shownDrafts.length === 0 && (
          <p className="vault-empty">{t.emptyVault}</p>
        )}
        {recipes.length > 0 && shown.length === 0 && (
          <div className="vault-empty">
            {/* Only the unseen filter came up empty: everything else would show something. */}
            <p>
              {filter.unseen && filterEntries(entries, { ...filter, unseen: false }).length > 0
                ? t.allSeen
                : t.noMatches}
            </p>
            <button
              type="button"
              className="vault-empty-reset"
              onClick={() => changeVault(() => onFilterChange(NO_FILTER))}
            >
              {t.showAllRecipes}
            </button>
          </div>
        )}
        {shownDrafts.length > 0 &&
          (view === 'cards' ? (
            <>
              <h2 className="vault-group-heading">{t.yourDrafts}</h2>
              {shownDrafts.map((draft) => (
                <RecipeCard
                  key={draft.id}
                  recipe={draftRecipe(draft)}
                  language={language}
                  enterIndex={enterIndex()}
                  draft
                  onSelect={openDraft}
                  t={t}
                />
              ))}
            </>
          ) : (
            <section className="vault-list-group">
              <h2 className="vault-group-heading">{t.yourDrafts}</h2>
              <div className="vault-list-card">
                {shownDrafts.map((draft) => {
                  const recipe = draftRecipe(draft);
                  return (
                    <RecipeRow
                      key={draft.id}
                      recipe={recipe}
                      shown={recipe}
                      enterIndex={enterIndex()}
                      draft
                      onSelect={openDraft}
                      t={t}
                    />
                  );
                })}
              </div>
            </section>
          ))}
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
