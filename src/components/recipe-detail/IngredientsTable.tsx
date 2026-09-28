import React from 'react';
import { Ingredient, Language } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { formatFraction, parseIngredientRow } from '../../utils/fractions';
import { ingredientGroups } from '../../utils/recipeMethod';
import { ArrowLeftRight } from 'lucide-react';
import { PortionScaler } from './PortionScaler';

interface IngredientsTableProps {
  ingredients: Ingredient[];
  scale: number;
  onIncreaseScale: () => void;
  onDecreaseScale: () => void;
  /** Empty: the recipe gives no yield, so none is shown. Missing on some older records. */
  yieldHeader?: string;
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
  // The recipe's own yield stays as written; a scaled recipe says how many times it is made.
  const yieldText = yieldHeader ?? t.for1Loaf;
  const scaled = scale !== 1;

  return (
    <aside className="ingredients-panel">
      <div className="panel-header">
        <h2 className="panel-title">{t.ingredients}</h2>
        <PortionScaler
          scale={scale}
          onIncrease={onIncreaseScale}
          onDecrease={onDecreaseScale}
          t={t}
        />
      </div>

      {/* Verbatim Yield Header */}
      {(yieldText || scaled) && (
        <span className="yield-text" id="yieldHeaderDisplay">
          {yieldText}
          {scaled && <span className="yield-scale">×{formatFraction(scale)}</span>}
        </span>
      )}

      {/* Modern 2-Column Ingredients Table */}
      <div className="ingredient-table-wrapper">
        <table
          className="ingredient-table"
          id="ingredientTable"
          role="table"
          aria-label={t.ingredientsTableLabel}
        >
          <thead>
            <tr>
              <th scope="col" className="th-ingredient" id="thIngredientHeader">
                {t.thIngredient}
              </th>
              <th scope="col" className="th-amount" id="thAmountHeader">
                {t.thAmount}
              </th>
            </tr>
          </thead>
          {ingredientGroups(ingredients).map((group, g) => (
            // Each heading starts its own group of rows (Ingredient.section).
            <tbody key={g} id={g === 0 ? 'ingredientTableBody' : undefined}>
              {group.heading && (
                <tr className="ingredient-group-row">
                  <th scope="rowgroup" colSpan={2} className="ingredient-group-heading">
                    {group.heading}
                  </th>
                </tr>
              )}
              {group.rows.map(({ ing, idx }) => {
                const row = parseIngredientRow(ing, scale, language);
                return (
                  <tr key={idx}>
                    <td className="td-ingredient">
                      <div className="ingredient-name-col">
                        <span className="ingredient-name">{row.name}</span>
                        {row.notes.length > 0 && (
                          <span className="ingredient-bracket-note">({row.notes.join(', ')})</span>
                        )}
                        {row.substitute && (
                          <span className="ingredient-substitute">
                            <ArrowLeftRight size={14} aria-hidden="true" />
                            <span>
                              {t.orSubstitute(row.substitute.name)}
                              {row.substitute.amount && ` · ${row.substitute.amount}`}
                            </span>
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
          ))}
        </table>
      </div>
    </aside>
  );
};
