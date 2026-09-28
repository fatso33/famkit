import React, { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowDown,
  BookOpen,
  Heart,
  LayoutGrid,
  List,
  ListFilter,
  ArrowUpDown,
  Search,
  X,
} from 'lucide-react';
import { RecipeCategory, VaultFilter, VaultSort, VaultView } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { RECIPE_CATEGORIES, VAULT_SORT_KEYS, isDefaultSort } from '../../utils/vault';
import { CATEGORY_ICONS, SORT_ICONS } from './vaultIcons';
import { VaultPopover } from './VaultPopover';

// A choice made in a menu shows for a moment before the menu closes: the filter's highlight,
// or the sort's arrow turning over and its new order.
const CLOSE_AFTER_CHOICE_MS = 240;
const CLOSE_AFTER_SORT_MS = 420;

interface VaultToolbarProps {
  filter: VaultFilter;
  /** How many recipes each category would show with the rest of the filter. */
  counts: Record<RecipeCategory | 'all', number>;
  /** How many recipes the vault shows right now. */
  shownCount: number;
  /** A new category or heirloom setting (animated by the vault). */
  onFilterChange: (filter: VaultFilter) => void;
  /** The search text as it's typed (applied at once, without animating). */
  onQueryChange: (query: string) => void;
  sort: VaultSort;
  onSortChange: (sort: VaultSort) => void;
  view: VaultView;
  onViewChange: (view: VaultView) => void;
  t: UiTranslations;
}

type Menu = { kind: 'filter' | 'sort'; originFromRight: number };

/**
 * The row under the vault's banner: the cards/list switch on the left; filter and sort, whose
 * menus spring out of their buttons; and search on the right, which grows leftward into a field
 * across the row. Under it, while anything narrows the vault, a line with what does and how
 * many recipes show.
 *
 * The sort menu lists what to sort by, each with the order it gives. Tapping the chosen one
 * again turns it round (newest first to oldest first, and so on), its arrow turning over.
 */
