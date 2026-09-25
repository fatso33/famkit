import React, { useState } from 'react';
import { UiTranslations } from '../../i18n/translations';

export interface IngredientRowState {
  id: string;
  name: string;
  amount: string;
}

interface IngredientBuilderProps {
  rows: IngredientRowState[];
  onChange: (rows: IngredientRowState[]) => void;
  t: UiTranslations;
}

export const IngredientBuilder: React.FC<IngredientBuilderProps> = ({
  rows,
  onChange,
  t,
}) => {
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const handleUpdate = (id: string, field: 'name' | 'amount', value: string) => {
    onChange(
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = () => {
    const newRow: IngredientRowState = {
      id: 'ing-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: '',
      amount: '',
    };
    onChange([...rows, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      // Keep at least one empty row
      onChange([{ id: 'ing-' + Date.now(), name: '', amount: '' }]);
      return;
    }
    onChange(rows.filter((row) => row.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newRows = [...rows];
    const temp = newRows[index - 1];
    newRows[index - 1] = newRows[index];
    newRows[index] = temp;
    onChange(newRows);
  };

  const handleMoveDown = (index: number) => {
    if (index === rows.length - 1) return;
    const newRows = [...rows];
    const temp = newRows[index + 1];
    newRows[index + 1] = newRows[index];
    newRows[index] = temp;
    onChange(newRows);
  };

  const handleApplyBulkPaste = () => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setShowBulkPaste(false);
      return;
    }

    const parsedRows: IngredientRowState[] = lines.map((line, idx) => {
      let name = line;
      let amount = '';
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        name = parts[0].trim();
        amount = parts.slice(1).join(' - ').trim();
      } else if (line.includes(':')) {
        const parts = line.split(':');
        name = parts[0].trim();
        amount = parts.slice(1).join(':').trim();
      }

      return {
        id: 'ing-' + Date.now() + '-' + idx,
        name,
        amount,
      };
    });

    onChange(parsedRows);
    setBulkText('');
    setShowBulkPaste(false);
  };

  return (
    <div className="form-group">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.45rem',
        }}
      >
        <label className="form-label" style={{ margin: 0 }}>
          {t.ingredients} *
        </label>
        <button
          type="button"
          className="btn"
          style={{
            padding: '0.2rem 0.6rem',
            fontSize: '0.78rem',
            minHeight: '26px',
            borderRadius: 'var(--radius-sm)',
          }}
          onClick={() => setShowBulkPaste((prev) => !prev)}
        >
          📋 {showBulkPaste ? t.cancel : t.quickPaste}
        </button>
      </div>

      {showBulkPaste && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            marginBottom: '0.85rem',
          }}
        >
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.35rem',
            }}
          >
            {t.quickPasteTitle}
          </div>
          <textarea
            className="form-control"
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Flour - 450g&#10;Yeast - 2 teaspoons&#10;Salt - 1.5 teaspoons&#10;Water - 1.5 cups"
            style={{ marginBottom: '0.5rem' }}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem' }}
            onClick={handleApplyBulkPaste}
          >
            {t.quickPasteApply}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, index) => (
          <div key={row.id} className="ingredient-row">
            <input
              type="text"
              className="form-control"
              placeholder={t.ingredientPlaceholder}
              value={row.name}
              onChange={(e) => handleUpdate(row.id, 'name', e.target.value)}
              required={index === 0 && !row.amount}
            />
            <input
              type="text"
              className="form-control"
              placeholder={t.amountPlaceholder}
              value={row.amount}
              onChange={(e) => handleUpdate(row.id, 'amount', e.target.value)}
            />
            <button
              type="button"
              className="btn-row-action"
              title="Move up"
              disabled={index === 0}
              onClick={() => handleMoveUp(index)}
              aria-label="Move ingredient up"
            >
              ▲
            </button>
            <button
              type="button"
              className="btn-row-action"
              title="Move down"
              disabled={index === rows.length - 1}
              onClick={() => handleMoveDown(index)}
              aria-label="Move ingredient down"
            >
              ▼
            </button>
            <button
              type="button"
              className="btn-row-action danger"
              title={t.removeIngredient}
              onClick={() => handleRemoveRow(row.id)}
              aria-label={t.removeIngredient}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn-add-step"
        style={{ marginTop: '0.45rem', padding: '0.6rem' }}
        onClick={handleAddRow}
      >
        {t.addIngredient}
      </button>
    </div>
  );
};
