import React from 'react';
import { Ingredient, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { parseIngredientRow } from '../../utils/fractions';
import { PortionScaler } from './PortionScaler';

interface IngredientsTableProps {
  ingredients: Ingredient[];
  scale: number;
  onIncreaseScale: () => void;
  onDecreaseScale: () => void;
  yieldHeader: string;
  language: Language;
  t: UiTranslations;
}

export const IngredientsTable: React.FC<IngredientsTableProps> = ({
  ingredients,
  scale,
  onIncreaseScale,
  onDecreaseScale,
  yieldHeader,
  language,
  t,
}) => {
  const yieldDisplay =
    scale === 1 ? yieldHeader || t.for1Loaf : t.forNLoaves(scale);

  return (
    <aside
      className="p-6 rounded-2xl border shadow-sm flex flex-col"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div
        className="flex justify-between items-baseline pb-3 mb-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h2 className="font-serif font-bold text-xl">{t.ingredients}</h2>
        <PortionScaler
          scale={scale}
          onIncrease={onIncreaseScale}
          onDecrease={onDecreaseScale}
        />
      </div>

      {/* Yield Text */}
      <span
        className="text-xs font-semibold mb-4 block"
        style={{ color: 'var(--accent)' }}
      >
        {yieldDisplay}
      </span>

      {/* Table */}
      <div
        className="w-full overflow-x-auto rounded-xl border"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <table className="w-full border-collapse text-sm leading-relaxed" role="table">
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <th
                scope="col"
                className="py-3 px-4 text-left text-xs uppercase font-bold tracking-wider w-[58%]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t.thIngredient}
              </th>
              <th
                scope="col"
                className="py-3 px-4 text-left text-xs uppercase font-bold tracking-wider w-[42%]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t.thAmount}
              </th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing, idx) => {
              const row = parseIngredientRow(ing, scale, language);
              return (
                <tr
                  key={idx}
                  className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b last:border-b-0"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className="py-3 px-4 align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {row.name}
                      </span>
                      {row.notes.length > 0 && (
                        <span
                          className="text-xs italic font-medium"
                          style={{ color: 'var(--accent)' }}
                        >
                          ({row.notes.join(', ')})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top font-semibold text-sm">
                    <span style={{ color: 'var(--text-primary)' }}>
                      {row.amount}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </aside>
  );
};
