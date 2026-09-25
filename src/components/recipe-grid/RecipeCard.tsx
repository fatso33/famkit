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

  const cardDesc =
    recipe.cardDescription ||
    recipe.tips ||
    recipe.notes ||
    'A time-tested family favorite.';

  return (
    <div
      onClick={() => onSelect(rawRecipe.id)}
      className="group flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-pointer text-left"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Media frame */}
      <div
        className="relative aspect-[16/10] overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <img
          src={recipe.heroImage || fallbackImage}
          alt={recipe.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div
          className="absolute top-3 left-3 px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: 'rgba(19, 18, 17, 0.78)' }}
        >
          {badgeText}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h3
          className="font-serif font-bold text-xl mb-1.5 leading-snug group-hover:text-[#c85a32] transition-colors"
          style={{ color: 'var(--text-primary)' }}
        >
          {recipe.name}
        </h3>

        <div
          className="flex items-center gap-1.5 text-xs mb-3 font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>By {recipe.author}</span>
          <span aria-hidden="true">·</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ⏱️ {estimatedTime}
          </span>
        </div>

        <p
          className="text-xs leading-relaxed mb-4 line-clamp-2 flex-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          {cardDesc}
        </p>

        {/* Footer */}
        <div
          className="pt-3 border-t flex justify-between items-center text-xs font-semibold"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--accent)',
          }}
        >
          <span>{t.viewRecipe}</span>
          <span style={{ color: 'var(--text-muted)' }}>{ingCountText}</span>
        </div>
      </div>
    </div>
  );
};
