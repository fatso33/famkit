import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Language, Recipe } from '../../types/recipe';
import { Make } from '../../types/make';
import { UiTranslations } from '../../i18n/translations';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { makerName, searchMakes, shownMakes } from '../../utils/makes';
import { localizeMake } from '../../utils/makeTranslation';

// Only the first tiles are dealt in one by one; the rest are below the deck's fold anyway.
const DEALT = 8;

interface MakesDeckProps {
  /** Every make, deleted ones included (they aren't shown). */
  makes: Make[];
  /** The Recipe Box's recipes, whose names stand in for a make without a title. */
  recipes: Recipe[];
  language: Language;
  /** Opens the make on the Makes page, given its photo (which grows into the make's card). */
  onOpenMake: (id: string, photo: HTMLElement) => void;
  t: UiTranslations;
}

/**
 * Makes as a card deck (NavDeck): the newest first, as photo tiles two to a row, with a search
 * by title, recipe or maker. A tile opens its make on the Makes page.
 */
export const MakesDeck: React.FC<MakesDeckProps> = ({
  makes,
  recipes,
  language,
  onOpenMake,
  t,
}) => {
  const [query, setQuery] = useState('');
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const entries = shownMakes(makes).map((raw) => {
    const recipe = recipesById.get(raw.recipeId);
    const recipeName = recipe ? (getLocalizedRecipe(recipe, language) ?? recipe).name : '';
    return { make: raw, title: localizeMake(raw, language).title || recipeName, recipeName };
  });
  const shown = searchMakes(entries, query);

  return (
    <>
      {entries.length > 0 && (
        <div className="nav-deck-tools">
          <div className="nav-deck-search">
            <label className="nav-deck-search-field">
              <Search size="1.2em" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                aria-label={t.searchMakes}
                placeholder={t.searchMakesHint}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Put the keyboard away to show the results.
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
            </label>
            {query && (
              <button
                type="button"
                className="nav-deck-search-clear"
                aria-label={t.clearSearch}
                onClick={() => setQuery('')}
              >
                <X size="1.2em" strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="nav-deck-list">
        {entries.length === 0 && <p className="vault-empty">{t.makesEmptyTitle}</p>}
        {entries.length > 0 && shown.length === 0 && (
          <p className="vault-empty">{t.noMakesMatch}</p>
        )}
        <ul className="nav-deck-tiles">
          {shown.map(({ make, title }, i) => (
            <li
              key={make.id}
              className={i < DEALT ? 'nav-deck-deal' : undefined}
              style={
                i < DEALT
                  ? ({ '--deal': i, '--tilt': i % 2 ? '2.5deg' : '-2.5deg' } as React.CSSProperties)
                  : undefined
              }
            >
              <button
                type="button"
                className="counter-tile nav-deck-tile"
                aria-label={t.openMakeNamed(title)}
                onClick={(e) =>
                  onOpenMake(
                    make.id,
                    e.currentTarget.querySelector<HTMLElement>('.counter-tile-photo') ??
                      e.currentTarget,
                  )
                }
              >
                <span className="counter-tile-photo">
                  {make.photo ? (
                    <img src={make.photo} alt="" />
                  ) : (
                    <span className="photo-pending" />
                  )}
                </span>
                <span className="counter-tile-title" aria-hidden="true">
                  {title}
                </span>
                <span className="counter-tile-maker" aria-hidden="true">
                  {makerName(make)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};
