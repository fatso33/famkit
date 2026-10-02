import React, { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { CookingPot, Plus } from 'lucide-react';
import { Language, Recipe } from '../../types/recipe';
import { Make, MakesFilter, MakesSort } from '../../types/make';
import { UiTranslations } from '../../i18n/translations';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { awaitsMakeTranslation } from '../../hooks/useMakes';
import {
  NO_MAKES_FILTER,
  filterMakes,
  hasHearted,
  makerKey,
  makesFilterCounts,
  shownMakes,
  sortMakes,
  type MakesEntry,
} from '../../utils/makes';
import { localizeMake } from '../../utils/makeTranslation';
import { categoryOf } from '../../utils/vault';
import { transitionView } from '../../utils/viewTransition';
import { ImageZoomModal } from '../recipe-detail/ImageZoomModal';
import { VaultHeader } from '../recipe-grid/VaultHeader';
import { MakeCard } from './MakeCard';
import { MakesToolbar } from './MakesToolbar';

// Longer than the entrance's last animation (index.css, .makes-page.is-entering).
const ENTRANCE_MS = 1800;
// Only the first few makes join the entrance; the rest are below the fold anyway.
const ENTRANCE_ITEMS = 3;

/** What App can ask of the Makes page. */
export interface MakesPageHandle {
  /** Closes the photo open full screen (the navigation island's back button does this). */
  closePhoto: () => void;
}

interface MakesViewProps {
  /** Every make, deleted ones included (they aren't shown). */
  makes: Make[];
  /** The Recipe Box's recipes, which makes link to. */
  recipes: Recipe[];
  language: Language;
  /** Whether this person may edit the make (its maker). */
  canEdit: (make: Make) => boolean;
  /** A make arriving: just shared ('new'), or come to from a recipe's makes ('visit'). */
  arriving: { id: string; kind: 'new' | 'visit' } | null;
  /** Plays the page's entrance: true arriving at it, false coming back to it. */
  animateIn: boolean;
  /** The filter and sort are kept by the app, so they survive a visit to a recipe. */
  filter: MakesFilter;
  onFilterChange: (filter: MakesFilter) => void;
  sort: MakesSort;
  onSortChange: (sort: MakesSort) => void;
  /** Takes you to a make's recipe, given its name on the make (it flies to the recipe's card). */
  onOpenRecipe: (recipeId: string, name: HTMLElement) => void;
  onEditMake: (make: Make, from: HTMLElement) => void;
  onHeart: (id: string, on: boolean) => void;
  onAddMake: (from: HTMLElement) => void;
  /** A photo opened full screen, or closed: the navigation island steps aside, leaving its back button. */
  onPhotoOpenChange: (open: boolean) => void;
  ref?: Ref<MakesPageHandle>;
  t: UiTranslations;
}

/** The Makes page: what the family made from the Recipe Box, the newest first. */
export const MakesView: React.FC<MakesViewProps> = ({
  makes,
  recipes,
  language,
  canEdit,
  arriving,
  animateIn,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  onOpenRecipe,
  onEditMake,
  onHeart,
  onAddMake,
  onPhotoOpenChange,
  ref,
  t,
}) => {
  const user = useCurrentUser();
  const pageRef = useRef<HTMLElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState(animateIn);
  useEffect(() => {
    if (!entering) return;
    // As the Recipe Box does: the entrance plays once the page's first frame is on screen, so its
    // start isn't spent while the page is still being built.
    let timer = 0;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        pageRef.current?.setAttribute('data-entrance', '');
        timer = window.setTimeout(() => setEntering(false), ENTRANCE_MS);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [entering]);

  // The photo shown full screen. Its make stays set after closing, so the photo has its card
  // to shrink back into.
  const [zoom, setZoom] = useState<{ src: string; id: string; open: boolean } | null>(null);
  const openZoom = (make: Make) => {
    if (!make.photo) return;
    // Marks the card's photo before the browser snapshots the page, so the photo grows from it.
    flushSync(() => setZoom({ src: make.photo, id: make.id, open: false }));
    transitionView(
      () => {
        setZoom({ src: make.photo, id: make.id, open: true });
        onPhotoOpenChange(true);
      },
      { motion: 'zoom', morph: 'photo' },
    );
  };
  const closeZoom = (animated = true) =>
    transitionView(
      () => {
        setZoom((z) => z && { ...z, open: false });
        onPhotoOpenChange(false);
      },
      { motion: 'zoom', morph: 'photo', animated },
    );
  useImperativeHandle(ref, () => ({ closePhoto: () => closeZoom() }));

  const all = shownMakes(makes);
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const entries: MakesEntry[] = all.map((make) => {
    const recipe = recipesById.get(make.recipeId);
    const recipeName = recipe ? (getLocalizedRecipe(recipe, language) ?? recipe).name : '';
    return {
      make,
      title: localizeMake(make, language).title || recipeName,
      recipeName,
      category: recipe ? categoryOf(recipe) : null,
    };
  });
  const email = user?.email;
  // What Hearted by me goes by: the makes hearted as of the filter's last change, so one whose
  // heart is taken back stays until the filter changes (as the Recipe Box's Unseen does).
  const [heartedForFilter, setHeartedForFilter] = useState(
    () => new Set(makes.filter((m) => hasHearted(m, email)).map((m) => m.id)),
  );
  const hearted = (make: Make) =>
    filter.hearted ? heartedForFilter.has(make.id) : hasHearted(make, email);
  const passing = new Set(filterMakes(entries, filter, hearted));
  // A make arriving (just shared, or come to from its recipe) shows whatever the filter: the page
  // was opened to show it.
  const shown = sortMakes(
    entries.filter((entry) => passing.has(entry) || entry.make.id === arriving?.id),
    sort,
    language,
  );
  const counts = makesFilterCounts(entries, filter, hearted, language);
  const cooks = new Set(all.map(makerKey)).size;

  /**
   * With the bar pinned, a changed page starts from its top, just under the bar (as the Recipe
   * Box's does).
   */
  const keepFeedInView = () => {
    const feed = feedRef.current;
    const bar = pageRef.current?.querySelector<HTMLElement>('.vault-bar');
    if (!feed || !bar) return;
    const style = getComputedStyle(bar);
    const underBar =
      (parseFloat(style.top) || 0) + bar.offsetHeight + (parseFloat(style.marginBottom) || 0);
    const top = feed.getBoundingClientRect().top + window.scrollY - underBar;
    // Only ever back up: an unpinned bar already has the makes below it.
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' });
  };
  // Makes glide to their new places (utils/viewTransition, motion 'vault').
  const changeMakes = (change: () => void) =>
    transitionView(
      () => {
        flushSync(change);
        keepFeedInView();
      },
      { motion: 'vault' },
    );
  const changeFilter = (next: MakesFilter) =>
    changeMakes(() => {
      setHeartedForFilter(new Set(makes.filter((m) => hasHearted(m, email)).map((m) => m.id)));
      onFilterChange(next);
    });
  // Only the hearted switch left nothing: the rest of the filter would show some.
  const noneHearted =
    filter.hearted && filterMakes(entries, { ...filter, hearted: false }, hearted).length > 0;

  return (
    <section
      ref={pageRef}
      id="viewMakes"
      className={`vault-page makes-page${entering ? ' is-entering' : ''}`}
    >
      <VaultHeader
        title={t.makes}
        caption={all.length > 0 ? t.makesCaption(all.length, cooks) : undefined}
        entering={entering}
      >
        {all.length > 0 && (
          <MakesToolbar
            filter={filter}
            counts={counts}
            shownCount={shown.length}
            onFilterChange={changeFilter}
            sort={sort}
            onSortChange={(next) => changeMakes(() => onSortChange(next))}
            t={t}
          />
        )}
      </VaultHeader>

      {all.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            <CookingPot size="1.75rem" strokeWidth={1.6} />
          </span>
          <h2 className="empty-state-title">{t.makesEmptyTitle}</h2>
          <p className="empty-state-body">{t.makesEmptyBody}</p>
          <button
            type="button"
            className="btn btn-primary empty-state-action"
            onClick={(e) => onAddMake(e.currentTarget)}
          >
            <Plus size="1.1em" aria-hidden="true" />
            {t.addMake}
          </button>
        </div>
      ) : (
        <div ref={feedRef} className="makes-feed">
          {shown.length === 0 && (
            <div className="vault-empty">
              <p>{noneHearted ? t.noneHearted : t.noMakesMatch}</p>
              <button
                type="button"
                className="vault-empty-reset"
                onClick={() => changeFilter(NO_MAKES_FILTER)}
              >
                {t.showAllMakes}
              </button>
            </div>
          )}
          {shown.map(({ make: raw, recipeName }, i) => {
            const make = localizeMake(raw, language);
            return (
              <MakeCard
                key={raw.id}
                make={make}
                recipeName={recipeName || null}
                language={language}
                hearted={hasHearted(raw, user?.email)}
                own={canEdit(raw)}
                // Only while the viewer is closed: the open viewer carries the photo's name.
                zoomSource={zoom?.id === raw.id && !zoom.open}
                translating={awaitsMakeTranslation(raw, language)}
                arrival={arriving?.id === raw.id ? arriving.kind : undefined}
                enterIndex={entering ? Math.min(i, ENTRANCE_ITEMS) : undefined}
                eager={i < 2 || arriving?.id === raw.id}
                onOpenRecipe={(name) => onOpenRecipe(raw.recipeId, name)}
                onZoom={() => openZoom(raw)}
                onHeart={(on) => onHeart(raw.id, on)}
                onEdit={(from) => onEditMake(raw, from)}
                t={t}
              />
            );
          })}
        </div>
      )}

      {zoom?.open && (
        <ImageZoomModal key={zoom.src} imageSrc={zoom.src} onClose={closeZoom} t={t} />
      )}
    </section>
  );
};
