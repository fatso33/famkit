import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpDown,
  ChefHat,
  Heart,
  History,
  ListFilter,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { MakesFilter, MakesSort, MakesSortKey } from '../../types/make';
import { UiTranslations } from '../../i18n/translations';
import { RECIPE_CATEGORIES } from '../../utils/vault';
import {
  MAKES_SORT_KEYS,
  isDefaultMakesSort,
  isMakesFiltered,
  type MakesFilterCounts,
} from '../../utils/makes';
import { RecipeBoxIcon, RecipeCardIcon } from '../common/RecipeBoxIcon';
import { CATEGORY_ICONS } from '../recipe-grid/vaultIcons';
import { VaultPopover } from '../recipe-grid/VaultPopover';
import { FilterSelect, type FilterOption } from '../recipe-grid/FilterSelect';
import { Monogram } from '../recipe-grid/Monogram';

const SORT_ICONS: Record<MakesSortKey, LucideIcon | typeof RecipeCardIcon> = {
  newest: History,
  hearts: Heart,
  recipe: RecipeCardIcon,
  maker: ChefHat,
};

interface MakesToolbarProps {
  filter: MakesFilter;
  /** What each choice in the filter menu would show, with the rest of the filter. */
  counts: MakesFilterCounts;
  /** How many makes the page shows right now. */
  shownCount: number;
  /** A new filter (animated by the page). */
  onFilterChange: (filter: MakesFilter) => void;
  sort: MakesSort;
  onSortChange: (sort: MakesSort) => void;
  t: UiTranslations;
}

type Menu = { kind: 'filter' | 'sort'; originFromRight: number };

/**
 * The row under the Makes banner, as the Recipe Box's: filter and sort at its right end, their
 * menus springing out of their buttons. Under it, while the filter narrows the page, a line with
 * what does and how many makes show.
 *
 * As in the Box, the sort menu lists what to sort by, each with the order it gives, and tapping
 * the chosen one again turns it round. Both menus stay open after a choice; a tap outside closes
 * them.
 */