export const VaultToolbar: React.FC<VaultToolbarProps> = ({
  filter,
  counts,
  shownCount,
  onFilterChange,
  onQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  t,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const sortButton = useRef<HTMLButtonElement>(null);
  // Open while there's a search, so coming back from a recipe keeps it showing.
  const [searching, setSearching] = useState(() => filter.query !== '');
  const [menu, setMenu] = useState<Menu | null>(null);

  const narrowed = filter.category !== 'all' || filter.heirloomsOnly;
  const summaryShown = narrowed || filter.query.trim() !== '';

  const openSearch = () => {
    // Rendered open first, so the field can take focus inside the tap (phones only raise
    // the keyboard for focus given during the user's gesture).
    flushSync(() => setSearching(true));
    inputRef.current?.focus({ preventScroll: true });
  };

  const closeSearch = () => {
    setSearching(false);
    if (filter.query) onQueryChange('');
  };

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

  const chooseSoon = (close: () => void, change: () => void, delay = CLOSE_AFTER_CHOICE_MS) => {
    change();
    window.setTimeout(close, delay);
  };

  const categoryLabel =
    filter.category === 'all' ? t.allRecipes : t.recipeCategories[filter.category];
  const CategoryIcon = filter.category === 'all' ? BookOpen : CATEGORY_ICONS[filter.category];

  return (
    <div className="vault-tools-block">
      <div ref={rowRef} className={`vault-toolbar${searching ? ' is-searching' : ''}`}>
        <div className="vault-tools" inert={searching}>
          <div className="vault-layout" role="group" aria-label={t.recipeLayout} data-view={view}>
            <span className="vault-layout-thumb" aria-hidden="true" />
            <button
              type="button"
              aria-label={t.layoutCards}
              aria-pressed={view === 'cards'}
              onClick={() => view !== 'cards' && onViewChange('cards')}
            >
              <LayoutGrid size="1.2em" strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t.layoutList}
              aria-pressed={view === 'list'}
              onClick={() => view !== 'list' && onViewChange('list')}
            >
              <List size="1.25em" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <button
            ref={filterButton}
            type="button"
            className={`vault-key${narrowed ? ' has-dot' : ''}${menu?.kind === 'filter' ? ' is-open' : ''}`}
            aria-label={t.filterRecipes}
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
            className={`vault-key${isDefaultSort(sort) ? '' : ' has-dot'}${menu?.kind === 'sort' ? ' is-open' : ''}`}
            aria-label={t.sortRecipes}
            aria-haspopup="dialog"
            aria-expanded={menu?.kind === 'sort'}
            onClick={() => openMenu('sort', sortButton.current)}
          >
            <ArrowUpDown size="1.3em" strokeWidth={2} aria-hidden="true" />
            <span className="vault-key-dot" aria-hidden="true" />
          </button>
        </div>

        <div
          className="vault-search"
          onBlur={(e) => {
            // Tapping away from an empty search folds it back into its button.
            if (!filter.query && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setSearching(false);
            }
          }}
        >
          <button
            type="button"
            className="vault-key vault-search-key"
            aria-label={t.openSearch}
            aria-expanded={searching}
            aria-controls="vaultSearchInput"
            onClick={searching ? () => inputRef.current?.focus() : openSearch}
          >
            <Search size="1.3em" strokeWidth={2} aria-hidden="true" />
          </button>
          <input
            ref={inputRef}
            id="vaultSearchInput"
            className="vault-search-input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            aria-label={t.openSearch}
            placeholder={t.searchPlaceholder}
            value={filter.query}
            inert={!searching}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                closeSearch();
                e.currentTarget.blur();
              } else if (e.key === 'Enter') {
                // Put the keyboard away to show the results.
                e.currentTarget.blur();
              }
            }}
          />
          <button
            type="button"
            className="vault-search-close"
            aria-label={t.closeSearch}
            inert={!searching}
            onClick={closeSearch}
          >
            <X size="1.2em" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {menu?.kind === 'filter' && (
          <VaultPopover
            label={t.filterRecipes}
            originFromRight={menu.originFromRight}
            onClosed={menuClosed}
          >
            {(close) => (
              <>
                <p className="vault-popover-title vault-pop-in">{t.categoryLabel}</p>
                <div className="vault-choices">
                  {(['all', ...RECIPE_CATEGORIES] as const).map((category, i) => {
                    const Icon = category === 'all' ? BookOpen : CATEGORY_ICONS[category];
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`vault-choice vault-pop-in${category === 'all' ? ' is-wide' : ''}${counts[category] === 0 ? ' is-empty' : ''}`}
                        style={{ '--i': i } as React.CSSProperties}
                        aria-pressed={filter.category === category}
                        onClick={() =>
                          chooseSoon(close, () => {
                            if (filter.category !== category)
                              onFilterChange({ ...filter, category });
                          })
                        }
                      >
                        <Icon className="vault-choice-icon" size="1.2em" aria-hidden="true" />
                        <span className="vault-choice-label">
                          {category === 'all' ? t.allRecipes : t.recipeCategories[category]}
                        </span>
                        <span className="vault-choice-count">{counts[category]}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  role="switch"
                  className="vault-switch-row vault-pop-in"
                  style={{ '--i': RECIPE_CATEGORIES.length + 1 } as React.CSSProperties}
                  aria-checked={filter.heirloomsOnly}
                  onClick={() =>
                    onFilterChange({ ...filter, heirloomsOnly: !filter.heirloomsOnly })
                  }
                >
                  <Heart className="vault-switch-heart" size="1.2em" aria-hidden="true" />
                  <span>{t.heirloomsOnly}</span>
                  <span className="vault-switch" aria-hidden="true" />
                </button>
              </>
            )}
          </VaultPopover>
        )}

        {menu?.kind === 'sort' && (
          <VaultPopover
            label={t.sortRecipes}
            originFromRight={menu.originFromRight}
            onClosed={menuClosed}
          >
            {(close) => (
              <>
                <p className="vault-popover-title vault-pop-in">{t.sortBy}</p>
                {VAULT_SORT_KEYS.map((key, i) => {
                  const Icon = SORT_ICONS[key];
                  const chosen = sort.by === key;
                  const reversed = chosen && sort.reversed;
                  const [natural, turned] = t.vaultSortOrders[key];
                  const order = reversed ? turned : natural;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`vault-option vault-pop-in${reversed ? ' is-reversed' : ''}`}
                      style={{ '--i': i + 1 } as React.CSSProperties}
                      aria-pressed={chosen}
                      onClick={() =>
                        chooseSoon(
                          close,
                          // A new sort starts in its natural order; the chosen one turns round.
                          () => onSortChange({ by: key, reversed: chosen && !sort.reversed }),
                          CLOSE_AFTER_SORT_MS,
                        )
                      }
                    >
                      <Icon className="vault-option-icon" size="1.25em" aria-hidden="true" />
                      <span className="vault-option-text">
                        <span className="vault-option-label">{t.vaultSorts[key]}</span>
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

      {/* What narrows the vault, and how many recipes that leaves. */}
      <div className={`vault-summary${summaryShown ? ' is-shown' : ''}`} inert={!summaryShown}>
        <div className="vault-summary-inner">
          <div className="vault-summary-row">
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
            {filter.heirloomsOnly && (
              <button
                type="button"
                className="vault-chip"
                aria-label={t.removeFilter(t.heirloomsOnly)}
                onClick={() => onFilterChange({ ...filter, heirloomsOnly: false })}
              >
                <Heart size="1.05em" aria-hidden="true" />
                <span>{t.heirloomsOnly}</span>
                <X size="1em" strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
            <span className="vault-summary-count">{t.recipesShown(shownCount)}</span>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {summaryShown ? t.recipesShown(shownCount) : ''}
      </p>
    </div>
  );
};
