import React from 'react';
import { Step, StepFork } from '../../types/recipe';
import { capitalizeFirstLetter } from '../../utils/timeEstimator';
import { pathSteps } from '../../utils/recipeMethod';
import { UiTranslations } from '../../i18n/translations';
import { ForkSwitch } from '../common/ForkSwitch';
import { NumberRoll } from '../common/NumberRoll';
import { PanelSwap } from '../common/PanelSwap';

interface ForkStepProps {
  step: Step & { fork: StepFork };
  number: number;
  /** The path the cook is on. */
  path: number;
  onChoose: (path: number) => void;
  /** The step's tip and photo. */
  children?: React.ReactNode;
  t: UiTranslations;
}

/**
 * A step done one of two or three ways. The switch picks the path; its text and its own steps
 * slide in, numbered on from this step, and the steps after it renumber to follow.
 */
export const ForkStep: React.FC<ForkStepProps> = ({
  step,
  number,
  path,
  onChoose,
  children,
  t,
}) => {
  const { paths } = step.fork;
  const chosen = paths[path] ?? paths[0];
  const own = pathSteps(step.fork, path);

  return (
    <div className="step-card fork-step">
      <div className="step-num">
        <NumberRoll value={number} />
      </div>
      <div className="step-content">
        <ForkSwitch
          className="is-large"
          labels={paths.map((p, i) => p.label.trim() || t.pathLetter(i))}
          active={path}
          onChange={onChoose}
          label={t.chooseOne}
        />
        <PanelSwap index={path} className="fork-step-stage">
          <div key={path} className="fork-step-path" aria-live="polite">
            <p className="step-text">{capitalizeFirstLetter(chosen.text)}</p>
            {own.length > 0 && (
              <ol className="fork-step-list">
                {own.map((text, k) => (
                  <li key={k} className="fork-step-item">
                    <span className="step-num is-small">
                      <NumberRoll value={number + 1 + k} />
                    </span>
                    <p className="step-text">{capitalizeFirstLetter(text)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </PanelSwap>
        {children}
      </div>
    </div>
  );
};
