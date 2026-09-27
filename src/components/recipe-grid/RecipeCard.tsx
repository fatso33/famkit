import React from 'react';
import { Recipe, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { estimateRecipeMinutes } from '../../utils/timeEstimator';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { isHeirloom } from '../../utils/ownership';

interface RecipeCardProps {
  recipe: Recipe;
  language: Language;
  /** Its photo morphs into the recipe's hero photo and back (see transitionView). */
  isMorphTarget?: boolean;
  onSelect: (id: string) => void;
  t: UiTranslations;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe: rawRecipe,
  language,
  isMorphTarget = false,
  onSelect,
  t,
}) => {
  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  const estimatedTime = t.estimatedTime(estimateRecipeMinutes(recipe));

  const fallbackImage =
    'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=1200&q=80';

  const badgeText = isHeirloom(rawRecipe) ? t.heirloomBadge : t.familyBadge;
  const ingCountText = t.ingredientsCount(recipe.ingredients ? recipe.ingredients.length : 0);

  const defaultDesc =
    language === 'pl'
      ? 'Tradycyjny, sprawdzony przepis rodzinny.'
      : 'A time-tested family favorite.';

  const cardDesc = recipe.cardDescription || recipe.tips || recipe.notes || defaultDesc;

  return (
    <div
      className={`recipe-card${isMorphTarget ? ' is-morph-target' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={recipe.name}
      onClick={() => onSelect(rawRecipe.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(rawRecipe.id);
        }
      }}
    >
      <div className="card-media">
        <img
          src={recipe.heroImage || fallbackImage}
          alt={recipe.name}
          // The photo coming back from the recipe must be ready to land in its card.
          loading={isMorphTarget ? 'eager' : 'lazy'}
        />
        <div className="card-badge">{badgeText}</div>
      </div>
      <div className="card-body">
        <h3 className="card-title">{recipe.name}</h3>
        <div className="card-meta">
          <span>{t.byAuthor(recipe.author)}</span>
          <span aria-hidden="true">·</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>⏱️ {estimatedTime}</span>
        </div>
        <p className="card-desc">{cardDesc}</p>
        <div className="card-footer">
          <span>{t.viewRecipe}</span>
          <span>{ingCountText}</span>
        </div>
      </div>
    </div>
  );
};
