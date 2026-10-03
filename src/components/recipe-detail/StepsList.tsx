import React from 'react';
import { Step, StepFork } from '../../types/recipe';
import { capitalizeFirstLetter } from '../../utils/timeEstimator';
import {
  PathChoices,
  SUBSTEP_LETTERS,
  chosenPath,
  firstStepNumber,
  isMethodPhoto,
  methodSections,
  numberSteps,
  pathExtras,
} from '../../utils/recipeMethod';
import { UiTranslations } from '../../i18n/translations';
import { NumberRoll } from '../common/NumberRoll';
import { ForkStep } from './ForkStep';
import { StepExtras } from './StepExtras';

interface StepsListProps {
  steps: Step[];
  /** The path each fork is on. */
  choices: PathChoices;
  onChoosePath: (step: number, path: number) => void;
  laminationDirective?: string;
  /** The step whose photo is (or was last) full screen, to morph from and back into. */
  zoomSource?: number;
  onZoomImage: (src: string, step: number) => void;
  t: UiTranslations;
}

/**
 * The method, section by section. Numbers run on across sections and skip unnumbered text;
 * after a fork they follow the path the cook is on.
 */
export const StepsList: React.FC<StepsListProps> = ({
  steps,
  choices,
  onChoosePath,
  laminationDirective,
  zoomSource,
  onZoomImage,
  t,
}) => {
  const numbers = numberSteps(steps, firstStepNumber(steps), choices);
  const laminationSentences = laminationDirective
    ? laminationDirective
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => capitalizeFirstLetter(s))
    : [];

  return (
    <>
      {methodSections(steps).map((section, s) => {
        const heading = section.title || (s === 0 ? t.prepSteps : t.moreSteps);
        return (
          <section key={section.start} data-subheader={heading}>
            <h2 className="section-heading" data-subheader-title="">
              {heading}
            </h2>
            <div className="steps-stack">
              {section.steps.map((step, k) => {
                const idx = section.start + k;
                const forked = step.fork && step.fork.paths.length >= 2;
                const path = forked ? chosenPath(step.fork!, choices[idx]) : 0;
                const extras = (
                  <StepExtras
                    // A fork shows the chosen path's own tip and photo.
                    key={path}
                    step={forked ? pathExtras(step, path) : step}
                    index={idx}
                    isZoomSource={idx === zoomSource}
                    onZoomImage={onZoomImage}
                    t={t}
                  />
                );
                // A photo on its own between the steps: no tile, its caption under it.
                if (isMethodPhoto(step)) {
                  return (
                    <figure key={idx} className="method-photo">
                      <StepExtras
                        step={step}
                        index={idx}
                        isZoomSource={idx === zoomSource}
                        onZoomImage={onZoomImage}
                        photoAlt={t.methodPhotoAlt}
                        t={t}
                      />
                      {step.imageCaption?.trim() && (
                        <figcaption className="method-photo-caption">
                          {capitalizeFirstLetter(step.imageCaption.trim())}
                        </figcaption>
                      )}
                    </figure>
                  );
                }
                // Unnumbered text: a tile like the steps', its text where the number would be.
                if (step.plain) {
                  // A photo between the steps whose photo isn't on this phone: nothing to show.
                  if (typeof step.text !== 'string' || !step.text.trim()) return null;
                  return (
                    <div key={idx} className="step-card is-plain">
                      <div className="step-content">
                        <p className="step-text">{capitalizeFirstLetter(step.text)}</p>
                        {extras}
                      </div>
                    </div>
                  );
                }
                const number = numbers[idx] ?? 0;
                if (forked) {
                  return (
                    <ForkStep
                      key={idx}
                      step={step as Step & { fork: StepFork }}
                      number={number}
                      path={path}
                      onChoose={(path) => onChoosePath(idx, path)}
                      join={k < section.steps.length - 1}
                      t={t}
                    >
                      {extras}
                    </ForkStep>
                  );
                }
                return (
                  <div key={idx} className="step-card">
                    <div className="step-num">
                      <NumberRoll value={number} />
                    </div>
                    <div className="step-content">
                      <p className="step-text">{capitalizeFirstLetter(step.text)}</p>
                      {step.substeps && step.substeps.length > 0 && (
                        <ol className="substeps">
                          {step.substeps.map((sub, j) => (
                            <li key={j}>
                              <span className="substep-letter" aria-hidden="true">
                                {SUBSTEP_LETTERS[j]})
                              </span>
                              <span>{capitalizeFirstLetter(sub)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {extras}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Lamination Directive: bullet points */}
      {laminationSentences.length > 0 && (
        <section
          id="laminationCard"
          className="callout-box"
          style={{
            borderLeftColor: 'var(--accent)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderLeft: '4px solid var(--accent)',
          }}
        >
          <div className="callout-label">{t.laminationDirective}</div>
          <ul className="directive-bullet-list" id="laminationList">
            {laminationSentences.map((sentence, idx) => (
              <li key={idx}>{sentence}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};
