import React, { useRef } from 'react';
import { Merge, Plus, Trash2, X } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import {
  MAX_PATHS,
  PathState,
  StepState,
  addPath,
  removePath,
  textItem,
  updatePath,
} from '../../utils/recipeForm';
import { ForkLines } from '../common/ForkLines';
import { ForkSwitch } from '../common/ForkSwitch';
import { PanelSwap } from '../common/PanelSwap';
import { Reveal } from '../common/Reveal';
import { NumberRoll } from '../common/NumberRoll';
import { AutoGrowTextarea } from '../common/AutoGrowTextarea';

interface ForkEditorProps {
  /** A step with a fork. */
  step: StepState;
  /** The number a path's first own step gets. */
  pathStart: (path: number) => number;
  /** A step follows in the same section, so the paths join back into it. */
  join: boolean;
  /** The step's number, its × and its move keys. */
  rail: React.ReactNode;
  /** The open path's tip and photo fields, which swap in with it. */
  extras: React.ReactNode;
  /** The step's tool strip. */
  tools: React.ReactNode;
  onChange: (change: (step: StepState) => StepState) => void;
  t: UiTranslations;
}

/**
 * A step done one of two or three ways, laid out as on the recipe page: the method's line splits
 * into the switch (and, while there's room, a dashed branch to the add-path key), and the card
 * under it holds the chosen path: its name, what to do, then either the first path's steps or
 * its own, numbered in the same column as every other step.
 */
export const ForkEditor: React.FC<ForkEditorProps> = ({
  step,
  pathStart,
  join,
  rail,
  extras,
  tools,
  onChange,
  t,
}) => {
  const card = useRef<HTMLDivElement>(null);
  const fork = step.fork!;
  const active = fork.active;
  const path = fork.paths[active];
  const followsFirst = active > 0 && path.sameAsFirst;
  const start = pathStart(active);
  const canAdd = fork.paths.length < MAX_PATHS;

  const edit = (change: Partial<PathState>) =>
    onChange((s) => updatePath(s, active, (p) => ({ ...p, ...change })));

  const focusLast = () =>
    requestAnimationFrame(() => {
      const fields = card.current?.querySelectorAll<HTMLTextAreaElement>(
        '.fork-path-step textarea',
      );
      fields?.[fields.length - 1]?.focus();
    });

  return (
    <ForkLines
      className="fork-editor"
      paths={fork.paths.length}
      active={active}
      join={join}
      withAdd={canAdd}
      head={
        <>
          <ForkSwitch
            labels={fork.paths.map((p, i) => p.label.trim() || t.pathLetter(i))}
            active={active}
            onChange={(i) =>
              onChange((s) => (s.fork ? { ...s, fork: { ...s.fork, active: i } } : s))
            }
            label={t.pathsAtStep}
          />
          {canAdd && (
            <button
              type="button"
              className="fork-add-path"
              aria-label={t.addPath}
              onClick={() => onChange(addPath)}
            >
              <Plus size="1.3rem" aria-hidden="true" />
            </button>
          )}
        </>
      }
    >
      <div ref={card} className="fork-card">
        {rail}

        <div className="step-editor-body">
          <PanelSwap index={active} className="fork-stage">
            <div key={path.id} className="fork-path">
              <label className="form-label is-small" htmlFor={`${path.id}-label`}>
                {t.pathName}
              </label>
              <input
                id={`${path.id}-label`}
                className="form-control"
                type="text"
                autoComplete="off"
                value={path.label}
                onChange={(e) => edit({ label: e.target.value })}
              />

              <label className="form-label is-small" htmlFor={`${path.id}-text`}>
                {t.pathText}
              </label>
              <AutoGrowTextarea
                id={`${path.id}-text`}
                value={path.text}
                onChange={(e) => edit({ text: e.target.value })}
              />

              {active > 0 && (
                <fieldset className="fork-path-then">
                  <legend className="form-label is-small">{t.pathThen}</legend>
                  <div className="choice-pill" data-value={path.sameAsFirst ? 'first' : 'own'}>
                    <span className="choice-pill-thumb" aria-hidden="true" />
                    {[true, false].map((same) => (
                      <label
                        key={String(same)}
                        className={path.sameAsFirst === same ? 'is-active' : ''}
                      >
                        <input
                          type="radio"
                          name={`${path.id}-then`}
                          checked={path.sameAsFirst === same}
                          onChange={() => edit({ sameAsFirst: same })}
                        />
                        {same ? t.sameStepsAsFirst : t.ownSteps}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {extras}
            </div>
          </PanelSwap>
        </div>

        <PanelSwap index={active} className="fork-steps-stage">
          <div key={path.id} className="fork-path-more">
            <Reveal open={!followsFirst}>
              {path.steps.length > 0 && (
                <ol className="fork-path-steps">
                  {path.steps.map((item, k) => (
                    <li key={item.id} className="fork-path-step">
                      <span className="step-num" aria-hidden="true">
                        <NumberRoll value={start + k} />
                      </span>
                      <AutoGrowTextarea
                        aria-label={t.pathStepLabel(start + k)}
                        value={item.text}
                        onChange={(e) =>
                          edit({
                            steps: path.steps.map((s) =>
                              s.id === item.id ? { ...s, text: e.target.value } : s,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="icon-button is-small"
                        aria-label={t.removePathStep}
                        onClick={() => edit({ steps: path.steps.filter((s) => s.id !== item.id) })}
                      >
                        <X size="1.1rem" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <button
                type="button"
                className="fork-add-step"
                onClick={() => {
                  edit({ steps: [...path.steps, textItem()] });
                  focusLast();
                }}
              >
                <Plus size="1.1em" aria-hidden="true" />
                {t.addPathStep}
              </button>
            </Reveal>

            <p className="fork-path-foot">
              <Merge size="1.1em" aria-hidden="true" />
              {followsFirst ? t.pathFollowsFirst : t.pathCarriesOn}
            </p>

            {active > 0 && fork.paths.length === MAX_PATHS && (
              <button
                type="button"
                className="fork-remove-path"
                onClick={() => onChange((s) => removePath(s, active))}
              >
                <Trash2 size="1.05em" aria-hidden="true" />
                {t.removePath}
              </button>
            )}
          </div>
        </PanelSwap>

        {tools}
      </div>
    </ForkLines>
  );
};
