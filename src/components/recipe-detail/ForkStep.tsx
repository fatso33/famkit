import React, { useEffect, useRef, useState } from 'react';
import { Step, StepFork } from '../../types/recipe';
import { capitalizeFirstLetter } from '../../utils/timeEstimator';
import { pathSteps } from '../../utils/recipeMethod';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { UiTranslations } from '../../i18n/translations';
import { ForkLines } from '../common/ForkLines';
import { ForkSwitch } from '../common/ForkSwitch';
import { NumberRoll } from '../common/NumberRoll';
import { PanelSwap } from '../common/PanelSwap';

/**
 * How long after a tap the choice is made: the path being left fades away meanwhile, and the new
 * one arrives as the switch floods (index.css, .fork-step).
 */
const LEAVE_MS = 320;

interface ForkStepProps {
  step: Step & { fork: StepFork };
  number: number;
  /** The path the cook is on. */
  path: number;
  onChoose: (path: number) => void;
  /** A step follows in the same section, so the paths join back into it. */
  join: boolean;
  /** The chosen path's tip and photo. */
  children?: React.ReactNode;
  t: UiTranslations;
}

/**
 * A step done one of two or three ways. The method's line splits into the switch; under it the
 * chosen path's text and its own steps slide in as ordinary numbered steps, and the steps after
 * it renumber to follow.
 *
 * Choosing a path plays in order: the switch floods and the branch draws down to it at once,
 * while the path being left fades away towards the side it's leaving. Only then is the choice
 * made: the new path's steps arrive one after another as the card eases to their height, the
 * steps below glide and renumber, and last the branch under the path lights.
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
  // The path just tapped, while the one being left fades away.
  const [tapped, setTapped] = useState<number | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lit = tapped ?? path;
  const leaving = tapped !== null && tapped !== path;

  const choose = (next: number) => {
    window.clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setTapped(null);
      onChoose(next);
      return;
    }
    setTapped(next);
    timer.current = window.setTimeout(() => {
      setTapped(null);
      onChoose(next);
    }, LEAVE_MS);
  };

  return (
    <ForkLines
      className="fork-step"
      paths={paths.length}
      active={lit}
      join={join}
      head={
        <ForkSwitch
          labels={paths.map((p, i) => p.label.trim() || t.pathLetter(i))}
          active={lit}
          onChange={choose}
          label={t.chooseOne}
        />
      }
    >
      <PanelSwap
        index={path}
        className={`fork-step-stage${leaving ? ' is-leaving' : ''}`}
        style={{ '--leave-x': lit > path ? '-1' : '1' } as React.CSSProperties}
        stagger
      >
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
