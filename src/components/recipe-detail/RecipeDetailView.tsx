import React, { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ChevronRight, CookingPot, FilePen, Languages, Shuffle, Timer } from 'lucide-react';
import { flushSync } from 'react-dom';
import { Recipe, Language } from '../../types/recipe';
import { Make } from '../../types/make';
import { UiTranslations } from '../../i18n/translations';
import { recipeTime, capitalizeFirstLetter } from '../../utils/timeEstimator';
import { hasTypedTimes } from '../../utils/timeText';
import { RecipeTimeTiles } from './RecipeTimeTiles';
import { RecipeSource } from './RecipeSource';
import { PathChoices } from '../../utils/recipeMethod';
import { getStoredPathChoices, setStoredPathChoices } from '../../services/storage';
import { NumberRoll } from '../common/NumberRoll';
import { IngredientsTable } from './IngredientsTable';
import { StepsList } from './StepsList';
import { BakingOptionsView } from './BakingOptionsView';
import { ImageZoomModal } from './ImageZoomModal';
import { RecipeSubheader } from './RecipeSubheader';
import { awaitsTranslation, getLocalizedRecipe } from '../../hooks/useRecipes';
import { addedByName, creditName } from '../../utils/ownership';
import { transitionView } from '../../utils/viewTransition';
import { useUnroll } from '../../hooks/useUnroll';
import { recipePhoto } from '../../utils/vault';
import { photoPending } from '../../utils/deviceCopy';
import { CategoryTile } from '../recipe-grid/CategoryTile';
import { LinkPopover, PopoverLink } from './LinkPopover';
import { madeOnLabel, makerName } from '../../utils/makes';

/** What App can ask of an open recipe page. */
export interface RecipePageHandle {
  /** Closes the step photo open full screen (the navigation island's back button does this). */
  closePhoto: () => void;
}

interface RecipeDetailViewProps {
  recipe: Recipe;
  language: Language;
  /** Once the recipe has (nearly) finished unrolling out of its photo. */
  onUnrolled?: () => void;
  /**
   * Whether it unrolls out of its photo as it opens (the editor's preview). Opened from the
   * Recipe Box, it unfolds from its card instead (utils/viewTransition, the flip motions).
   */
  unroll?: boolean;
  /** A step photo opened full screen, or closed: the navigation island steps aside, leaving its back button. */
  onPhotoOpenChange: (open: boolean) => void;
  /** The version the owner's draft of it becomes, when they have one. */
  draftVersion?: number;
  /** Opens the editor on that draft, out of the chip that was tapped. */
  onContinueDraft?: (from: Element) => void;
  /**
   * What it's a remix of: the original, or null when that's no longer in the Recipe Box.
   * Undefined when it isn't a remix.
   */
  remixOriginal?: Recipe | null;
  /** The remixes family members have made of it. */
  remixes?: Recipe[];
  /** Opens another recipe from the remix popover, given the name tapped there. */
  onOpenRecipe?: (id: string, name: HTMLElement) => void;
  /** What family members made from it, newest first, in the viewer's language. */
  makes?: Make[];
  /** Goes to a make on the Makes page, given its name tapped in the makes popover. */
  onOpenMake?: (id: string, name: HTMLElement) => void;
  ref?: Ref<RecipePageHandle>;
  t: UiTranslations;
}

