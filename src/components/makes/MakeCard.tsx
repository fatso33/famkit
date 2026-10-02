import React, { useState } from 'react';
import { ChevronRight, Heart, Languages, PencilLine } from 'lucide-react';
import { Language } from '../../types/recipe';
import { Make } from '../../types/make';
import { UiTranslations } from '../../i18n/translations';
import { RecipeCardIcon } from '../common/RecipeBoxIcon';
import { heartCount, madeOnLabel, makerName } from '../../utils/makes';
import { vaultItemKey } from '../../utils/viewTransition';

interface MakeCardProps {
  /** In the viewer's language. */
  make: Make;
  /** The name of the recipe it was made from, in the viewer's language; null when that's gone. */
  recipeName: string | null;
  language: Language;
  /** Whether this person has given it a heart. */
  hearted: boolean;
  /** Its author, who may edit it (and sees its hearts, but doesn't heart their own). */
  own: boolean;
  /** Its photo is the one growing into, or shrinking out of, the full-screen viewer. */
  zoomSource: boolean;
  /** Some of its words are still waiting for their translation. */
  translating: boolean;
  /** Plays its arrival: just shared, or come to from a recipe's makes. */
  arrival?: 'new' | 'visit';
  /** Its place in the page's entrance, when the page is arriving. */
  enterIndex?: number;
  /** Load its photo at once (it's on screen as the page opens). */
  eager: boolean;
  onOpenRecipe: (name: HTMLElement) => void;
  onZoom: () => void;
  onHeart: (on: boolean) => void;
  onEdit: (from: HTMLElement) => void;
  t: UiTranslations;
}

/**
 * A make on the Makes page: its photo, large, then its title, who made it and when, and its
 * note; along the bottom, the recipe it was made from (a link that takes you to its card in the
 * Recipe Box), and its hearts.
 */
export const MakeCard: React.FC<MakeCardProps> = ({
  make,
  recipeName,
  language,
  hearted,
  own,
  zoomSource,
  translating,
  arrival,
  enterIndex,
  eager,
  onOpenRecipe,
  onZoom,
  onHeart,
  onEdit,
  t,
}) => {
  const title = make.title || recipeName || '';
  const hearts = heartCount(make);
  // The heart pops only when it's given here, not when a card arrives already hearted.
  const [popped, setPopped] = useState(0);

  return (
    <article
      className={`make-card${arrival ? ` is-arriving-${arrival}` : ''}`}
      id={`make-${make.id}`}
      // Glides to its new place when the page is filtered or sorted (utils/viewTransition).
      data-vault-item={vaultItemKey(make.id)}
      style={
        enterIndex === undefined ? undefined : ({ '--enter-i': enterIndex } as React.CSSProperties)
      }
    >
      <button
        type="button"
        className={`make-photo${zoomSource ? ' is-zoom-source' : ''}`}
        aria-label={t.viewMakePhoto(title)}
        onClick={onZoom}
      >
        {make.photo ? (
          <img
            className="make-photo-img"
            src={make.photo}
            alt=""
            decoding="async"
            loading={eager ? 'eager' : 'lazy'}
          />
        ) : (
          <span className="photo-pending" />
        )}
      </button>

      <div className="make-body">
        <h2 className="make-title">{title}</h2>
        <p className="make-byline">
          <span className="make-maker">{makerName(make)}</span>
          <span className="make-date">{madeOnLabel(make, language, t)}</span>
        </p>
        {make.note && <p className="make-note">{make.note}</p>}
        {translating && (
          <p className="make-translating">
            <Languages size="1em" aria-hidden="true" />
            {t.translationOnItsWay}
          </p>
        )}

        {/* The recipe it was made from, then the maker's Edit and the hearts. */}
        <div className="make-meta">
          {recipeName !== null ? (
            <button
              type="button"
              className="make-recipe"
              aria-label={t.openRecipeNamed(recipeName)}
              onClick={(e) => {
                const name = e.currentTarget.querySelector<HTMLElement>('.make-recipe-name');
                onOpenRecipe(name ?? e.currentTarget);
              }}
            >
              <span className="make-recipe-pill">
                <RecipeCardIcon className="make-recipe-icon" size="1.25em" />
                <span className="make-recipe-name">{recipeName}</span>
                <ChevronRight
                  className="make-recipe-chevron"
                  size="1em"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              </span>
            </button>
          ) : (
            <span className="make-recipe is-gone">
              <span className="make-recipe-pill">
                <RecipeCardIcon className="make-recipe-icon" size="1.25em" />
                <span className="make-recipe-name">{t.recipeGone}</span>
              </span>
            </span>
          )}
          {/* Its author sees its hearts (they can't heart their own), with Edit after them. */}
          <span className="make-actions">
            {own ? (
              hearts > 0 && (
                <span className="make-heart is-static">
                  <Heart className="make-heart-icon" size="1.2em" aria-hidden="true" />
                  <span aria-hidden="true">{hearts}</span>
                  <span className="sr-only">{t.heartCount(hearts)}</span>
                </span>
              )
            ) : (
              <>
                <button
                  type="button"
                  className="make-heart make-action"
                  aria-pressed={hearted}
                  aria-label={t.giveHeart}
                  onClick={() => {
                    if (!hearted) setPopped((n) => n + 1);
                    onHeart(!hearted);
                  }}
                >
                  {/* Keyed by each heart given, so its pop plays again. */}
                  <Heart
                    key={popped}
                    className={`make-heart-icon${popped > 0 && hearted ? ' is-popping' : ''}`}
                    size="1.2em"
                    aria-hidden="true"
                  />
                  {hearts > 0 && <span aria-hidden="true">{hearts}</span>}
                </button>
                {hearts > 0 && <span className="sr-only">{t.heartCount(hearts)}</span>}
              </>
            )}
            {own && (
              <button
                type="button"
                className="make-action"
                aria-label={t.editMakeNamed(title)}
                onClick={(e) => onEdit(e.currentTarget)}
              >
                <PencilLine size="1.15em" strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </span>
        </div>
      </div>
    </article>
  );
};
