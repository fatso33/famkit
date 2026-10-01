import React, { useId } from 'react';
import { Timer } from 'lucide-react';
import { Recipe } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { recipeTime } from '../../utils/timeEstimator';
import { vaultItemKey } from '../../utils/viewTransition';
import { recipePhoto } from '../../utils/vault';
import { creditName } from '../../utils/ownership';
import { photoPending } from '../../utils/deviceCopy';
import { CategoryTile } from './CategoryTile';
import { MakeBadge, RemixBadge, RemixMark } from './RemixMarks';

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
  /** How many makes family members have shared of it. */
  makeCount?: number;
  /** A word at the start of the cook-and-time row (My Counter's New or Updated), and its look. */
  tag?: { text: string; className: string };
  /** Not opened yet by this person: a dot after the name, named by this. */
  unseenLabel?: string;
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
  makeCount = 0,
  tag,
  unseenLabel,
  onSelect,
  t,
}) => {
  const photo = recipePhoto(shown);
  // Named by the recipe alone, as in the box; the tag and the dot describe it.
  const noteId = useId();
  const note = !!tag || !!unseenLabel;
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
      aria-describedby={note ? noteId : undefined}
      onClick={(e) => onSelect(recipe.id, e.currentTarget)}
    >
      <span className="vault-row-text">
        {/* The mark follows the name, or sits beside it when the name wraps. */}
        <span className="vault-row-title">
          <span className="vault-row-name" data-vault-name="">
            {shown.name}
          </span>
          {remixed && <RemixMark />}
          {unseenLabel && <span className="vault-unseen" title={unseenLabel} />}
        </span>
        <span className="vault-card-rule" aria-hidden="true" />
        <span className="vault-row-meta">
          {note && (
            <span id={noteId} className="sr-only">
              {tag?.text}
              {tag && unseenLabel && ', '}
              {unseenLabel && <span>{unseenLabel}</span>}
            </span>
          )}
          {tag && (
            <span className={tag.className} aria-hidden="true">
              {tag.text}
            </span>
          )}
          {draft && (
            <span className="vault-draft-ribbon is-inline" aria-hidden="true">
              {t.draftRibbon}
            </span>
          )}
          <span className="vault-row-cook">{creditName(shown)}</span>
          <span className="vault-row-time">
            <Timer className="time-icon" size="1.05em" strokeWidth={2.1} aria-hidden="true" />
            {t.totalTime(recipeTime(shown).minutes)}
          </span>
          {(remixCount > 0 || makeCount > 0) && (
            <span className="vault-badges">
              {remixCount > 0 && <RemixBadge count={remixCount} />}
              {makeCount > 0 && <MakeBadge count={makeCount} />}
            </span>
          )}
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
