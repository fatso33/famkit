import React, { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { CookingPot, Plus } from 'lucide-react';
import { Language, Recipe } from '../../types/recipe';
import { Make } from '../../types/make';
import { UiTranslations } from '../../i18n/translations';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { awaitsMakeTranslation } from '../../hooks/useMakes';
import { hasHearted, shownMakes } from '../../utils/makes';
import { localizeMake } from '../../utils/makeTranslation';
import { transitionView } from '../../utils/viewTransition';
import { ImageZoomModal } from '../recipe-detail/ImageZoomModal';
import { MakeCard } from './MakeCard';

// Longer than the entrance's last animation (index.css, .makes-page[data-entrance]).
const ENTRANCE_MS = 1400;
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

  const shown = shownMakes(makes);
  const recipesById = new Map(recipes.map((r) => [r.id, r]));

  return (
    <section ref={pageRef} id="viewMakes" className={`makes-page${entering ? ' is-entering' : ''}`}>
      <div className="vault-hero makes-hero">
        <h1 className="font-serif">{t.makes}</h1>
      </div>

      {shown.length === 0 ? (
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
        <div className="makes-feed">
          {shown.map((raw, i) => {
            const make = localizeMake(raw, language);
            const recipe = recipesById.get(raw.recipeId);
            return (
              <MakeCard
                key={raw.id}
                make={make}
                recipeName={recipe ? (getLocalizedRecipe(recipe, language) ?? recipe).name : null}
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
