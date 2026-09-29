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
  /** Its photo morphs into the recipe's hero photo and back (see transitionView). */
  isMorphTarget?: boolean;
  /** Its place in the vault's entrance, when the page is arriving (see VaultHeader). */
  enterIndex?: number;
  /** A draft: marked as one, named as one, and it's carried on with rather than viewed. */
  draft?: boolean;
  /** Given the card, which a page can open out of. */
  onSelect: (id: string, from: HTMLElement) => void;
  t: UiTranslations;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe: rawRecipe,
  language,
  isMorphTarget = false,
  enterIndex,
  draft = false,
  onSelect,
  t,
}) => {
  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  const time = recipeTime(recipe);
  const estimatedTime = time.manual ? t.totalTime(time.minutes) : t.estimatedTime(time.minutes);

  const photo = recipePhoto(recipe);
  const ingCountText = t.ingredientsCount(recipe.ingredients ? recipe.ingredients.length : 0);

  const defaultDesc =
    language === 'pl'
      ? 'Tradycyjny, sprawdzony przepis rodzinny.'
      : 'A time-tested family favorite.';

  const cardDesc = recipe.cardDescription || recipe.tips || recipe.notes || defaultDesc;

  return (
    <div
      className={`recipe-card vault-item${isMorphTarget ? ' is-morph-target' : ''}${draft ? ' is-draft' : ''}`}
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
            // The photo coming back from the recipe must be ready to land in its card.
            loading={isMorphTarget ? 'eager' : 'lazy'}
            // Laid out uncropped while it morphs (utils/photoMorph).
            data-morph-photo={isMorphTarget ? '' : undefined}
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
        <div className="card-meta">
          <span>{t.byAuthor(recipe.author)}</span>
          <span aria-hidden="true">·</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>⏱️ {estimatedTime}</span>
        </div>
        <p className="card-desc">{cardDesc}</p>
        <div className="card-footer">
          <span>{draft ? t.continueDraft : t.viewRecipe}</span>
          <span>{ingCountText}</span>
        </div>
      </div>
    </div>
  );
};
