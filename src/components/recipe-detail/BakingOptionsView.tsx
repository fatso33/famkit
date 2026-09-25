import React from 'react';
import { BakingOptions } from '../../types/recipe';
import { capitalizeFirstLetter } from '../../utils/timeEstimator';
import { UiTranslations } from '../../i18n/translations';

interface BakingOptionsViewProps {
  bakingOptions?: BakingOptions;
  t: UiTranslations;
}

export const BakingOptionsView: React.FC<BakingOptionsViewProps> = ({
  bakingOptions,
  t,
}) => {
  if (!bakingOptions) return null;

  const opt1Items = bakingOptions.option1
    ? (Array.isArray(bakingOptions.option1)
        ? bakingOptions.option1
        : bakingOptions.option1.split(/(?<=[.!?])\s+/)
      )
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => capitalizeFirstLetter(s))
    : [];

  const opt2Items = bakingOptions.option2
    ? (Array.isArray(bakingOptions.option2)
        ? bakingOptions.option2
        : [bakingOptions.option2]
      )
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => capitalizeFirstLetter(s))
    : [];

  if (opt1Items.length === 0 && opt2Items.length === 0) return null;

  return (
    <section id="bakingOptionsSection">
      <h2 className="section-heading">{t.bakingOptions}</h2>
      <div className="baking-options-grid">
        {opt1Items.length > 0 && (
          <div className="bake-option-card">
            <div className="bake-option-tag">{t.option1Tag}</div>
            <ul className="bake-option-list" id="bakeOptionList1">
              {opt1Items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {opt2Items.length > 0 && (
          <div className="bake-option-card">
            <div className="bake-option-tag">{t.option2Tag}</div>
            <ul className="bake-option-list" id="bakeOptionList2">
              {opt2Items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
