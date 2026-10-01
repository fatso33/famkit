import React, { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowDown,
  LayoutGrid,
  List,
  ListFilter,
  ArrowUpDown,
  Search,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { VaultFilter, VaultSort, VaultView } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import {
  RECIPE_CATEGORIES,
  VAULT_SORT_KEYS,
  isDefaultSort,
  type FilterCounts,
} from '../../utils/vault';
import { RecipeBoxIcon } from '../common/RecipeBoxIcon';
import { CATEGORY_ICONS, SORT_ICONS } from './vaultIcons';
import { VaultPopover } from './VaultPopover';
import { FilterSelect, type FilterOption } from './FilterSelect';
import { Monogram } from './Monogram';

interface VaultToolbarProps {
  filter: VaultFilter;
  /** What each choice in the filter menu would show, with the rest of the filter. */
  counts: FilterCounts;
  /** How many recipes the vault shows right now. */
  shownCount: number;
  /** A new category, author or unseen setting (animated by the vault). */
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
 * The row under the vault's banner: the list/cards switch on the left; filter and sort, whose
 * menus spring out of their buttons; and search on the right, which grows leftward into a field
 * across the row. Under it, while anything narrows the vault, a line with what does and how
 * many recipes show.
 *
 * The sort menu lists what to sort by, each with the order it gives. Tapping the chosen one
 * again turns it round (newest first to oldest first, and so on), its arrow turning over. It
 * stays open after a choice, so a mistaken tap can be put right at once; a tap outside closes it.
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

  const narrowed = filter.category !== 'all' || filter.author !== '' || filter.unseen;
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

  const categoryLabel =
    filter.category === 'all' ? t.allRecipes : t.recipeCategories[filter.category];
  const CategoryIcon = filter.category === 'all' ? RecipeBoxIcon : CATEGORY_ICONS[filter.category];
  // An author no longer in the vault (their last recipe removed) still shows by name.
  const authorName =
    counts.authors.find((author) => author.key === filter.author)?.name ?? filter.author;

  return (
    <div className="vault-tools-block">
      <div ref={rowRef} className={`vault-toolbar${searching ? ' is-searching' : ''}`}>
        <div className="vault-tools" inert={searching}>
          {/* One switch: a tap anywhere on it moves the thumb to the other layout. */}
          <button
            type="button"
            className="vault-layout"
            data-view={view}
            aria-label={`${t.recipeLayout}: ${view === 'cards' ? t.layoutCards : t.layoutList}`}
            onClick={() => onViewChange(view === 'cards' ? 'list' : 'cards')}
          >
            <span className="vault-layout-thumb" aria-hidden="true" />
            <span className={`vault-layout-icon${view === 'list' ? ' is-active' : ''}`}>
              <List size="1.25em" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className={`vault-layout-icon${view === 'cards' ? ' is-active' : ''}`}>
              <LayoutGrid size="1.2em" strokeWidth={2} aria-hidden="true" />
            </span>
          </button>
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
            {() => (
              <FilterMenu filter={filter} counts={counts} onFilterChange={onFilterChange} t={t} />
            )}
          </VaultPopover>
        )}

        {menu?.kind === 'sort' && (
          <VaultPopover
            label={t.sortRecipes}
            originFromRight={menu.originFromRight}
            onClosed={menuClosed}
          >
            {() => (
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
                        // A new sort starts in its natural order; the chosen one turns round.
                        onSortChange({ by: key, reversed: chosen && !sort.reversed })
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
            {filter.author && (
              <button
                type="button"
                className="vault-chip"
                aria-label={t.removeFilter(authorName)}
                onClick={() => onFilterChange({ ...filter, author: '' })}
              >
                <Monogram name={authorName} />
                <span>{authorName}</span>
                <X size="1em" strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
            {filter.unseen && (
              <button
                type="button"
                className="vault-chip"
                aria-label={t.removeFilter(t.unseen)}
                onClick={() => onFilterChange({ ...filter, unseen: false })}
              >
                <Sparkles size="1.05em" aria-hidden="true" />
                <span>{t.unseen}</span>
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

type FilterPart = 'category' | 'author';

interface FilterMenuProps {
  filter: VaultFilter;
  counts: FilterCounts;
  onFilterChange: (filter: VaultFilter) => void;
  t: UiTranslations;
}

/**
 * The filter menu: category and author, each a field whose options unfold beneath it, and a
 * switch for the recipes this person hasn't opened yet. It stays open while they're changed,
 * the vault settling behind it, until a tap outside closes it.
 */
const FilterMenu: React.FC<FilterMenuProps> = ({ filter, counts, onFilterChange, t }) => {
  const [open, setOpen] = useState<FilterPart | null>(null);
  // One open at a time: opening one folds the other.
  const toggle = (part: FilterPart) => (isOpen: boolean) =>
    setOpen((current) => (isOpen ? part : current === part ? null : current));

  const categories: FilterOption[] = (['all', ...RECIPE_CATEGORIES] as const).map((category) => {
    const Icon = category === 'all' ? RecipeBoxIcon : CATEGORY_ICONS[category];
    return {
      value: category,
      label: category === 'all' ? t.allRecipes : t.recipeCategories[category],
      count: counts.categories[category],
      icon: <Icon size="1.2em" />,
      wide: category === 'all',
    };
  });

  const authors: FilterOption[] = [
    {
      value: '',
      label: t.allAuthors,
      count: counts.allAuthors,
      icon: <UsersRound size="1.2em" />,
    },
    ...counts.authors.map((author) => ({
      value: author.key,
      label: author.name,
      count: author.count,
      icon: <Monogram name={author.name} />,
    })),
  ];
  // Chosen, but with no recipes left in the vault (their last one removed): still the choice
  // showing, rather than the field reading "All authors" while the vault stays narrowed.
  if (filter.author && !counts.authors.some((author) => author.key === filter.author)) {
    authors.push({
      value: filter.author,
      label: filter.author,
      count: 0,
      icon: <Monogram name={filter.author} />,
    });
  }

  return (
    <>
      <FilterSelect
        label={t.categoryLabel}
        options={categories}
        value={filter.category}
        open={open === 'category'}
        onOpenChange={toggle('category')}
        onChange={(category) =>
          onFilterChange({ ...filter, category: category as VaultFilter['category'] })
        }
        columns={2}
        style={{ '--i': 0 } as React.CSSProperties}
      />
      <FilterSelect
        label={t.filterAuthor}
        options={authors}
        value={filter.author}
        open={open === 'author'}
        onOpenChange={toggle('author')}
        onChange={(author) => onFilterChange({ ...filter, author })}
        style={{ '--i': 1 } as React.CSSProperties}
      />
      <button
        type="button"
        role="switch"
        className="vault-switch-row vault-pop-in"
        style={{ '--i': 2 } as React.CSSProperties}
        aria-checked={filter.unseen}
        onClick={() => onFilterChange({ ...filter, unseen: !filter.unseen })}
      >
        <Sparkles className="vault-switch-icon" size="1.2em" aria-hidden="true" />
        <span className="vault-switch-text">
          <span className="vault-switch-label">{t.unseen}</span>
          <span className="vault-switch-caption">{t.unseenCaption(counts.unseen)}</span>
        </span>
        <span className="vault-switch" aria-hidden="true" />
      </button>
    </>
  );
};
