import React, { useId, useState } from 'react';
import { ChevronDown, Languages, Trash2 } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { isAppCheckEnabled } from '../../services/firebase';
import { Language, Recipe } from '../../types/recipe';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { timeAgo } from '../../utils/recipeTrash';
import { Season, SeasonPreference } from '../../utils/season';
import { SeasonIcon, SeasonPicker } from './SeasonPicker';

interface SettingsViewProps {
  /** The viewer's own deleted recipes, most recent first. */
  deletedRecipes: Recipe[];
  language: Language;
  onRestore: (id: string) => void;
  seasonPreference: SeasonPreference;
  /** The season the app shows now. */
  season: Season;
  calendarSeason: Season;
  onSeasonChange: (preference: SeasonPreference, origin: { x: number; y: number }) => void;
  t: UiTranslations;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  deletedRecipes,
  language,
  onRestore,
  seasonPreference,
  season,
  calendarSeason,
  onSeasonChange,
  t,
}) => {
  const [isTrashOpen, setTrashOpen] = useState(false);
  const trashListId = useId();
  // Read once per opening of the page; "3 days ago" needn't tick while it's open.
  const [now] = useState(Date.now);

  return (
    <section id="viewSettings">
      <div className="vault-hero">
        <h1 className="font-serif">{t.settings}</h1>
      </div>

      <div className="settings-card">
        <h2 className="settings-card-title">
          <span className="settings-card-icon" aria-hidden="true">
            <SeasonIcon season={season} size="1.1em" strokeWidth={1.9} />
          </span>
          {t.seasonSection}
        </h2>
        <p className="settings-body">{t.seasonInfo}</p>
        <SeasonPicker
          preference={seasonPreference}
          calendarSeason={calendarSeason}
          onChange={onSeasonChange}
          t={t}
        />
      </div>

      <div className="settings-card">
        <h2 className="settings-card-title">
          <span className="settings-card-icon" aria-hidden="true">
            <Languages size="1.1em" strokeWidth={1.9} />
          </span>
          {t.translationSection}
        </h2>
        <p className="settings-body">{t.translationInfo}</p>
        <p className="settings-note">{t.translationOfflineNote}</p>
        {isAppCheckEnabled && (
          <p className="settings-note">
            {t.recaptchaNoticeStart}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              {t.privacyPolicy}
            </a>
            {t.recaptchaNoticeAnd}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
              {t.termsOfService}
            </a>
            {t.recaptchaNoticeEnd}
          </p>
        )}
      </div>

      <div className="settings-card">
        <h2 className="settings-card-title">
          <span className="settings-card-icon" aria-hidden="true">
            <Trash2 size="1.1em" strokeWidth={1.9} />
          </span>
          {t.deletedRecipes}
        </h2>
        <p className="settings-body">{t.deletedRecipesInfo}</p>

        <button
          type="button"
          className="trash-toggle"
          aria-expanded={isTrashOpen}
          aria-controls={trashListId}
          onClick={() => setTrashOpen((open) => !open)}
        >
          <span>{t.deletedRecipes}</span>
          <span className="trash-count">{deletedRecipes.length}</span>
          <ChevronDown className="trash-chevron" size="1.1em" aria-hidden="true" />
        </button>

        <div id={trashListId} className={`trash-panel${isTrashOpen ? ' is-open' : ''}`}>
          <div className="trash-panel-inner" inert={!isTrashOpen}>
            {deletedRecipes.length === 0 ? (
              <p className="settings-note">{t.noDeletedRecipes}</p>
            ) : (
              <ul className="trash-list" aria-label={t.deletedRecipes}>
                {deletedRecipes.map((raw) => {
                  const recipe = getLocalizedRecipe(raw, language) ?? raw;
                  return (
                    <li key={raw.id} className="trash-item">
                      {recipe.heroImage ? (
                        <img className="trash-thumb" src={recipe.heroImage} alt="" />
                      ) : (
                        <span className="trash-thumb" aria-hidden="true" />
                      )}
                      <span className="trash-text">
                        <span className="trash-name">{recipe.name}</span>
                        <span className="trash-when">
                          {t.deletedAgo(timeAgo(raw.deletedAt ?? now, now, language))}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-meta-pill"
                        aria-label={t.restoreRecipeLabel(recipe.name)}
                        onClick={() => onRestore(raw.id)}
                      >
                        {t.restoreRecipe}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