export const MakesToolbar: React.FC<MakesToolbarProps> = ({
  filter,
  counts,
  shownCount,
  onFilterChange,
  sort,
  onSortChange,
  t,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const sortButton = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const narrowed = isMakesFiltered(filter);

  const openMenu = (kind: Menu['kind'], button: HTMLButtonElement | null) => {
    const row = rowRef.current?.getBoundingClientRect();
    const own = button?.getBoundingClientRect();
    const originFromRight = row && own ? row.right - (own.left + own.width / 2) : 24;
    setMenu({ kind, originFromRight });
  };

  const menuClosed = () => {
    const trigger = menu?.kind === 'sort' ? sortButton.current : filterButton.current;
    // Focus in the menu goes back to the button it came from; focus elsewhere stays put.
    const active = document.activeElement;
    if (!active || active === document.body || active.closest('.vault-popover-layer')) {
      trigger?.focus({ preventScroll: true });
    }
    setMenu(null);
  };

  const categoryLabel =
    filter.category === 'all' ? t.allCategories : t.recipeCategories[filter.category];
  const CategoryIcon = filter.category === 'all' ? RecipeBoxIcon : CATEGORY_ICONS[filter.category];
  const makerLabel = counts.makers.find((m) => m.key === filter.maker)?.name ?? filter.maker;
  const recipeLabel = counts.recipes.find((r) => r.id === filter.recipeId)?.name ?? t.recipeGone;

  return (
    <div className="vault-tools-block">
      <div ref={rowRef} className="vault-toolbar is-keys-only">
        <div className="vault-tools">
          <button
            ref={filterButton}
            type="button"
            className={`vault-key${narrowed ? ' has-dot' : ''}${menu?.kind === 'filter' ? ' is-open' : ''}`}
            aria-label={t.filterMakes}
            aria-haspopup="dialog"
            aria-expanded={menu?.kind === 'filter'}
            onClick={() => openMenu('filter', filterButton.current)}
          >
            <ListFilter size="1.3em" strokeWidth={2} aria-hidden="true" />
            <span className="vault-key-dot" aria-hidden="true" />
          </button>
          <button
            ref={sortButton}
            type="button"
            className={`vault-key${isDefaultMakesSort(sort) ? '' : ' has-dot'}${menu?.kind === 'sort' ? ' is-open' : ''}`}
            aria-label={t.sortMakes}
            aria-haspopup="dialog"
            aria-expanded={menu?.kind === 'sort'}
            onClick={() => openMenu('sort', sortButton.current)}
          >
            <ArrowUpDown size="1.3em" strokeWidth={2} aria-hidden="true" />
            <span className="vault-key-dot" aria-hidden="true" />
          </button>
        </div>

        {menu?.kind === 'filter' && (
          <VaultPopover
            label={t.filterMakes}
            originFromRight={menu.originFromRight}
            onClosed={menuClosed}
          >
            {() => (
              <MakesFilterMenu
                filter={filter}
                counts={counts}
                onFilterChange={onFilterChange}
                t={t}
              />
            )}
          </VaultPopover>
        )}

        {menu?.kind === 'sort' && (
          <VaultPopover
            label={t.sortMakes}
            originFromRight={menu.originFromRight}
            onClosed={menuClosed}
          >
            {() => (
              <>
                <p className="vault-popover-title vault-pop-in">{t.sortBy}</p>
                {MAKES_SORT_KEYS.map((key, i) => {
                  const Icon = SORT_ICONS[key];
                  const chosen = sort.by === key;
                  const reversed = chosen && sort.reversed;
                  const [natural, turned] = t.makesSortOrders[key];
                  const order = reversed ? turned : natural;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`vault-option vault-pop-in${reversed ? ' is-reversed' : ''}`}
                      style={{ '--i': i + 1 } as React.CSSProperties}
                      aria-pressed={chosen}
                      onClick={() =>
                        // A new sort starts in its natural order; the chosen one turns round.
                        onSortChange({ by: key, reversed: chosen && !sort.reversed })
                      }
                    >
                      <Icon className="vault-option-icon" size="1.25em" aria-hidden="true" />
                      <span className="vault-option-text">
                        <span className="vault-option-label">{t.makesSorts[key]}</span>
                        {/* Keyed, so a new order slides in rather than swapping in place. */}
                        <span key={order} className="vault-option-order">
                          {order}
                        </span>
                      </span>
                      <span className="vault-option-flip" aria-hidden="true">
                        <ArrowDown className="vault-option-arrow" size="1.1em" strokeWidth={2.2} />
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </VaultPopover>
        )}
      </div>

      {/* What narrows the page, and how many makes that leaves. */}
      <div className={`vault-summary${narrowed ? ' is-shown' : ''}`} inert={!narrowed}>
        <div className="vault-summary-inner">
          <div className="vault-summary-row">
            {filter.maker && (
              <button
                type="button"
                className="vault-chip"
                aria-label={t.removeFilter(makerLabel)}
                onClick={() => onFilterChange({ ...filter, maker: '' })}
              >
                <Monogram name={makerLabel} />
                <span>{makerLabel}</span>
                <X size="1em" strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
            {filter.category !== 'all' && (
              <button
                type="button"
                className="vault-chip"
                aria-label={t.removeFilter(categoryLabel)}
                onClick={() => onFilterChange({ ...filter, category: 'all' })}
              >
                <CategoryIcon size="1.05em" aria-hidden="true" />
                <span>{categoryLabel}</span>
                <X size="1em" strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
            {filter.recipeId && (
              <button
                type="button"
                className="vault-chip"
                aria-label={t.removeFilter(recipeLabel)}
                onClick={() => onFilterChange({ ...filter, recipeId: '' })}
              >
                <RecipeCardIcon size="1.05em" aria-hidden="true" />
                <span>{recipeLabel}</span>
                <X size="1em" strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
            {filter.hearted && (
              <button
                type="button"
                className="vault-chip"
                aria-label={t.removeFilter(t.heartedByMe)}
                onClick={() => onFilterChange({ ...filter, hearted: false })}
              >
                <Heart size="1.05em" aria-hidden="true" />
                <span>{t.heartedByMe}</span>
                <X size="1em" strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
            <span className="vault-summary-count">{t.makesShown(shownCount)}</span>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {narrowed ? t.makesShown(shownCount) : ''}
      </p>
    </div>
  );
};

type FilterPart = 'maker' | 'category' | 'recipe';

interface MakesFilterMenuProps {
  filter: MakesFilter;
  counts: MakesFilterCounts;
  onFilterChange: (filter: MakesFilter) => void;
  t: UiTranslations;
}

/**
 * The filter menu: who made it, the category of its recipe and the recipe itself, each a field
 * whose options unfold beneath it, and a switch for the makes this person has hearted.
 */
const MakesFilterMenu: React.FC<MakesFilterMenuProps> = ({ filter, counts, onFilterChange, t }) => {
  const [open, setOpen] = useState<FilterPart | null>(null);
  // One open at a time: opening one folds the others.
  const toggle = (part: FilterPart) => (isOpen: boolean) =>
    setOpen((current) => (isOpen ? part : current === part ? null : current));

  const makers: FilterOption[] = [
    {
      value: '',
      label: t.allMakers,
      count: counts.allMakers,
      icon: <UsersRound size="1.2em" />,
    },
    ...counts.makers.map((maker) => ({
      value: maker.key,
      label: maker.name,
      count: maker.count,
      icon: <Monogram name={maker.name} />,
    })),
  ];

  const categories: FilterOption[] = (['all', ...RECIPE_CATEGORIES] as const).map((category) => {
    const Icon = category === 'all' ? RecipeBoxIcon : CATEGORY_ICONS[category];
    return {
      value: category,
      label: category === 'all' ? t.allCategories : t.recipeCategories[category],
      count: counts.categories[category],
      icon: <Icon size="1.2em" />,
      wide: category === 'all',
    };
  });

  const recipes: FilterOption[] = [
    {
      value: '',
      label: t.allRecipes,
      count: counts.allRecipes,
      icon: <RecipeBoxIcon size="1.2em" />,
    },
    ...counts.recipes.map((recipe) => ({
      value: recipe.id,
      label: recipe.name,
      count: recipe.count,
      icon: <RecipeCardIcon size="1.2em" />,
    })),
  ];
  // Chosen, but with no makes left to show it by (the recipe gone from the box): still the
  // choice showing, rather than the field reading "All recipes" while the page stays narrowed.
  if (filter.recipeId && !counts.recipes.some((recipe) => recipe.id === filter.recipeId)) {
    recipes.push({
      value: filter.recipeId,
      label: t.recipeGone,
      count: 0,
      icon: <RecipeCardIcon size="1.2em" />,
    });
  }

  return (
    <>
      <FilterSelect
        label={t.filterMaker}
        options={makers}
        value={filter.maker}
        open={open === 'maker'}
        onOpenChange={toggle('maker')}
        onChange={(maker) => onFilterChange({ ...filter, maker })}
        style={{ '--i': 0 } as React.CSSProperties}
      />
      <FilterSelect
        label={t.categoryLabel}
        options={categories}
        value={filter.category}
        open={open === 'category'}
        onOpenChange={toggle('category')}
        onChange={(category) =>
          onFilterChange({ ...filter, category: category as MakesFilter['category'] })
        }
        columns={2}
        style={{ '--i': 1 } as React.CSSProperties}
      />
      <FilterSelect
        label={t.filterRecipe}
        options={recipes}
        value={filter.recipeId}
        open={open === 'recipe'}
        onOpenChange={toggle('recipe')}
        onChange={(recipeId) => onFilterChange({ ...filter, recipeId })}
        style={{ '--i': 2 } as React.CSSProperties}
      />
      <button
        type="button"
        role="switch"
        className="vault-switch-row vault-pop-in"
        style={{ '--i': 3 } as React.CSSProperties}
        aria-checked={filter.hearted}
        onClick={() => onFilterChange({ ...filter, hearted: !filter.hearted })}
      >
        <Heart className="vault-switch-icon" size="1.2em" aria-hidden="true" />
        <span className="vault-switch-text">
          <span className="vault-switch-label">{t.heartedByMe}</span>
          <span className="vault-switch-caption">{t.heartedCaption(counts.hearted)}</span>
        </span>
        <span className="vault-switch" aria-hidden="true" />
      </button>
    </>
  );
};
