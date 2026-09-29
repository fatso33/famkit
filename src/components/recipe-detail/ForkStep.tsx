import React from 'react';
import { Step, StepFork } from '../../types/recipe';
import { capitalizeFirstLetter } from '../../utils/timeEstimator';
import { pathSteps } from '../../utils/recipeMethod';
import { UiTranslations } from '../../i18n/translations';
import { ForkLines } from '../common/ForkLines';
import { ForkSwitch } from '../common/ForkSwitch';
import { NumberRoll } from '../common/NumberRoll';
import { PanelSwap } from '../common/PanelSwap';

interface ForkStepProps {
  step: Step & { fork: StepFork };
  number: number;
  /** The path the cook is on. */
  path: number;
  onChoose: (path: number) => void;
  /** A step follows in the same section, so the paths join back into it. */
  join: boolean;
  /** The step's tip and photo. */
  children?: React.ReactNode;
  t: UiTranslations;
}

/**
 * A step done one of two or three ways. The method's line splits into the switch; under it the
 * chosen path's text and its own steps slide in as ordinary numbered steps, and the steps after
 * it renumber to follow.
 */
export const ForkStep: React.FC<ForkStepProps> = ({
  step,
  number,
  path,
  onChoose,
  join,
  children,
  t,
}) => {
  const { paths } = step.fork;
  const chosen = paths[path] ?? paths[0];
  const own = pathSteps(step.fork, path);

  return (
    <ForkLines
      className="fork-step"
      paths={paths.length}
      active={path}
      join={join}
      head={
        <ForkSwitch
          labels={paths.map((p, i) => p.label.trim() || t.pathLetter(i))}
          active={path}
          onChange={onChoose}
          label={t.chooseOne}
        />
      }
    >
      <PanelSwap index={path} className="fork-step-stage" stagger>
        <div key={path} className="fork-step-path" aria-live="polite">
          <div className="step-card">
            <div className="step-num">
              <NumberRoll value={number} />
            </div>
            <div className="step-content">
              <p className="step-text">{capitalizeFirstLetter(chosen.text)}</p>
              {children}
            </div>
          </div>
          {own.map((text, k) => (
            <div key={k} className="step-card">
              <div className="step-num">
                <NumberRoll value={number + 1 + k} />
              </div>
              <div className="step-content">
                <p className="step-text">{capitalizeFirstLetter(text)}</p>
              </div>
            </div>
          ))}
        </div>
      </PanelSwap>
    </ForkLines>
  );
};
