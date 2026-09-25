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
    <section className="mt-8">
      <h2 className="font-serif font-bold text-2xl mb-4">{t.bakingOptions}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {opt1Items.length > 0 && (
          <div
            className="p-5 rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="text-xs uppercase font-bold tracking-wider mb-2" style={{ color: 'var(--accent)' }}>
              {t.option1Tag}
            </div>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {opt1Items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {opt2Items.length > 0 && (
          <div
            className="p-5 rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="text-xs uppercase font-bold tracking-wider mb-2" style={{ color: 'var(--accent)' }}>
              {t.option2Tag}
            </div>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
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
