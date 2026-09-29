import React, { useState } from 'react';
import { Camera, ChevronDown, ChevronUp, Hash, Lightbulb, Trash2, X } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import {
  ExtrasState,
  MAX_SUBSTEPS,
  StepState,
  textItem,
  toggleFork,
  updatePath,
} from '../../utils/recipeForm';
import { SUBSTEP_LETTERS } from '../../utils/recipeMethod';
import type { ToastAction } from '../../hooks/useToast';
import { AutoGrowTextarea } from '../common/AutoGrowTextarea';
import { ForkIcon } from '../common/ForkIcon';
import { NumberRoll } from '../common/NumberRoll';
import { Reveal } from '../common/Reveal';
import { ForkEditor } from './ForkEditor';
import { ImagePickerWithPreview } from './ImagePickerWithPreview';

interface StepEditorProps {
  step: StepState;
  /** Null for unnumbered text. */
  number: number | null;
  /** The number a fork path's first own step gets. */
  pathStart: (path: number) => number;
  /** A step follows in the same section, so a fork joins back into it. */
  join: boolean;
  /** Whether its tools are open. */
  active: boolean;
  /** It differs in the restored earlier version. */
  restored: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (change: (step: StepState) => StepState) => void;
  onMove: (dir: -1 | 1) => void;
  /** Removes it, given its element to fold away first. */
  onRemove: (el: HTMLElement | null) => void;
  onToast: (message: string, action?: ToastAction) => void;
  t: UiTranslations;
}

/**
 * One step, laid out like the recipe page's: its number a tab on the tile's top-left corner and
 * what to do across the tile. Tapped, it shows its tools: move keys springing out of the number,
 * a small × on the number to make it unnumbered text, and a strip for substeps, a tip, a photo,
 * a fork or removing it.
 */
