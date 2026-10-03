import React, { useRef, useState } from 'react';
import { Camera, Check, Layers, PencilLine, Plus, Trash2 } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import {
  SectionState,
  StepState,
  editorNumbers,
  emptySection,
  emptyStep,
  moveStep,
  photoStep,
  removeSection,
  removeStep,
  updateStep,
} from '../../utils/recipeForm';
import { collapseAway, useListMotion } from '../../hooks/useListMotion';
import { moveToPlaceOf } from '../../hooks/dragToReorder';
import type { ToastAction } from '../../hooks/useToast';
import { StepEditor } from './StepEditor';

interface MethodEditorProps {
  sections: SectionState[];
  /** Given the sections as they are when it runs, so edits made meanwhile aren't lost. */
  onChange: (change: (sections: SectionState[]) => SectionState[]) => void;
  numberFrom: number;
  /** The step whose tools are open. */
  activeId: string | null;
  /** Steps that differ in a restored earlier version, by their place in it. */
  restoredSteps?: ReadonlySet<number>;
  error?: string;
  onToast: (message: string, action?: ToastAction) => void;
  t: UiTranslations;
}

/**
 * The method: sections of steps, numbered on across sections. A step can become unnumbered text,
 * gain substeps, a tip and a photo, or fork into two or three paths.
 */
