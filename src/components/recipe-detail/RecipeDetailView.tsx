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
  t: UiTranslations;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe: rawRecipe,
  language,
  isWakeLocked,
  onToggleWakeLock,
  isWakeLockSupported,
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
    <article className="animate-[fadeIn_0.2s_ease-out]">
      {/* Hero Photo */}
      <div
        className="w-full aspect-[21/9] max-h-[440px] min-h-[220px] rounded-2xl overflow-hidden mb-6 border shadow-md"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <img
          src={recipe.heroImage || 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=1200&q=80'}
          alt={recipe.name}
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Header Info */}
      <header className="mb-6">
        <h1
          className="font-serif font-bold text-3xl sm:text-5xl leading-tight mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {recipe.name}
        </h1>

        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            By {recipe.author}
          </span>
          <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ⏱️ {estimatedTime}
          </span>

          {isWakeLockSupported && (
            <>
              <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span>
              <button
                onClick={onToggleWakeLock}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  isWakeLocked ? 'btn-primary' : ''
                }`}
                style={{
                  borderColor: isWakeLocked ? 'var(--accent)' : 'var(--border-subtle)',
                  backgroundColor: isWakeLocked ? 'var(--accent)' : 'var(--bg-surface)',
                  color: isWakeLocked ? '#ffffff' : 'var(--text-primary)',
                }}
              >
                {isWakeLocked && <span className="pulse-dot" />}
                <span>{isWakeLocked ? t.cookModeOn : t.cookModeOff}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8 items-start">
        {/* Left Column: Ingredients Table */}
        <IngredientsTable
          ingredients={recipe.ingredients || []}
          scale={scale}
          onIncreaseScale={handleIncreaseScale}
          onDecreaseScale={handleDecreaseScale}
          yieldHeader={recipe.yieldHeader}
          language={language}
          t={t}
        />

        {/* Right Column: Tips, Notes, Steps, Baking Options */}
        <div className="flex flex-col">
          {/* Kitchen Tip */}
          {recipe.tips && (
            <div className="callout-box gold">
              <div className="callout-label">{t.kitchenTip}</div>
              <div style={{ color: 'var(--text-primary)' }}>
                {capitalizeFirstLetter(recipe.tips)}
              </div>
            </div>
          )}

          {/* Crucial Note */}
          {recipe.notes && (
            <div className="callout-box warn">
              <div className="callout-label">{t.crucialNote}</div>
              <div>{capitalizeFirstLetter(recipe.notes)}</div>
            </div>
          )}

          {/* Steps */}
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

      {/* Image Zoom Lightbox */}
      <ImageZoomModal
        imageSrc={zoomImageSrc}
        onClose={() => setZoomImageSrc(null)}
      />
    </article>
  );
};
