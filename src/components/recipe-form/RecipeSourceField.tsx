import React from 'react';
import { BookOpen, Globe } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { sourceAddress, sourceHost } from '../../utils/recipeForm';

interface RecipeSourceFieldProps {
  value: string;
  onChange: (value: string) => void;
  t: UiTranslations;
}

/**
 * Where a recipe is from, in one field: a link ("smittenkitchen.com/…") or words ("Aunt Ola's
 * notebook"). Under it, how the recipe's foot will show it: a link to the site, or the words as
 * typed. That line keeps its height while empty, so typing the first letter moves nothing.
 */
export const RecipeSourceField: React.FC<RecipeSourceFieldProps> = ({ value, onChange, t }) => {
  const typed = value.trim();
  const host = typed ? sourceHost(sourceAddress(typed)) : '';
  return (
    <>
      <div className="form-label-row">
        <label className="form-label" htmlFor="recipeSourceInput">
          {t.sourceLabel}
        </label>
        <span className="form-optional" aria-hidden="true">
          {t.optional}
        </span>
      </div>
      <input
        className="form-control"
        type="text"
        id="recipeSourceInput"
        maxLength={2000}
        autoComplete="off"
        aria-describedby="recipeSourceReading"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id="recipeSourceReading" className="source-reading">
        {typed &&
          (host ? (
            <>
              <Globe size="1em" strokeWidth={2} aria-hidden="true" />
              <span>{t.sourceAsLink(host)}</span>
            </>
          ) : (
            <>
              <BookOpen size="1em" strokeWidth={2} aria-hidden="true" />
              <span>{t.sourceAsWords}</span>
            </>
          ))}
      </p>
    </>
  );
};
