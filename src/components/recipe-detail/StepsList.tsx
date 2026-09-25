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
    <div className="flex flex-col gap-6">
      {/* Steps Container */}
      <section>
        <h2 className="font-serif font-bold text-2xl mb-4">{t.prepSteps}</h2>
        <div className="flex flex-col gap-3.5">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border flex gap-3.5 items-start shadow-sm transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div
                className="w-6 h-6 rounded-full font-bold text-xs grid place-items-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                }}
              >
                {step.num !== undefined ? step.num : idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {capitalizeFirstLetter(step.text)}
                </p>

                {step.hasImage && step.imageSrc && (
                  <div
                    onClick={() => onZoomImage(step.imageSrc!)}
                    className="mt-3 rounded-lg overflow-hidden border cursor-zoom-in relative group transition-transform hover:scale-[1.01]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-card)',
                    }}
                    title="Click to view and zoom photo"
                  >
                    <img
                      src={step.imageSrc}
                      alt={step.imageCaption || 'Step visual'}
                      className="w-full max-h-72 object-cover block"
                      loading="lazy"
                    />
                    <div
                      className="absolute bottom-2 right-2 w-7 h-7 rounded-full border border-white/30 text-white grid place-items-center text-xs backdrop-blur-md shadow-md"
                      style={{ backgroundColor: 'rgba(19, 18, 17, 0.78)' }}
                    >
                      🔍
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lamination Directive */}
      {laminationSentences.length > 0 && (
        <section
          className="p-4 rounded-xl border-l-4 shadow-sm"
          style={{
            borderColor: 'var(--accent)',
            backgroundColor: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
            borderRight: '1px solid var(--border-subtle)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div className="callout-label">{t.laminationDirective}</div>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 text-sm mt-2 leading-relaxed">
            {laminationSentences.map((sentence, idx) => (
              <li key={idx} style={{ color: 'var(--text-primary)' }}>
                {sentence}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
