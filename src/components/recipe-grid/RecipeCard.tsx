import React from 'react';
import { Recipe, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { recipeTime } from '../../utils/timeEstimator';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { vaultItemKey } from '../../utils/viewTransition';
import { recipePhoto } from '../../utils/vault';
import { photoPending } from '../../utils/deviceCopy';
import { CategoryTile } from './CategoryTile';

interface RecipeCardProps {
  recipe: Recipe;
  language: Language;
  /** The card that flips open into the recipe, and back shut (the one last opened). */
  isFlipTarget?: boolean;
  /** Its place in the vault's entrance, when the page is arriving (see VaultHeader). */
  enterIndex?: number;
  /** A draft: marked as one, named as one, and it's carried on with rather than viewed. */
  draft?: boolean;
  /** Given the card, which the recipe flips open out of. */
  onSelect: (id: string, from: HTMLElement) => void;
  t: UiTranslations;
}

/**
 * A recipe in the cards layout: a photo card filed in the Recipe Box, in front of the one above
 * it, with the photo mounted at its top and the name over a ruled line.
 */
export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe: rawRecipe,
  language,
  isFlipTarget = false,
  enterIndex,
  draft = false,
  onSelect,
  t,
}) => {
  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  const time = recipeTime(recipe);
  const estimatedTime = time.manual ? t.totalTime(time.minutes) : t.estimatedTime(time.minutes);
  const photo = recipePhoto(recipe);

  return (
    <div
      className={`recipe-card vault-item${isFlipTarget ? ' is-flip-target' : ''}${draft ? ' is-draft' : ''}`}
      data-vault-item={vaultItemKey(rawRecipe.id)}
      style={
        enterIndex === undefined ? undefined : ({ '--enter-i': enterIndex } as React.CSSProperties)
      }
      role="button"
      tabIndex={0}
      aria-label={draft ? t.draftNamed(recipe.name) : recipe.name}
      onClick={(e) => onSelect(rawRecipe.id, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(rawRecipe.id, e.currentTarget);
        }
      }}
    >
      <div className="card-media" data-vault-photo="">
        {draft && (
          <span className="vault-draft-ribbon" aria-hidden="true">
            {t.draftRibbon}
          </span>
        )}
        {photo ? (
          <img
            src={photo}
            alt={recipe.name}
            // The card flipping open must be whole in the snapshot the flip is made of.
            loading={isFlipTarget ? 'eager' : 'lazy'}
          />
        ) : photoPending(rawRecipe) ? (
          <div className="photo-pending" />
        ) : (
          <CategoryTile recipe={rawRecipe} />
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title" data-vault-name="">
          {recipe.name}
        </h3>
        <span className="vault-card-rule" aria-hidden="true" />
        <div className="card-meta">
          <span className="card-cook">{recipe.author}</span>
          <span aria-hidden="true">·</span>
          <span className="card-time">{estimatedTime}</span>
        </div>
      </div>
    </div>
  );
};