export const MethodEditor: React.FC<MethodEditorProps> = ({
  sections,
  onChange,
  numberFrom,
  activeId,
  restoredSteps,
  error,
  onToast,
  t,
}) => {
  const root = useRef<HTMLDivElement>(null);
  const motion = useListMotion(root);
  const numbers = editorNumbers(sections, numberFrom);
  const allSteps = sections.flatMap((section) => section.steps);
  const [renaming, setRenaming] = useState<string | null>(null);

  const focusStep = (id: string) =>
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>(`[data-motion-id="${id}"] textarea`)?.focus(),
    );

  const addStep = (sectionId: string, photo = false) => {
    const step = photo ? photoStep() : emptyStep();
    motion.willAdd(step.id);
    onChange((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, steps: [...section.steps, step] } : section,
      ),
    );
    if (photo) focusPhoto(step.id);
    else focusStep(step.id);
  };

  // A new photo's own keys (take or choose) take the focus.
  const focusPhoto = (id: string) =>
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(`[data-motion-id="${id}"] .image-picker-actions button`)
        ?.focus(),
    );

  // Renaming swaps the heading for a field, ready to type over.
  const startRenaming = (id: string) => {
    setRenaming(id);
    requestAnimationFrame(() => {
      const field = root.current?.querySelector<HTMLInputElement>(
        `[data-motion-id="${id}"] .method-section-input`,
      );
      field?.focus();
      field?.select();
    });
  };

  const addSection = () => {
    const section = emptySection();
    motion.willAdd(section.id);
    onChange((current) => [...current, section]);
    startRenaming(section.id);
  };

  const remove = (stepId: string, el: HTMLElement | null, photo = false) => {
    void collapseAway(el).then(() => {
      let undo: ((current: SectionState[]) => SectionState[]) | null = null;
      onChange((current) => {
        const result = removeStep(current, stepId);
        undo = result.undo;
        return result.sections;
      });
      onToast(photo ? t.photoRemoved : t.stepRemoved, {
        label: t.undo,
        onAction: () => {
          motion.willAdd(stepId);
          onChange((current) => (undo ? undo(current) : current));
        },
      });
    });
  };

  const removeWholeSection = (sectionId: string, el: HTMLElement | null) => {
    void collapseAway(el).then(() => {
      let undo: ((current: SectionState[]) => SectionState[]) | null = null;
      onChange((current) => {
        const result = removeSection(current, sectionId);
        undo = result.undo;
        return result.sections;
      });
      onToast(t.sectionRemoved, {
        label: t.undo,
        onAction: () => {
          motion.willAdd(sectionId);
          onChange((current) => (undo ? undo(current) : current));
        },
      });
    });
  };

  return (
    <div ref={root} className="method-editor">
      {sections.map((section, s) => {
        const heading = section.title || (s === 0 ? t.prepSteps : t.moreSteps);
        const isRenaming = renaming === section.id;
        return (
          <section
            key={section.id}
            className="method-section"
            data-motion-id={section.id}
            aria-label={heading}
          >
            <header className="method-section-head">
              {isRenaming ? (
                <input
                  className="form-control method-section-input"
                  type="text"
                  aria-label={t.sectionName}
                  autoComplete="off"
                  value={section.title}
                  onChange={(e) =>
                    onChange((current) =>
                      current.map((sec) =>
                        sec.id === section.id ? { ...sec, title: e.target.value } : sec,
                      ),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      setRenaming(null);
                    }
                  }}
                  onBlur={(e) => {
                    // Tapping the tick blurs first; let it finish the rename itself.
                    if (!e.relatedTarget?.closest('.method-section-head')) setRenaming(null);
                  }}
                />
              ) : (
                <h3 className="section-heading method-section-title">{heading}</h3>
              )}
              <button
                type="button"
                className="icon-button"
                aria-label={isRenaming ? t.done : t.renameSection}
                onClick={() => (isRenaming ? setRenaming(null) : startRenaming(section.id))}
              >
                {isRenaming ? (
                  <Check size="1.2rem" aria-hidden="true" />
                ) : (
                  <PencilLine size="1.15rem" aria-hidden="true" />
                )}
              </button>
              {s > 0 && (
                <button
                  type="button"
                  className="icon-button method-section-remove"
                  aria-label={t.removeSection}
                  onClick={(e) =>
                    removeWholeSection(section.id, e.currentTarget.closest('section'))
                  }
                >
                  <Trash2 size="1.1rem" aria-hidden="true" />
                </button>
              )}
            </header>

            {/* A later section's numbers carry on from the one before, or start again. */}
            {s > 0 && (
              <fieldset className="method-numbering">
                <legend className="form-label is-small">{t.stepNumbering}</legend>
                <div className="choice-pill" data-value={section.restart ? 'other' : 'first'}>
                  <span className="choice-pill-thumb" aria-hidden="true" />
                  {[false, true].map((restart) => (
                    <label
                      key={String(restart)}
                      className={section.restart === restart ? 'is-active' : ''}
                    >
                      <input
                        type="radio"
                        name={`${section.id}-numbering`}
                        checked={section.restart === restart}
                        onChange={() =>
                          onChange((current) =>
                            current.map((sec) =>
                              sec.id === section.id ? { ...sec, restart } : sec,
                            ),
                          )
                        }
                      />
                      {restart ? t.numberingRestart(numberFrom) : t.numberingCarryOn}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <ol className="method-steps">
              {section.steps.map((step, k) => {
                const flat = allSteps.indexOf(step);
                return (
                  <StepEditor
                    key={step.id}
                    step={step}
                    number={numbers.get(step.id) ?? null}
                    pathStart={(p) => numbers.get(`${step.id}:${p}`) ?? 1}
                    join={k < section.steps.length - 1}
                    active={step.id === activeId}
                    restored={step.origin !== undefined && Boolean(restoredSteps?.has(step.origin))}
                    canMoveUp={flat > 0}
                    canMoveDown={flat < allSteps.length - 1}
                    onChange={(change: (step: StepState) => StepState) =>
                      onChange((current) => updateStep(current, step.id, change))
                    }
                    onMove={(dir) => {
                      motion.beforeMove();
                      onChange((current) => moveStep(current, step.id, dir));
                    }}
                    onDrop={(id, targetId) =>
                      onChange((current) =>
                        current.map((sec) =>
                          sec.id === section.id
                            ? { ...sec, steps: moveToPlaceOf(sec.steps, id, targetId) }
                            : sec,
                        ),
                      )
                    }
                    onRemove={(el) => remove(step.id, el, step.photo)}
                    onToast={onToast}
                    t={t}
                  />
                );
              })}
            </ol>
            <div className="method-add-row">
              <button type="button" className="method-add-step" onClick={() => addStep(section.id)}>
                <Plus size="1.2em" aria-hidden="true" />
                {t.addStep}
              </button>
              <button
                type="button"
                className="method-add-step is-photo"
                aria-label={t.addMethodPhoto}
                onClick={() => addStep(section.id, true)}
              >
                <Camera size="1.15em" aria-hidden="true" />
                {t.photo}
              </button>
            </div>
          </section>
        );
      })}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="method-add-section" onClick={addSection}>
        <span className="method-add-section-title">
          <Layers size="1.25em" aria-hidden="true" />
          {t.addSection}
        </span>
        <span className="method-add-section-hint">{t.addSectionHint}</span>
      </button>
    </div>
  );
};
