import React, { useRef } from 'react';
import { Language, Recipe, VaultFilter, VaultSort } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import {
  NO_FILTER,
  filterCounts,
  filterEntries,
  groupEntries,
  sortEntries,
  type VaultEntry,
} from '../../utils/vault';
import { remixCounts, remixOriginalId } from '../../utils/recipeRemix';
import { RecipeRow } from './RecipeRow';
import { VaultDivider } from './VaultDivider';
import { VaultEmpty } from './VaultEmpty';
import { VaultToolbar } from './VaultToolbar';

// Only the first cards are dealt in one by one; the rest are below the deck's fold anyway.
const DEALT = 10;

interface RecipeDeckProps {
  recipes: Recipe[];
  language: Language;
  /** The Recipe Box's own filter and sort: the deck is the same box, held in the hand. */
  filter: VaultFilter;
  onFilterChange: (filter: VaultFilter) => void;
  sort: VaultSort;
  onSortChange: (sort: VaultSort) => void;
  isSeen: (recipe: Recipe) => boolean;
  makeCounts?: ReadonlyMap<string, number>;
  /** The card that flips open into its recipe (the one last opened). */
  flipRecipeId: string | null;
  onSelectRecipe: (id: string, card: HTMLElement) => void;
  t: UiTranslations;
}

/**
 * The Recipe Box as a card deck (NavDeck): its recipes as the box's compact list cards behind
 * their divider tabs, with the box's filter, sort and search. A card picked lifts and flips open
 * into its recipe, as in the box.
 */
export const RecipeDeck: React.FC<RecipeDeckProps> = ({
  recipes,
  language,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  isSeen,
  makeCounts,
  flipRecipeId,
  onSelectRecipe,
  t,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const entries: VaultEntry[] = recipes.map((recipe) => ({
    recipe,
    shown: getLocalizedRecipe(recipe, language) ?? recipe,
    seen: isSeen(recipe),
  }));
  const shown = sortEntries(filterEntries(entries, filter), sort, language);
  const groups = groupEntries(shown, sort.by, filter);
  const remixes = remixCounts(recipes);

  // A new filter or order deals the deck again from its top. The search narrows it as it's typed,
  // without dealing.
  const redeal = (change: () => void) => {
    change();
    listRef.current?.scrollTo({ top: 0 });
  };
  const dealKey = [filter.category, filter.author, filter.unseen, sort.by, sort.reversed].join();

  let dealt = 0;
  // The first few cards and tabs, by their place in the deal (index.css, nav-deck-deal).
  const deal = (): { className?: string; style?: React.CSSProperties } => {
    const i = dealt++;
    return i < DEALT
      ? {
          className: 'nav-deck-deal',
          style: { '--deal': i, '--tilt': i % 2 ? '2.5deg' : '-2.5deg' } as React.CSSProperties,
        }
      : {};
  };
  const dealSlot = () => {
    const { className, style } = deal();
    return { className: className ? `vault-slot ${className}` : 'vault-slot', style };
  };

  return (
    <>
      {recipes.length > 0 && (
        <div className="nav-deck-tools">
          <VaultToolbar
            filter={filter}
            counts={filterCounts(entries, filter, language)}
            shownCount={shown.length}
            onFilterChange={(next) => redeal(() => onFilterChange(next))}
            onQueryChange={(query) => onFilterChange({ ...filter, query })}
            sort={sort}
            onSortChange={(next) => redeal(() => onSortChange(next))}
            view="list"
            onViewChange={() => {}}
            layoutSwitch={false}
            t={t}
          />
        </div>
      )}
      <div ref={listRef} className="nav-deck-list">
        <div key={dealKey} className="vault-box is-list">
          <VaultEmpty
            boxEmpty={recipes.length === 0}
            entries={entries}
            filter={filter}
            shownCount={shown.length}
            onShowAll={() => redeal(() => onFilterChange(NO_FILTER))}
            t={t}
          />
          {groups.map(({ key, category, cook, entries: group }) => {
            const label = [category && t.recipeCategories[category], cook]
              .filter(Boolean)
              .join(' · ');
            return (
              <section key={key || 'all'} className="vault-group">
                {label && (
                  <VaultDivider
                    tab={{ key, label, count: group.length, category, cook }}
                    heading="h3"
                    {...deal()}
                  />
                )}
                {group.map(({ recipe, shown: text }) => (
                  <div key={recipe.id} {...dealSlot()}>
                    <RecipeRow
                      recipe={recipe}
                      shown={text}
                      isFlipTarget={recipe.id === flipRecipeId}
                      remixed={remixOriginalId(recipe) !== null}
                      remixCount={remixes.get(recipe.id) ?? 0}
                      makeCount={makeCounts?.get(recipe.id) ?? 0}
                      onSelect={onSelectRecipe}
                      t={t}
                    />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
};
