import React from 'react';
import { Recipe, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { estimateRecipeMinutes } from '../../utils/timeEstimator';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { isHeirloom } from '../../utils/ownership';
import { vaultItemKey } from '../../utils/viewTransition';
import { FALLBACK_RECIPE_PHOTO } from '../../utils/vault';

interface RecipeCardProps {
  recipe: Recipe;
  language: Language;
  /** Its photo morphs into the recipe's hero photo and back (see transitionView). */
  isMorphTarget?: boolean;
  /** Its place in the vault's entrance, when the page is arriving (see VaultHeader). */
  enterIndex?: number;
  onSelect: (id: string) => void;
  t: UiTranslations;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe: rawRecipe,
  language,
  isMorphTarget = false,
  enterIndex,
  onSelect,
  t,
}) => {
  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  const estimatedTime = t.estimatedTime(estimateRecipeMinutes(recipe));

  const badgeText = isHeirloom(rawRecipe) ? t.heirloomBadge : t.familyBadge;
  const ingCountText = t.ingredientsCount(recipe.ingredients ? recipe.ingredients.length : 0);

  const defaultDesc =
    language === 'pl'
      ? 'Tradycyjny, sprawdzony przepis rodzinny.'
      : 'A time-tested family favorite.';

  const cardDesc = recipe.cardDescription || recipe.tips || recipe.notes || defaultDesc;

  return (
    <div
      className={`recipe-card vault-item${isMorphTarget ? ' is-morph-target' : ''}`}
      data-vault-item={vaultItemKey(rawRecipe.id)}
      style={
        enterIndex === undefined ? undefined : ({ '--enter-i': enterIndex } as React.CSSProperties)
      }
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
      <div className="card-media" data-vault-photo="">
        <img
          src={recipe.heroImage || FALLBACK_RECIPE_PHOTO}
          alt={recipe.name}
          // The photo coming back from the recipe must be ready to land in its card.
          loading={isMorphTarget ? 'eager' : 'lazy'}
          // Laid out uncropped while it morphs (utils/photoMorph).
          data-morph-photo={isMorphTarget ? '' : undefined}
        />
        <div className="card-badge">{badgeText}</div>
      </div>
      <div className="card-body">
        <h3 className="card-title" data-vault-name="">
          {recipe.name}
        </h3>
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
