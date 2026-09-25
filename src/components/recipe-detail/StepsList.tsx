import React from 'react';
import { Step } from '../../types/recipe';
import { capitalizeFirstLetter } from '../../utils/timeEstimator';
import { UiTranslations } from '../../i18n/translations';

interface StepsListProps {
  steps: Step[];
  laminationDirective?: string;
  onZoomImage: (src: string) => void;
  t: UiTranslations;
}

export const StepsList: React.FC<StepsListProps> = ({
  steps,
  laminationDirective,
  onZoomImage,
  t,
}) => {
  const laminationSentences = laminationDirective
    ? laminationDirective
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => capitalizeFirstLetter(s))
    : [];

  return (
    <>
      {/* Steps Section */}
      <section>
        <h2 className="section-heading">{t.prepSteps}</h2>
        <div id="stepsContainer" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {steps.map((step, idx) => (
            <div key={idx} className="step-card">
              <div className="step-num">
                {step.num !== undefined ? step.num : idx + 1}
              </div>
              <div className="step-content">
                <p className="step-text">{capitalizeFirstLetter(step.text)}</p>

                {step.notes && (
                  <div className="step-note-pill">
                    <span className="step-note-icon" aria-hidden="true">
                      💡
                    </span>
                    <span>{capitalizeFirstLetter(step.notes)}</span>
                  </div>
                )}

                {step.hasImage && step.imageSrc && (
                  <div
                    className="step-visual-frame clickable-zoom"
                    title="Click to view and zoom photo"
                    role="button"
                    tabIndex={0}
                    onClick={() => onZoomImage(step.imageSrc!)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onZoomImage(step.imageSrc!);
                    }}
                  >
                    <img
                      className="step-visual-img"
                      src={step.imageSrc}
                      alt={step.imageCaption || 'Step consistency visual'}
                      loading="lazy"
                    />
                    <div className="zoom-badge-hint" aria-hidden="true" title="Zoom">
                      🔍
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

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