export const StepEditor: React.FC<StepEditorProps> = ({
  step,
  number,
  pathStart,
  join,
  active,
  restored,
  canMoveUp,
  canMoveDown,
  onChange,
  onMove,
  onRemove,
  onToast,
  t,
}) => {
  const n = number ?? 0;
  const { plain, fork } = step;
  // The tip and photo being edited: the step's, or on a fork the open path's.
  const extras: ExtrasState & { id: string } = fork ? fork.paths[fork.active] : step;
  // Photo pickers opened while still empty, by step or path.
  const [photoOpen, setPhotoOpen] = useState<ReadonlySet<string>>(new Set());
  const hasPhoto = Boolean(extras.imageSrc);
  const showPhoto = hasPhoto || photoOpen.has(extras.id);
  const substepsFull = step.substeps.length >= MAX_SUBSTEPS;
  const toolsName = plain ? t.textTools : t.stepTools(n);

  const patch = (change: Partial<StepState>) => onChange((s) => ({ ...s, ...change }));
  // Found by id when it runs, so an Undo still lands on its path after others moved or went.
  const patchExtras = (change: Partial<ExtrasState>, id = extras.id) =>
    onChange((s) => {
      if (s.id === id) return { ...s, ...change };
      const at = s.fork?.paths.findIndex((p) => p.id === id) ?? -1;
      return at === -1 ? s : updatePath(s, at, (p) => ({ ...p, ...change }));
    });
  const setPhotoPicker = (id: string, open: boolean) =>
    setPhotoOpen((ids) => {
      const next = new Set(ids);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  const togglePhoto = () => {
    if (!hasPhoto) {
      setPhotoPicker(extras.id, !showPhoto);
      return;
    }
    const { id, imageSrc, imageCaption } = extras;
    patchExtras({ imageSrc: '', imageCaption: '' });
    setPhotoPicker(id, false);
    onToast(t.photoRemoved, {
      label: t.undo,
      onAction: () => patchExtras({ imageSrc, imageCaption }, id),
    });
  };

  // Joining a fork keeps the open path's text and lets the others go, so it can be undone.
  const toggleForking = () => {
    const before = step;
    onChange(toggleFork);
    if (before.fork) {
      onToast(t.forkRemoved, { label: t.undo, onAction: () => onChange(() => before) });
    }
  };

  const rail = (
    <div className="step-editor-rail">
      <div className="step-editor-number">
        {plain ? (
          <button
            type="button"
            className="step-number-add"
            aria-label={t.numberThisStep}
            onClick={() => patch({ plain: false })}
          >
            <Hash size="1rem" aria-hidden="true" />
          </button>
        ) : (
          <>
            <span className="step-num" aria-hidden="true">
              <NumberRoll value={n} />
            </span>
            <button
              type="button"
              className="step-number-remove"
              aria-label={t.removeStepNumber}
              tabIndex={active ? 0 : -1}
              aria-hidden={!active || undefined}
              onClick={() => patch({ plain: true })}
            >
              <X size="0.8rem" strokeWidth={2.6} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {/* While the step is tapped, its move keys spring out of the number along the top edge. */}
      <div className={`step-move-pill${active ? ' is-open' : ''}`} inert={!active}>
        <button
          type="button"
          className="step-move-button"
          aria-label={t.moveStepUp(n)}
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
        >
          <ChevronUp size="1.2rem" strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="step-move-button"
          aria-label={t.moveStepDown(n)}
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
        >
          <ChevronDown size="1.2rem" strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const extrasFields = (
    <>
      {extras.showTip && (
        <div className="step-tip-field field-with-icon">
          <Lightbulb className="field-icon is-gold" size="1.1em" aria-hidden="true" />
          <AutoGrowTextarea
            aria-label={plain ? t.tip : t.stepTipLabel(n)}
            value={extras.tip}
            onChange={(e) => patchExtras({ tip: e.target.value })}
          />
        </div>
      )}

      {showPhoto && (
        <div className="step-photo-field">
          <ImagePickerWithPreview
            imageUrl={extras.imageSrc}
            onChange={(url) => patchExtras({ imageSrc: url })}
            t={t}
          />
          {hasPhoto && (
            <input
              className="form-control step-photo-caption"
              type="text"
              aria-label={t.photoCaptionLabel}
              autoComplete="off"
              value={extras.imageCaption}
              onChange={(e) => patchExtras({ imageCaption: e.target.value })}
            />
          )}
        </div>
      )}
    </>
  );

  const tools = (
    <Reveal open={active} className="item-tools step-editor-tools">
      <div className="tool-strip" role="group" aria-label={toolsName}>
        {!plain && !fork && (
          <button
            type="button"
            className="tool-strip-button"
            aria-disabled={substepsFull || undefined}
            onClick={(e) => {
              const button = e.currentTarget;
              if (substepsFull) {
                button.animate?.(
                  [
                    { transform: 'none' },
                    { transform: 'translateX(-3px)' },
                    { transform: 'translateX(3px)' },
                    { transform: 'none' },
                  ],
                  { duration: 260 },
                );
                return;
              }
              patch({ substeps: [...step.substeps, textItem()] });
              requestAnimationFrame(() => {
                const rows = button
                  .closest('.step-editor')
                  ?.querySelectorAll<HTMLTextAreaElement>('.substep-row textarea');
                rows?.[rows.length - 1]?.focus();
              });
            }}
          >
            <span className="tool-strip-letter" aria-hidden="true">
              a)
            </span>
            <span>{substepsFull ? t.substepsFull : t.substep}</span>
          </button>
        )}
        <button
          type="button"
          className="tool-strip-button"
          aria-pressed={extras.showTip}
          onClick={() => patchExtras({ showTip: !extras.showTip })}
        >
          <Lightbulb size="1.25rem" aria-hidden="true" />
          <span>{t.tip}</span>
        </button>
        <button
          type="button"
          className="tool-strip-button"
          aria-pressed={showPhoto}
          onClick={togglePhoto}
        >
          <Camera size="1.25rem" aria-hidden="true" />
          <span>{t.photo}</span>
        </button>
        {!plain && (
          <button
            type="button"
            className="tool-strip-button"
            aria-pressed={Boolean(fork)}
            onClick={toggleForking}
          >
            <ForkIcon paths={2} />
            <span>{t.fork}</span>
          </button>
        )}
        <button
          type="button"
          className="tool-strip-button is-danger"
          aria-label={t.removeStep}
          onClick={(e) => onRemove(e.currentTarget.closest('li'))}
        >
          <Trash2 size="1.25rem" aria-hidden="true" />
          <span aria-hidden="true">{t.remove}</span>
        </button>
      </div>
    </Reveal>
  );

  return (
    <li
      data-motion-id={step.id}
      data-item-id={step.id}
      className={`step-editor${plain ? ' is-plain' : ''}${fork ? ' is-fork' : ''}${active ? ' is-active' : ''}${restored ? ' is-restored' : ''}${fork && join ? ' has-join' : ''}`}
    >
      {restored && <span className="restored-chip">{t.restoredChip}</span>}

      {fork ? (
        <ForkEditor
          step={step}
          pathStart={pathStart}
          join={join}
          rail={rail}
          extras={extrasFields}
          tools={tools}
          onChange={onChange}
          t={t}
        />
      ) : (
        <>
          {rail}
          <div className="step-editor-body">
            {plain && (
              <span className="step-plain-tag" aria-hidden="true">
                {t.textBetweenSteps}
              </span>
            )}
            <AutoGrowTextarea
              className="step-editor-text"
              aria-label={plain ? t.textBetweenSteps : t.stepInstructionLabel(n)}
              value={step.text}
              onChange={(e) => patch({ text: e.target.value })}
            />

            {!plain && step.substeps.length > 0 && (
              <ol className="substep-list">
                {step.substeps.map((sub, k) => (
                  <li key={sub.id} className="substep-row">
                    <span className="substep-letter" aria-hidden="true">
                      {SUBSTEP_LETTERS[k]})
                    </span>
                    <AutoGrowTextarea
                      aria-label={t.substepLabel(SUBSTEP_LETTERS[k])}
                      value={sub.text}
                      onChange={(e) =>
                        patch({
                          substeps: step.substeps.map((s) =>
                            s.id === sub.id ? { ...s, text: e.target.value } : s,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="icon-button is-small"
                      aria-label={t.removeSubstep}
                      onClick={() =>
                        patch({ substeps: step.substeps.filter((s) => s.id !== sub.id) })
                      }
                    >
                      <X size="1.1rem" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {extrasFields}
          </div>
          {tools}
        </>
      )}
    </li>
  );
};
