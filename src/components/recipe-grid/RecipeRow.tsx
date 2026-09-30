import React from 'react';
import { Timer } from 'lucide-react';
import { Recipe } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { recipeTime } from '../../utils/timeEstimator';
import { vaultItemKey } from '../../utils/viewTransition';
import { recipePhoto } from '../../utils/vault';
import { photoPending } from '../../utils/deviceCopy';
import { CategoryTile } from './CategoryTile';
import { RemixBadge, RemixMark } from './RemixMarks';

interface RecipeRowProps {
  recipe: Recipe;
  /** The recipe in the viewer's language. */
  shown: Recipe;
  /** The card that flips open into the recipe, and back shut (the one last opened). */
  isFlipTarget?: boolean;
  /** Its place in the vault's entrance, when the page is arriving. */
  enterIndex?: number;
  /** A draft: marked and named as one. */
  draft?: boolean;
  /** A remix of another recipe: marked by its name. */
  remixed?: boolean;
  /** How many remixes have been made of it. */
  remixCount?: number;
  /** Given the card, which the recipe flips open out of. */
  onSelect: (id: string, from: HTMLElement) => void;
  t: UiTranslations;
}

/**
 * A recipe in the list layout: an index card filed in the Recipe Box, in front of the one above
 * it, with its name over a ruled line, the cook and time, and the photo at the side.
 */
export const RecipeRow: React.FC<RecipeRowProps> = ({
  recipe,
  shown,
  isFlipTarget = false,
  enterIndex,
  draft = false,
  remixed = false,
  remixCount = 0,
  onSelect,
  t,
}) => {
  const photo = recipePhoto(shown);
  return (
    <button
      type="button"
      className={`vault-row vault-item${isFlipTarget ? ' is-flip-target' : ''}${draft ? ' is-draft' : ''}`}
      data-vault-item={vaultItemKey(recipe.id)}
      style={
        enterIndex === undefined ? undefined : ({ '--enter-i': enterIndex } as React.CSSProperties)
      }
      // Named like a card: by the recipe alone.
      aria-label={draft ? t.draftNamed(shown.name) : shown.name}
      onClick={(e) => onSelect(recipe.id, e.currentTarget)}
    >
      <span className="vault-row-text">
        {/* The mark follows the name, or sits beside it when the name wraps. */}
        <span className="vault-row-title">
          <span className="vault-row-name" data-vault-name="">
            {shown.name}
          </span>
          {remixed && <RemixMark />}
        </span>
        <span className="vault-card-rule" aria-hidden="true" />
        <span className="vault-row-meta">
          {draft && (
            <span className="vault-draft-ribbon is-inline" aria-hidden="true">
              {t.draftRibbon}
            </span>
          )}
          <span className="vault-row-cook">{shown.author}</span>
          <span className="vault-row-time">
            <Timer className="time-icon" size="1.05em" strokeWidth={2.1} aria-hidden="true" />
            {t.totalTime(recipeTime(shown).minutes)}
          </span>
          {remixCount > 0 && <RemixBadge count={remixCount} />}
        </span>
      </span>
      <span className="vault-row-photo" data-vault-photo="">
        {photo ? (
          // The card flipping open must be whole in the snapshot the flip is made of.
          <img src={photo} alt="" loading={isFlipTarget ? 'eager' : 'lazy'} />
        ) : photoPending(recipe) ? (
          <span className="photo-pending" />
        ) : (
          <CategoryTile recipe={recipe} />
        )}
      </span>
    </button>
  );
};
