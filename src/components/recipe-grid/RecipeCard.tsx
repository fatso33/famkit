import React from 'react';
import { Recipe, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { calculateRecipeTime } from '../../utils/timeEstimator';
import { getLocalizedRecipe } from '../../hooks/useRecipes';

interface RecipeCardProps {
  recipe: Recipe;
  language: Language;
  onSelect: (id: string) => void;
  t: UiTranslations;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe: rawRecipe,
  language,
  onSelect,
  t,
}) => {
  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  const isWandas = rawRecipe.id === 'wandas-cheese-bread' || rawRecipe.isDefault;
  const estimatedTime = calculateRecipeTime(recipe);

  const fallbackImage =
    'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=1200&q=80';

  const badgeText = isWandas ? t.heirloomBadge : t.familyBadge;
  const ingCountText = t.ingredientsCount(
    recipe.ingredients ? recipe.ingredients.length : 0
  );

  const cardDesc = isWandas
    ? (recipe.cardDescription || "A delicious crusty Dutch-oven cheese bread with melted cheddar and spicy crushed jalapenos.")
    : (recipe.tips || (recipe.notes || 'A time-tested family favorite.'));

  return (
    <div
      className="recipe-card"
      onClick={() => onSelect(rawRecipe.id)}
    >
      <div className="card-media">
        <img
          src={recipe.heroImage || fallbackImage}
          alt={recipe.name}
          loading="lazy"
        />
        <div className="card-badge">{badgeText}</div>
      </div>
      <div className="card-body">
        <h3 className="card-title">{recipe.name}</h3>
        <div className="card-meta">
          <span>By {recipe.author}</span>
          <span aria-hidden="true">·</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ⏱️ {estimatedTime}
          </span>
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
