import React, { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { Recipe, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { recipeTime, capitalizeFirstLetter } from '../../utils/timeEstimator';
import { PathChoices } from '../../utils/recipeMethod';
import { getStoredPathChoices, setStoredPathChoices } from '../../services/storage';
import { NumberRoll } from '../common/NumberRoll';
import { IngredientsTable } from './IngredientsTable';
import { StepsList } from './StepsList';
import { BakingOptionsView } from './BakingOptionsView';
import { ImageZoomModal } from './ImageZoomModal';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { addedByName } from '../../utils/ownership';
import { transitionView } from '../../utils/viewTransition';
import { useUnroll } from '../../hooks/useUnroll';
import { recipePhoto } from '../../utils/vault';
import { photoPending } from '../../utils/deviceCopy';
import { CategoryTile } from '../recipe-grid/CategoryTile';

/** What App can ask of an open recipe page. */
export interface RecipePageHandle {
  /** Rolls the recipe up into its photo; null where nothing would animate. */
  rollUp: () => Promise<void> | null;
}

interface RecipeDetailViewProps {
  recipe: Recipe;
  language: Language;
  isWakeLocked: boolean;
  onToggleWakeLock: () => void;
  isWakeLockSupported: boolean;
  /** Once the recipe has (nearly) finished unrolling out of its photo. */
  onUnrolled: () => void;
  ref?: Ref<RecipePageHandle>;
  t: UiTranslations;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe: rawRecipe,
  language,
  isWakeLocked,
  onToggleWakeLock,
  isWakeLockSupported,
  onUnrolled,
  ref,
  t,
}) => {
  const heroRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLDivElement>(null);
  const { rollUp } = useUnroll({ photo: heroRef, body: bodyRef, roll: rollRef }, onUnrolled);
  useImperativeHandle(ref, () => ({ rollUp }));

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

  const openZoom = (src: string, step: number) => {
    // Marks the thumbnail before the browser snapshots the page, so the photo grows from it.
    flushSync(() => setZoom({ src, step, open: false }));
    transitionView(() => setZoom({ src, step, open: true }), { motion: 'zoom', morph: 'photo' });
  };
  const closeZoom = (animated = true) =>
    transitionView(() => setZoom((z) => z && { ...z, open: false }), {
      motion: 'zoom',
      morph: 'photo',
      animated,
    });

  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  // The time follows the path the cook is on, unless the author set it.
  const time = recipeTime(recipe, choices);
  const timeText = time.manual ? t.totalTime(time.minutes) : t.estimatedTime(time.minutes);
  const addedBy = addedByName(rawRecipe);

  const handleIncreaseScale = () => {
    setScale((prev) => (prev === 0.5 ? 1 : Math.min(8, prev + 1)));
  };

  const handleDecreaseScale = () => {
    setScale((prev) => (prev === 1 ? 0.5 : Math.max(0.5, prev - 1)));
  };

  return (
    <article id="viewDetail" className="recipe-detail active">
      {/* Hero Photo */}
      <div ref={heroRef} className="detail-hero-frame">
        {recipePhoto(recipe) ? (
          <img
            id="detailHeroImg"
            className="detail-hero-img"
            data-morph-photo=""
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
            <h1 id="detailTitle" className="detail-title">
              {recipe.name}
            </h1>
            <div className="detail-meta">
              <span id="detailAuthor" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {t.byAuthor(recipe.author)}
              </span>
              {addedBy && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="added-by">{t.addedBy(addedBy)}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span
                id="detailEstimatedTime"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--accent)',
                  fontWeight: 600,
                }}
              >
                ⏱️ <NumberRoll value={timeText} />
              </span>

              {isWakeLockSupported && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    className={`btn btn-meta-pill ${isWakeLocked ? 'btn-primary' : ''}`}
                    onClick={onToggleWakeLock}
                    title={t.cookModeTooltip}
                  >
                    {isWakeLocked && <span className="pulse-dot" />}
                    <span>{isWakeLocked ? t.cookModeOn : t.cookModeOff}</span>
                  </button>
                </>
              )}
            </div>
          </header>

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

            {/* Right Column: Method & Notes */}
            <div className="method-panel">
              {/* Tips Section (verbatim) */}
              {recipe.tips && (
                <div id="tipsCard" className="callout-box gold">
                  <div className="callout-label">{t.kitchenTip}</div>
                  <div id="tipsText">{capitalizeFirstLetter(recipe.tips)}</div>
                </div>
              )}

              {/* Crucial Note: Moved directly under Kitchen Tip */}
              {recipe.notes && (
                <div id="notesCard" className="callout-box warn">
                  <div className="callout-label">{t.crucialNote}</div>
                  <div id="notesText">{capitalizeFirstLetter(recipe.notes)}</div>
                </div>
              )}

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
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Lightbox Modal */}
      {zoom?.open && (
        <ImageZoomModal key={zoom.src} imageSrc={zoom.src} onClose={closeZoom} t={t} />
      )}
    </article>
  );
};
