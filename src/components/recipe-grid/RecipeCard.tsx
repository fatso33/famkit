import React from 'react';
import { Timer } from 'lucide-react';
import { Recipe, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { recipeTime } from '../../utils/timeEstimator';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { vaultItemKey } from '../../utils/viewTransition';
import { recipePhoto } from '../../utils/vault';
import { creditName } from '../../utils/ownership';
import { photoPending } from '../../utils/deviceCopy';
import { CategoryTile } from './CategoryTile';
import { MakeBadge, RemixBadge, RemixMark } from './RemixMarks';

interface RecipeCardProps {
  recipe: Recipe;
  language: Language;
  /** The card that flips open into the recipe, and back shut (the one last opened). */
  isFlipTarget?: boolean;
  /** Its place in the vault's entrance, when the page is arriving (see VaultHeader). */
  enterIndex?: number;
  /** A draft: marked as one, named as one, and it's carried on with rather than viewed. */
  draft?: boolean;
  /** A remix of another recipe: marked by its name. */
  remixed?: boolean;
  /** How many remixes have been made of it. */
  remixCount?: number;
  /** How many makes family members have shared of it. */
  makeCount?: number;
  /** Given the card, which the recipe flips open out of. */
  onSelect: (id: string, from: HTMLElement) => void;
  t: UiTranslations;
}

/**
 * A recipe in the cards layout: a photo card filed in the Recipe Box, in front of the one above
 * it, with the photo mounted at its top, the name over a ruled line, and a few lines about it.
 */
export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe: rawRecipe,
  language,
  isFlipTarget = false,
  enterIndex,
  draft = false,
  remixed = false,
  remixCount = 0,
  makeCount = 0,
  onSelect,
  t,
}) => {
  const recipe = getLocalizedRecipe(rawRecipe, language) || rawRecipe;
  const time = recipeTime(recipe);
  const estimatedTime = time.manual ? t.totalTime(time.minutes) : t.estimatedTime(time.minutes);
  const photo = recipePhoto(recipe);
  const description =
    recipe.cardDescription || recipe.tips || recipe.notes || t.cardDescriptionFallback;

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
        <div className="card-title-row">
          <h3 className="card-title" data-vault-name="">
            {recipe.name}
          </h3>
          {remixed && <RemixMark className="is-end" />}
        </div>
        <span className="vault-card-rule" aria-hidden="true" />
        <div className="card-meta">
          <span className="card-cook">{creditName(recipe)}</span>
          {/* A draft with no steps yet has no time to show. */}
          {time.minutes > 0 && (
            <span className="card-time">
              <Timer className="time-icon" size="1.05em" strokeWidth={2.1} aria-hidden="true" />
              {estimatedTime}
            </span>
          )}
          {(remixCount > 0 || makeCount > 0) && (
            <span className="vault-badges">
              {remixCount > 0 && <RemixBadge count={remixCount} />}
              {makeCount > 0 && <MakeBadge count={makeCount} />}
            </span>
          )}
        </div>
        <p className="card-desc">{description}</p>
      </div>
    </div>
  );
};
