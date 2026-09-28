import React, { useRef } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Heading,
  NotebookPen,
  Plus,
  Trash2,
} from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { IngredientRowState, emptyRow, headingRow } from '../../utils/recipeForm';
import { collapseAway, useListMotion } from '../../hooks/useListMotion';
import { Reveal } from '../common/Reveal';
import { AutoGrowTextarea } from '../common/AutoGrowTextarea';
import type { ToastAction } from '../../hooks/useToast';

interface IngredientEditorProps {
  rows: IngredientRowState[];
  /** Given the rows as they are when it runs, so edits made meanwhile aren't lost. */
  onChange: (change: (rows: IngredientRowState[]) => IngredientRowState[]) => void;
  yieldHeader: string;
  onYieldChange: (value: string) => void;
  /** The row whose tools are open. */
  activeId: string | null;
  /** Rows that differ in a restored earlier version, by their place in it. */
  restoredRows?: ReadonlySet<number>;
  restoredYield?: boolean;
  error?: string;
  onToast: (message: string, action?: ToastAction) => void;
  t: UiTranslations;
}

// A pasted line break would split one ingredient in two once saved.
const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ');

/**
 * The ingredients, laid out like the recipe page's table: each row's name and amount side by
 * side, with its note and swap under the name. Tapping a row opens its tools.
 */
