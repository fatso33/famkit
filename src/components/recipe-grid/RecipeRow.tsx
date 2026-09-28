import React from 'react';
import { ChevronRight, Heart } from 'lucide-react';
import { Recipe } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { recipeTime } from '../../utils/timeEstimator';
import { isHeirloom } from '../../utils/ownership';
import { vaultItemKey } from '../../utils/viewTransition';
import { recipePhoto } from '../../utils/vault';
import { CategoryTile } from './CategoryTile';

interface RecipeRowProps {
  recipe: Recipe;
  /** The recipe in the viewer's language. */
  shown: Recipe;
  /** Its photo morphs into the recipe's hero photo and back, like a card's. */
  isMorphTarget?: boolean;
  /** Its place in the vault's entrance, when the page is arriving. */
  enterIndex?: number;
  onSelect: (id: string) => void;
  t: UiTranslations;
}

/** A recipe in the vault's list layout: photo, name, cook and time, without the description. */
export const RecipeRow: React.FC<RecipeRowProps> = ({
  recipe,
  shown,
  isMorphTarget = false,
  enterIndex,
  onSelect,
  t,
}) => {
  const heirloom = isHeirloom(recipe);
  const photo = recipePhoto(shown);
  return (
    <button
      type="button"
      className={`vault-row vault-item${isMorphTarget ? ' is-morph-target' : ''}`}
      data-vault-item={vaultItemKey(recipe.id)}
      style={
        enterIndex === undefined ? undefined : ({ '--enter-i': enterIndex } as React.CSSProperties)
      }
      // Named like a card: by the recipe alone.
      aria-label={shown.name}
      onClick={() => onSelect(recipe.id)}
    >
      <span className="vault-row-photo" data-vault-photo="">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading={isMorphTarget ? 'eager' : 'lazy'}
            data-morph-photo={isMorphTarget ? '' : undefined}
          />
        ) : (
          <CategoryTile recipe={recipe} />
        )}
      </span>
      <span className="vault-row-text">
        <span className="vault-row-name" data-vault-name="">
          {shown.name}
        </span>
        <span className="vault-row-meta">
          {heirloom && (
            <Heart
              className="vault-row-heirloom"
              size="0.95em"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          )}
          <span className="vault-row-cook">{shown.author}</span>
          <span aria-hidden="true">·</span>
          <span className="vault-row-time">{t.totalTime(recipeTime(shown).minutes)}</span>
        </span>
      </span>
      <ChevronRight className="vault-row-chevron" size="1.25em" aria-hidden="true" />
    </button>
  );
};
