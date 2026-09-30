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
import { shelfEndTimeline, shelfFollowsScroll, shelfTimeline } from '../../utils/vaultShelf';
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
import { remixCounts, remixOriginalId } from '../../utils/recipeRemix';
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
  // Each divider tab drives its twin in the pinned shelf by the scroll alone, where it can.
  const [tabTimelines] = useState(shelfFollowsScroll);
  const pageRef = useRef<HTMLElement>(null);
  const [entering, setEntering] = useState(animateIn);
  useEffect(() => {
    if (!entering) return;
    // The entrance plays once the vault's first frame is on screen (index.css): building the
    // vault takes a moment, and animations begun in that frame would be well under way, their
    // start skipped, before anything showed.
    let timer = 0;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        pageRef.current?.setAttribute('data-entrance', '');
        // Recipes that appear later (a filter changing) don't play the entrance.
        timer = window.setTimeout(() => setEntering(false), ENTRANCE_MS);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [entering]);

  const entries: VaultEntry[] = recipes.map((recipe) => ({
    recipe,
    shown: getLocalizedRecipe(recipe, language) ?? recipe,
    seen: isSeen(recipe),
  }));
  const shown = sortEntries(filterEntries(entries, filter), sort, language);
  const counts = filterCounts(entries, filter, language);
  const groups = groupEntries(shown, sort.by, filter);
  // How many remixes each recipe has, for the badge on its card.
  const remixes = remixCounts(recipes);

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
  // A group's divider tab arrives with the group's first card.
  const nextEnterIndex = () => (entering ? Math.min(itemIndex, ENTRANCE_ITEMS) : undefined);

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
  // A section's last card carries its pinned tab away (endTimeline, index.css).
  const card = (recipe: Recipe, text: Recipe, draft: boolean, endTimeline?: string) => (
    <div
      key={recipe.id}
      className="vault-slot"
      style={endTimeline ? ({ '--end-timeline': endTimeline } as React.CSSProperties) : undefined}
    >
      {view === 'cards' ? (
        <RecipeCard
          recipe={recipe}
          language={language}
          isFlipTarget={!draft && recipe.id === flipRecipeId}
          enterIndex={enterIndex()}
          draft={draft}
          remixed={remixOriginalId(recipe) !== null}
          remixCount={draft ? 0 : (remixes.get(recipe.id) ?? 0)}
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
          remixed={remixOriginalId(recipe) !== null}
          remixCount={draft ? 0 : (remixes.get(recipe.id) ?? 0)}
          onSelect={draft ? openDraft : onSelectRecipe}
          t={t}
        />
      )}
    </div>
  );
  // A section: its divider tab (the index-th of the tabs down the list, if it has one), when it
  // joins the entrance, and its cards.
  let tabCount = 0;
  const section = (
    key: string,
    tab: VaultTab | null,
    items: { recipe: Recipe; text: Recipe; draft: boolean }[],
  ) => {
    const index = tab ? tabCount++ : -1;
    const enterAt = nextEnterIndex();
    const last = items.length - 1;
    const cards = items.map(({ recipe, text, draft }, i) =>
      card(
        recipe,
        text,
        draft,
        tabTimelines && index >= 0 && i === last ? shelfEndTimeline(index) : undefined,
      ),
    );
    return { key, tab, index, enterAt, cards };
  };
  const sections = [
    ...(shownDrafts.length > 0
      ? [
          section(
            'drafts',
            { key: 'drafts', label: t.yourDrafts, count: shownDrafts.length, kind: 'drafts' },
            shownDrafts.map((draft) => {
              const recipe = draftRecipe(draft);
              return { recipe, text: recipe, draft: true };
            }),
          ),
        ]
      : []),
    ...groups.map((group) =>
      section(
        group.key || 'all',
        tabFor(group),
        group.entries.map(({ recipe, shown: text }) => ({ recipe, text, draft: false })),
      ),
    ),
  ];
  const tabs = sections.flatMap((section) => (section.tab ? [section.tab] : []));
  // The shelf's tabs live in the bar, so the page lets them see the list's timelines.
  const timelineScope =
    tabTimelines && tabs.length > 0
      ? ({
          '--vault-timelines': tabs
            .flatMap((_, i) => [shelfTimeline(i), shelfEndTimeline(i)])
            .join(', '),
        } as React.CSSProperties)
      : undefined;

  return (
    <section
      ref={pageRef}
      id="viewGrid"
      className={`recipe-grid-view vault-page${entering ? ' is-entering' : ''}`}
      style={timelineScope}
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
        {sections.map(({ key, tab, index, cards, enterAt }) => (
          <section key={key} className="vault-group">
            {tab && (
              <div
                className="vault-divider"
                // Joins the entrance with its first card, so the tabs never arrive alone.
                style={
                  enterAt === undefined
                    ? undefined
                    : ({ '--enter-i': enterAt } as React.CSSProperties)
                }
              >
                <h2
                  className="vault-tab"
                  style={
                    tabTimelines
                      ? ({ '--tab-timeline': shelfTimeline(index) } as React.CSSProperties)
                      : undefined
                  }
                >
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