export const IngredientEditor: React.FC<IngredientEditorProps> = ({
  rows,
  onChange,
  yieldHeader,
  onYieldChange,
  activeId,
  restoredRows,
  restoredYield,
  error,
  onToast,
  t,
}) => {
  const list = useRef<HTMLOListElement>(null);
  const motion = useListMotion(list);

  const update = (id: string, change: Partial<IngredientRowState>) =>
    onChange((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));

  const focusField = (id: string, field: string) =>
    requestAnimationFrame(() =>
      list.current
        ?.querySelector<HTMLElement>(`[data-motion-id="${id}"] [data-field="${field}"]`)
        ?.focus(),
    );

  const addRow = (after?: string, row = emptyRow()) => {
    motion.willAdd(row.id);
    onChange((current) => {
      const at = after ? current.findIndex((r) => r.id === after) + 1 : current.length;
      return [...current.slice(0, at), row, ...current.slice(at)];
    });
    focusField(row.id, 'name');
  };

  const move = (id: string, by: -1 | 1) => {
    motion.beforeMove();
    onChange((current) => {
      const from = current.findIndex((r) => r.id === id);
      const to = from + by;
      if (from === -1 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const remove = (id: string, el: HTMLElement | null, heading = false) => {
    void collapseAway(el).then(() => {
      let removed: { row: IngredientRowState; at: number } | null = null;
      onChange((current) => {
        const at = current.findIndex((r) => r.id === id);
        if (at === -1) return current;
        removed = { row: current[at], at };
        return current.filter((r) => r.id !== id);
      });
      onToast(heading ? t.ingredientHeadingRemoved : t.ingredientRemoved, {
        label: t.undo,
        onAction: () => {
          if (!removed) return;
          const { row, at } = removed;
          motion.willAdd(row.id);
          onChange((current) => [...current.slice(0, at), row, ...current.slice(at)]);
        },
      });
    });
  };

  // Ingredients are numbered for screen readers without counting the headings between them.
  const numbers = new Map<string, number>();
  for (const row of rows) if (!row.heading) numbers.set(row.id, numbers.size + 1);
  const ingredientCount = numbers.size;

  const moveTools = (row: IngredientRowState, index: number) => (
    <>
      <button
        type="button"
        className="tool-strip-button"
        aria-label={row.heading ? t.moveUp : t.moveIngredientUp}
        disabled={index === 0}
        onClick={() => move(row.id, -1)}
      >
        <ArrowUp size="1.25rem" aria-hidden="true" />
        <span aria-hidden="true">{t.moveUp}</span>
      </button>
      <button
        type="button"
        className="tool-strip-button"
        aria-label={row.heading ? t.moveDown : t.moveIngredientDown}
        disabled={index === rows.length - 1}
        onClick={() => move(row.id, 1)}
      >
        <ArrowDown size="1.25rem" aria-hidden="true" />
        <span aria-hidden="true">{t.moveDown}</span>
      </button>
    </>
  );

  return (
    <section className="editor-panel ingredient-editor" aria-labelledby="ingredientsHeading">
      <div className="editor-panel-head">
        <h3 className="panel-title" id="ingredientsHeading">
          {t.ingredients}
        </h3>
        <span className="editor-count">{t.ingredientsCount(ingredientCount)}</span>
      </div>

      <div className={`form-group${restoredYield ? ' is-restored' : ''}`}>
        {restoredYield && <span className="restored-chip">{t.restoredChip}</span>}
        <label className="form-label is-small" htmlFor="recipeYieldInput">
          {t.yieldHeader}
        </label>
        <input
          className="form-control yield-input"
          type="text"
          id="recipeYieldInput"
          autoComplete="off"
          value={yieldHeader}
          onChange={(e) => onYieldChange(e.target.value)}
        />
      </div>

      <div className="ingredient-table">
        <div className="ingredient-table-head" aria-hidden="true">
          <span>{t.thIngredient}</span>
          <span>{t.thAmount}</span>
        </div>
        <ol ref={list} className="ingredient-rows">
          {rows.map((row, index) => {
            const active = row.id === activeId;
            if (row.heading) {
              return (
                <li
                  key={row.id}
                  data-motion-id={row.id}
                  data-item-id={row.id}
                  className={`ingredient-row ingredient-heading-row${active ? ' is-active' : ''}`}
                >
                  <input
                    className="form-control ingredient-heading-input"
                    type="text"
                    data-field="name"
                    aria-label={t.ingredientHeadingLabel}
                    placeholder={t.ingredientHeadingPlaceholder}
                    autoComplete="off"
                    enterKeyHint="next"
                    value={row.name}
                    onChange={(e) => update(row.id, { name: e.target.value })}
                    onKeyDown={(e) => {
                      // Enter goes on to the first ingredient under the heading.
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      addRow(row.id);
                    }}
                  />
                  <Reveal open={active} className="item-tools">
                    <div className="tool-strip" role="group" aria-label={t.ingredientHeadingTools}>
                      {moveTools(row, index)}
                      <button
                        type="button"
                        className="tool-strip-button is-danger"
                        aria-label={t.removeIngredientHeading}
                        onClick={(e) => remove(row.id, e.currentTarget.closest('li'), true)}
                      >
                        <Trash2 size="1.25rem" aria-hidden="true" />
                        <span aria-hidden="true">{t.remove}</span>
                      </button>
                    </div>
                  </Reveal>
                </li>
              );
            }
            const n = numbers.get(row.id) ?? index + 1;
            const restored = row.origin !== undefined && restoredRows?.has(row.origin);
            return (
              <li
                key={row.id}
                data-motion-id={row.id}
                data-item-id={row.id}
                className={`ingredient-row${active ? ' is-active' : ''}${restored ? ' is-restored' : ''}`}
              >
                {restored && <span className="sr-only">{t.restoredChip}</span>}
                {/* Long names and amounts wrap onto more lines rather than being cut off. */}
                <div className="ingredient-row-main">
                  <AutoGrowTextarea
                    className="ingredient-name"
                    data-field="name"
                    aria-label={t.ingredientNameLabel(n)}
                    autoComplete="off"
                    enterKeyHint="next"
                    value={row.name}
                    onChange={(e) => update(row.id, { name: oneLine(e.target.value) })}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      focusField(row.id, 'amount');
                    }}
                  />
                  <AutoGrowTextarea
                    className="ingredient-amount"
                    data-field="amount"
                    aria-label={t.ingredientAmountLabel(n)}
                    autoComplete="off"
                    enterKeyHint="next"
                    value={row.amount}
                    onChange={(e) => update(row.id, { amount: oneLine(e.target.value) })}
                    onKeyDown={(e) => {
                      // Enter moves on to a fresh row, the quickest way down a list.
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      addRow(row.id);
                    }}
                  />
                </div>

                {row.showNote && (
                  <div className="ingredient-extra field-with-icon">
                    <NotebookPen className="field-icon" size="1.1em" aria-hidden="true" />
                    <input
                      className="form-control ingredient-note"
                      type="text"
                      data-field="note"
                      aria-label={t.ingredientNoteLabel(n)}
                      autoComplete="off"
                      value={row.note}
                      onChange={(e) => update(row.id, { note: e.target.value })}
                    />
                  </div>
                )}

                {row.showSubstitute && (
                  <div className="ingredient-extra ingredient-row-main">
                    <div className="field-with-icon">
                      <ArrowLeftRight
                        className="field-icon is-gold"
                        size="1.1em"
                        aria-hidden="true"
                      />
                      <input
                        className="form-control"
                        type="text"
                        data-field="substitute"
                        aria-label={t.substituteLabel(n)}
                        autoComplete="off"
                        value={row.substitute}
                        onChange={(e) => update(row.id, { substitute: e.target.value })}
                      />
                    </div>
                    <input
                      className="form-control"
                      type="text"
                      aria-label={t.substituteAmountLabel(n)}
                      autoComplete="off"
                      value={row.substituteAmount}
                      onChange={(e) => update(row.id, { substituteAmount: e.target.value })}
                    />
                  </div>
                )}

                <Reveal open={active} className="item-tools">
                  <div className="tool-strip" role="group" aria-label={t.ingredientTools(n)}>
                    {moveTools(row, index)}
                    <button
                      type="button"
                      className="tool-strip-button"
                      aria-pressed={row.showNote}
                      onClick={() => {
                        update(row.id, { showNote: !row.showNote });
                        if (!row.showNote) focusField(row.id, 'note');
                      }}
                    >
                      <NotebookPen size="1.25rem" aria-hidden="true" />
                      <span>{t.note}</span>
                    </button>
                    <button
                      type="button"
                      className="tool-strip-button"
                      aria-pressed={row.showSubstitute}
                      onClick={() => {
                        update(row.id, { showSubstitute: !row.showSubstitute });
                        if (!row.showSubstitute) focusField(row.id, 'substitute');
                      }}
                    >
                      <ArrowLeftRight size="1.25rem" aria-hidden="true" />
                      <span>{t.swap}</span>
                    </button>
                    <button
                      type="button"
                      className="tool-strip-button is-danger"
                      aria-label={t.removeIngredient}
                      onClick={(e) => remove(row.id, e.currentTarget.closest('li'))}
                    >
                      <Trash2 size="1.25rem" aria-hidden="true" />
                      <span aria-hidden="true">{t.remove}</span>
                    </button>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
        <div className="ingredient-add-bar">
          <button type="button" className="ingredient-add" onClick={() => addRow()}>
            <Plus size="1.2em" aria-hidden="true" />
            {t.addIngredient}
          </button>
          <button
            type="button"
            className="ingredient-add ingredient-add-heading"
            onClick={() => addRow(undefined, headingRow())}
          >
            <Heading size="1.1em" aria-hidden="true" />
            {t.addIngredientHeading}
          </button>
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
