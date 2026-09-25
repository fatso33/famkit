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
    <aside className="ingredients-panel">
      <div className="panel-header">
        <h2 className="panel-title">{t.ingredients}</h2>
        <PortionScaler
          scale={scale}
          onIncrease={onIncreaseScale}
          onDecrease={onDecreaseScale}
        />
      </div>

      {/* Verbatim Yield Header */}
      <span className="yield-text" id="yieldHeaderDisplay">
        {yieldDisplay}
      </span>

      {/* Modern 2-Column Ingredients Table */}
      <div className="ingredient-table-wrapper">
        <table
          className="ingredient-table"
          id="ingredientTable"
          role="table"
          aria-label="Recipe Ingredients"
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="th-ingredient"
                id="thIngredientHeader"
              >
                {t.thIngredient}
              </th>
              <th scope="col" className="th-amount" id="thAmountHeader">
                {t.thAmount}
              </th>
            </tr>
          </thead>
          <tbody id="ingredientTableBody">
            {ingredients.map((ing, idx) => {
              const row = parseIngredientRow(ing, scale, language);
              return (
                <tr key={idx} className="ingredient-row">
                  <td className="td-ingredient">
                    <div className="ingredient-name-col">
                      <span className="ingredient-name">{row.name}</span>
                      {row.notes.length > 0 && (
                        <span className="ingredient-bracket-note">
                          ({row.notes.join(', ')})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="td-amount">
                    <span className="ingredient-amount-col">{row.amount}</span>
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
