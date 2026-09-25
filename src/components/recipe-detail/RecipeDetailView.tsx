import React, { useState } from 'react';
import { Recipe, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { calculateRecipeTime, capitalizeFirstLetter } from '../../utils/timeEstimator';
import { IngredientsTable } from './IngredientsTable';
import { StepsList } from './StepsList';
import { BakingOptionsView } from './BakingOptionsView';
import { ImageZoomModal } from './ImageZoomModal';
import { getLocalizedRecipe } from '../../hooks/useRecipes';

interface RecipeDetailViewProps {
  recipe: Recipe;
  language: Language;
  isWakeLocked: boolean;
  onToggleWakeLock: () => void;
  isWakeLockSupported: boolean;
  onEditRecipe?: (recipe: Recipe) => void;
  t: UiTranslations;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe: rawRecipe,
  language,
  isWakeLocked,
  onToggleWakeLock,
  isWakeLockSupported,
  onEditRecipe,
  t,
}) => {
  const [scale, setScale] = useState(1);
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);

  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  const estimatedTime = calculateRecipeTime(recipe);

  const handleIncreaseScale = () => {
    setScale((prev) => (prev === 0.5 ? 1 : Math.min(8, prev + 1)));
  };

  const handleDecreaseScale = () => {
    setScale((prev) => (prev === 1 ? 0.5 : Math.max(0.5, prev - 1)));
  };

  return (
    <article id="viewDetail" className="recipe-detail active">
      {/* Hero Photo */}
      <div className="detail-hero-frame">
        <img
          id="detailHeroImg"
          className="detail-hero-img"
          src={recipe.heroImage || 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=1200&q=80'}
          alt={recipe.name}
        />
      </div>

      {/* Header Info */}
      <header className="detail-header-block">
        <h1 id="detailTitle" className="detail-title">
          {recipe.name}
        </h1>
        <div className="detail-meta">
          <span
            id="detailAuthor"
            style={{ fontWeight: 600, color: 'var(--text-primary)' }}
          >
            By {recipe.author}
          </span>
          {recipe.version && recipe.version > 1 && (
            <span className="version-tag" title={`Version ${recipe.version}`}>
              {t.versionBadge(recipe.version)}
            </span>
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
            ⏱️ {estimatedTime}
          </span>

          {onEditRecipe && (
            <>
              <span aria-hidden="true">·</span>
              <button
                className="btn"
                style={{
                  padding: '0.2rem 0.65rem',
                  minHeight: '28px',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderRadius: 'var(--radius-full)',
                }}
                onClick={() => onEditRecipe(rawRecipe)}
                title={t.editRecipe}
              >
                ✏️ {t.editRecipe}
              </button>
            </>
          )}

          {isWakeLockSupported && (
            <>
              <span aria-hidden="true">·</span>
              <button
                className={`btn ${isWakeLocked ? 'btn-primary' : ''}`}
                style={{
                  padding: '0.2rem 0.65rem',
                  minHeight: '28px',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderRadius: 'var(--radius-full)',
                }}
                onClick={onToggleWakeLock}
                title="Toggle Cook Mode (Screen Wake Lock)"
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
              <div id="tipsText">
                {capitalizeFirstLetter(recipe.tips)}
              </div>
            </div>
          )}

          {/* Crucial Note: Moved directly under Kitchen Tip */}
          {recipe.notes && (
            <div id="notesCard" className="callout-box warn">
              <div className="callout-label">{t.crucialNote}</div>
              <div id="notesText">
                {capitalizeFirstLetter(recipe.notes)}
              </div>
            </div>
          )}

          {/* Steps Section */}
          <StepsList
            steps={recipe.steps || []}
            laminationDirective={recipe.laminationDirective}
            onZoomImage={setZoomImageSrc}
            t={t}
          />

          {/* Baking Options */}
          <BakingOptionsView
            bakingOptions={recipe.bakingOptions}
            t={t}
          />
        </div>
      </div>

      {/* Image Zoom Lightbox Modal */}
      <ImageZoomModal
        imageSrc={zoomImageSrc}
        onClose={() => setZoomImageSrc(null)}
      />
    </article>
  );
};
