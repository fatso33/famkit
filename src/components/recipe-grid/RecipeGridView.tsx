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
  sortEntries,
  vaultCounts,
  type VaultEntry,
  type VaultGroup,
} from '../../utils/vault';
import { RecipeCard } from './RecipeCard';
import { RecipeRow } from './RecipeRow';
import { VaultHeader } from './VaultHeader';
import { VaultShelf } from './VaultShelf';
import { VaultTabLabel, type VaultTab } from './VaultTabLabel';
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
  /** The recipe whose card flips open into it and back shut (the one last opened). */
  flipRecipeId: string | null;
  /** Opens a recipe, out of its card. */
  onSelectRecipe: (id: string, card: HTMLElement) => void;
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
  flipRecipeId,
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
  const groups = groupEntries(shown, sort.by, filter);

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

  // Each group's divider tab: its category or cook. Under the drafts, the recipes get one of
  // their own even when the sort gives them none.
  const tabFor = ({ key, category, cook, entries: group }: VaultGroup): VaultTab | null => {
    if (category || cook) {
      const label = [category && t.recipeCategories[category], cook].filter(Boolean).join(' · ');
      return { key: `group:${key}`, label, count: group.length, category, cook };
    }
    return shownDrafts.length > 0
      ? { key: 'family', label: t.familyRecipes, count: group.length, kind: 'family' }
      : null;
  };
  const card = (recipe: Recipe, text: Recipe, draft = false) => (
    <div key={recipe.id} className="vault-slot">
      {view === 'cards' ? (
        <RecipeCard
          recipe={recipe}
          language={language}
          isFlipTarget={!draft && recipe.id === flipRecipeId}
          enterIndex={enterIndex()}
          draft={draft}
          onSelect={draft ? openDraft : onSelectRecipe}
          t={t}
        />
      ) : (
        <RecipeRow
          recipe={recipe}
          shown={text}
          isFlipTarget={!draft && recipe.id === flipRecipeId}
          enterIndex={enterIndex()}
          draft={draft}
          onSelect={draft ? openDraft : onSelectRecipe}
          t={t}
        />
      )}
    </div>
  );
  const sections = [
    ...(shownDrafts.length > 0
      ? [
          {
            key: 'drafts',
            tab: {
              key: 'drafts',
              label: t.yourDrafts,
              count: shownDrafts.length,
              kind: 'drafts',
            } as VaultTab,
            cards: shownDrafts.map((draft) => {
              const recipe = draftRecipe(draft);
              return card(recipe, recipe, true);
            }),
          },
        ]
      : []),
    ...groups.map((group) => ({
      key: group.key || 'all',
      tab: tabFor(group),
      cards: group.entries.map(({ recipe, shown: text }) => card(recipe, text)),
    })),
  ];
  const tabs = sections.flatMap((section) => (section.tab ? [section.tab] : []));

  return (
    <section
      id="viewGrid"
      className={`recipe-grid-view vault-page${entering ? ' is-entering' : ''}`}
    >
      {banner}

      <VaultHeader
        counts={vaultCounts(recipes)}
        entering={entering}
        shelf={tabs.length > 0 && <VaultShelf tabs={tabs} list={listRef} />}
        t={t}
      >
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

      {/* The Recipe Box: its recipes as index cards, filed behind divider tabs. */}
      <div ref={listRef} className={`vault-box is-${view}`} id="recipesGrid">
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
        {sections.map(({ key, tab, cards }) => (
          <section key={key} className="vault-group">
            {tab && (
              <div className="vault-divider">
                <h2 className="vault-tab">
                  <VaultTabLabel tab={tab} />
                </h2>
                <div className="vault-tab-edge" aria-hidden="true" />
              </div>
            )}
            {cards}
          </section>
        ))}
      </div>
    </section>
  );
};
