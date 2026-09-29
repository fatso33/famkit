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

/**
 * The ingredients as a two-column table, drawn so a long note can use the whole row: each
 * amount is shown floated at the right of its row (index.css, .ingredient-amount-float), with
 * the name held in its column beside it and the note flowing on under the amount once past it.
 * The table's own amount cells are kept for screen readers and hidden on screen. The rows are
 * laid out as blocks, so the table, its rows and headers state their roles.
 */
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
    <aside className="ingredients-panel" data-subheader={t.ingredients}>
      <div className="panel-header">
        <h2 className="panel-title" data-subheader-title="">
          {t.ingredients}
        </h2>
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

      <div className="ingredient-table-wrapper">
        <table
          className="ingredient-table"
          id="ingredientTable"
          role="table"
          aria-label={t.ingredientsTableLabel}
        >
          <thead>
            <tr role="row">
              <th scope="col" role="columnheader" className="th-ingredient" id="thIngredientHeader">
                {t.thIngredient}
              </th>
              <th scope="col" role="columnheader" className="th-amount" id="thAmountHeader">
                {t.thAmount}
              </th>
            </tr>
          </thead>
          {ingredientGroups(ingredients).map((group, g) => (
            // Each heading starts its own group of rows (Ingredient.section), hung from it on a line.
            <tbody
              key={g}
              id={g === 0 ? 'ingredientTableBody' : undefined}
              className={group.heading ? 'ingredient-group' : undefined}
              data-subheader-group={group.heading || undefined}
            >
              {group.heading && (
                <tr role="row" className="ingredient-group-row">
                  <th
                    scope="rowgroup"
                    role="rowheader"
                    colSpan={2}
                    className="ingredient-group-heading"
                  >
                    {group.heading}
                    <span className="ingredient-group-count" aria-hidden="true">
                      {group.rows.length}
                    </span>
                    <span className="sr-only">, {t.ingredientsCount(group.rows.length)}</span>
                  </th>
                </tr>
              )}
              {group.rows.map(({ ing, idx }) => {
                const row = parseIngredientRow(ing, scale, language);
                return (
                  <tr key={idx} role="row">
                    <td className="td-ingredient">
                      {/* First, so the name and note flow beside it (screen readers use the
                          amount cell). With no amount, the name has the whole row. */}
                      {row.amount && (
                        <span className="ingredient-amount-float" aria-hidden="true">
                          {row.amount}
                        </span>
                      )}
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