const noop = () => {};

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe: rawRecipe,
  language,
  onUnrolled,
  unroll = true,
  onPhotoOpenChange,
  draftVersion,
  onContinueDraft,
  remixOriginal,
  remixes = [],
  onOpenRecipe,
  makes = [],
  onOpenMake,
  ref,
  t,
}) => {
  const pageRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLDivElement>(null);
  useUnroll({ photo: heroRef, body: bodyRef, roll: rollRef }, onUnrolled ?? noop, unroll);

  const [scale, setScale] = useState(1);
  // The path each fork is on, remembered per recipe on this phone.
  const [choices, setChoices] = useState<PathChoices>(() => getStoredPathChoices(rawRecipe.id));
  const choosePath = (step: number, path: number) => {
    const next = { ...choices, [step]: path };
    setChoices(next);
    setStoredPathChoices(rawRecipe.id, next);
  };
  // The step photo shown full screen. The step stays set after closing, so the photo has
  // its thumbnail to shrink back into.
  const [zoom, setZoom] = useState<{ src: string; step: number; open: boolean } | null>(null);
  // The popover of links, open from the remix mark by the title (the original), or from a
  // badge by the time (the remixes, or the makes).
  const [remixPop, setRemixPop] = useState<{
    kind: 'original' | 'remixes' | 'makes';
    anchor: HTMLElement;
  } | null>(null);

  const openZoom = (src: string, step: number) => {
    // Marks the thumbnail before the browser snapshots the page, so the photo grows from it.
    flushSync(() => setZoom({ src, step, open: false }));
    transitionView(
      () => {
        setZoom({ src, step, open: true });
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

  useImperativeHandle(ref, () => ({
    closePhoto: () => closeZoom(),
  }));

  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  // The time follows the path the cook is on, unless the author set it. Times the author typed
  // get tiles of their own instead.
  const time = recipeTime(recipe, choices);
  const typedTimes = hasTypedTimes(recipe.times) ? recipe.times : undefined;
  const timeText = time.manual ? t.totalTime(time.minutes) : t.estimatedTime(time.minutes);
  const addedBy = addedByName(rawRecipe);
  const shownIn = (r: Recipe) => getLocalizedRecipe(r, language) || r;
  const openRemixPop =
    (kind: 'original' | 'remixes' | 'makes') => (e: React.MouseEvent<HTMLElement>) =>
      setRemixPop({ kind, anchor: e.currentTarget });
  const recipeLink = (r: Recipe): PopoverLink => {
    const shown = shownIn(r);
    const photo = recipePhoto(shown);
    return {
      id: r.id,
      name: shown.name,
      byline: t.byAuthor(creditName(shown)),
      thumb: photo ? <img src={photo} alt="" decoding="async" /> : <CategoryTile recipe={r} />,
    };
  };
  const makeLink = (m: Make): PopoverLink => ({
    id: m.id,
    name: m.title || recipe.name,
    byline: [makerName(m), madeOnLabel(m, language, t)].filter(Boolean).join(' · '),
    thumb: m.photo ? (
      <img src={m.photo} alt="" decoding="async" />
    ) : (
      <span className="photo-pending" />
    ),
  });

  const handleIncreaseScale = () => {
    setScale((prev) => (prev === 0.5 ? 1 : Math.min(8, prev + 1)));
  };

  const handleDecreaseScale = () => {
    setScale((prev) => (prev === 1 ? 0.5 : Math.max(0.5, prev - 1)));
  };

  return (
    <article ref={pageRef} id="viewDetail" className="recipe-detail active">
      <RecipeSubheader page={pageRef} />

      {/* Hero Photo */}
      <div ref={heroRef} className="detail-hero-frame">
        {recipePhoto(recipe) ? (
          <img
            id="detailHeroImg"
            className="detail-hero-img"
            src={recipePhoto(recipe)}
            alt={recipe.name}
          />
        ) : photoPending(recipe) ? (
          <div className="photo-pending" />
        ) : (
          <CategoryTile recipe={recipe} className="detail-hero-tile" />
        )}
      </div>

      {/* The recipe unrolls down out of the photo (hooks/useUnroll). */}
      <div className="detail-unroll">
        <div ref={rollRef} className="detail-roll" aria-hidden="true" />
        <div ref={bodyRef} className="detail-body">
          {/* Header Info */}
          <header className="detail-header-block">
            <div className="detail-title-row">
              <h1 id="detailTitle" className="detail-title">
                {recipe.name}
              </h1>
              {remixOriginal !== undefined && (
                <button
                  type="button"
                  className="remix-mark is-button"
                  aria-label={t.showRemixOriginal}
                  aria-haspopup="dialog"
                  aria-expanded={remixPop?.kind === 'original'}
                  onClick={openRemixPop('original')}
                >
                  <Shuffle size="1em" strokeWidth={2.1} aria-hidden="true" />
                </button>
              )}
            </div>
            {/* Each item after the first is set off by a dot (index.css), which is hidden when
                the row wraps and the item starts a line. */}
            <div className="detail-meta">
              <span
                id="detailAuthor"
                className="detail-meta-item"
                style={{ fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {t.byAuthor(creditName(recipe))}
              </span>
              {addedBy && <span className="detail-meta-item added-by">{t.addedBy(addedBy)}</span>}
              {/* Previewing a recipe with no steps yet: no time to show. */}
              {!typedTimes && time.minutes > 0 && (
                <span id="detailEstimatedTime" className="detail-meta-item detail-time">
                  <Timer className="time-icon" size="1.05em" strokeWidth={2.1} aria-hidden="true" />
                  <NumberRoll value={timeText} />
                </span>
              )}
              {remixes.length > 0 && (
                <button
                  type="button"
                  className="remix-badge is-button"
                  aria-label={t.remixCount(remixes.length)}
                  aria-haspopup="dialog"
                  aria-expanded={remixPop?.kind === 'remixes'}
                  onClick={openRemixPop('remixes')}
                >
                  <Shuffle size="1em" strokeWidth={2.2} aria-hidden="true" />
                  <span className="remix-badge-count">{remixes.length}</span>
                </button>
              )}
              {makes.length > 0 && onOpenMake && (
                <button
                  type="button"
                  className="remix-badge make-badge is-button"
                  aria-label={t.makeCount(makes.length)}
                  aria-haspopup="dialog"
                  aria-expanded={remixPop?.kind === 'makes'}
                  onClick={openRemixPop('makes')}
                >
                  <CookingPot size="1em" strokeWidth={2.2} aria-hidden="true" />
                  <span className="remix-badge-count">{makes.length}</span>
                </button>
              )}
            </div>
            {typedTimes && <RecipeTimeTiles times={typedTimes} t={t} />}
            {/* Some of it is still in the original language: its translation is coming. */}
            {awaitsTranslation(rawRecipe, language) && (
              <p className="detail-translating">
                <Languages size="1.05em" aria-hidden="true" />
                <span>{t.translationOnItsWay}</span>
                <span className="detail-translating-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </p>
            )}
            {/* The owner's unfinished edit, ready to carry on with. */}
            {draftVersion !== undefined && onContinueDraft && (
              <button
                type="button"
                className="detail-draft-chip"
                onClick={(e) => onContinueDraft(e.currentTarget)}
              >
                <FilePen size="1.05em" aria-hidden="true" />
                <span>{t.draftLabel(draftVersion)}</span>
                <span className="detail-draft-chip-dot" aria-hidden="true">
                  ·
                </span>
                <span className="detail-draft-chip-action">{t.continueDraft}</span>
                <ChevronRight size="1em" aria-hidden="true" />
              </button>
            )}
          </header>

          {/* Crucial Note: read before shopping or starting, so above both columns */}
          {recipe.notes && (
            <div id="notesCard" className="callout-box warn detail-note">
              <div className="callout-label">{t.crucialNote}</div>
              <div id="notesText">{capitalizeFirstLetter(recipe.notes)}</div>
            </div>
          )}

          {/* Two Column Layout */}
          <div className="recipe-layout">
            {/* Left Column: Ingredients */}
            <IngredientsTable
              ingredients={recipe.ingredients || []}
              scale={scale}
              onIncreaseScale={handleIncreaseScale}
              onDecreaseScale={handleDecreaseScale}
              yieldHeader={recipe.yieldHeader}
              language={language}
              t={t}
            />

            {/* Right Column: Method, then the Kitchen Tip */}
            <div className="method-panel">
              {/* Steps Section */}
              <StepsList
                steps={recipe.steps || []}
                choices={choices}
                onChoosePath={choosePath}
                laminationDirective={recipe.laminationDirective}
                // Only while the viewer is closed: the open viewer carries the morphing photo's name,
                // and two elements sharing it would cancel the transition.
                zoomSource={zoom && !zoom.open ? zoom.step : undefined}
                onZoomImage={openZoom}
                t={t}
              />

              {/* Baking Options */}
              <BakingOptionsView bakingOptions={recipe.bakingOptions} t={t} />

              {/* Kitchen Tip (verbatim): once the method has been read */}
              {recipe.tips && (
                <div id="tipsCard" className="callout-box gold detail-tip">
                  <div className="callout-label">{t.kitchenTip}</div>
                  <div id="tipsText">{capitalizeFirstLetter(recipe.tips)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Adapted from: where the recipe came from, at its foot */}
          <RecipeSource recipe={recipe} t={t} />
        </div>
      </div>

      {/* A badge's popover goes with the badge, should the last remix or make be deleted meanwhile. */}
      {remixPop?.kind === 'makes'
        ? makes.length > 0 &&
          onOpenMake && (
            <LinkPopover
              anchor={remixPop.anchor}
              title={t.makes}
              icon={CookingPot}
              links={makes.map(makeLink)}
              onOpen={onOpenMake}
              onClose={() => setRemixPop(null)}
            />
          )
        : remixPop &&
          onOpenRecipe &&
          (remixPop.kind === 'original' || remixes.length > 0) && (
            <LinkPopover
              anchor={remixPop.anchor}
              title={remixPop.kind === 'original' ? t.remixedFrom : t.remixesTitle}
              icon={Shuffle}
              links={
                remixPop.kind === 'original'
                  ? remixOriginal
                    ? [recipeLink(remixOriginal)]
                    : []
                  : remixes.map(recipeLink)
              }
              emptyText={remixPop.kind === 'original' ? t.remixOriginalGone : undefined}
              onOpen={onOpenRecipe}
              onClose={() => setRemixPop(null)}
            />
          )}

      {/* Image Zoom Lightbox Modal */}
      {zoom?.open && (
        <ImageZoomModal key={zoom.src} imageSrc={zoom.src} onClose={closeZoom} t={t} />
      )}
    </article>
  );
};
