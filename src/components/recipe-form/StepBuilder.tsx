import React from 'react';
import { UiTranslations } from '../../i18n/translations';
import { ImagePickerWithPreview } from './ImagePickerWithPreview';

export interface StepBuilderItem {
  id: string;
  text: string;
  notes?: string;
  imageSrc?: string;
  imageCaption?: string;
}

interface StepBuilderProps {
  steps: StepBuilderItem[];
  onChange: (steps: StepBuilderItem[]) => void;
  t: UiTranslations;
}

export const StepBuilder: React.FC<StepBuilderProps> = ({
  steps,
  onChange,
  t,
}) => {
  const handleUpdate = (
    id: string,
    field: keyof StepBuilderItem,
    value: string | undefined
  ) => {
    onChange(
      steps.map((st) => (st.id === id ? { ...st, [field]: value } : st))
    );
  };

  const handleAddStep = () => {
    const nextStep: StepBuilderItem = {
      id: 'step-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      text: '',
      notes: '',
      imageSrc: '',
      imageCaption: '',
    };
    onChange([...steps, nextStep]);
  };

  const handleRemoveStep = (id: string) => {
    if (steps.length <= 1) {
      // Keep at least Step 1, reset contents
      onChange([
        {
          id: 'step-' + Date.now(),
          text: '',
          notes: '',
          imageSrc: '',
          imageCaption: '',
        },
      ]);
      return;
    }
    onChange(steps.filter((st) => st.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...steps];
    const temp = newSteps[index - 1];
    newSteps[index - 1] = newSteps[index];
    newSteps[index] = temp;
    onChange(newSteps);
  };

  const handleMoveDown = (index: number) => {
    if (index === steps.length - 1) return;
    const newSteps = [...steps];
    const temp = newSteps[index + 1];
    newSteps[index + 1] = newSteps[index];
    newSteps[index] = temp;
    onChange(newSteps);
  };

  return (
    <div className="form-group">
      <label className="form-label" style={{ marginBottom: '0.65rem' }}>
        {t.prepSteps} *
      </label>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map((step, index) => (
          <div key={step.id} className="step-builder-card">
            <div className="step-builder-header">
              <span className="step-builder-badge">
                <span>Step {index + 1}</span>
              </span>

              <div className="step-builder-actions">
                <button
                  type="button"
                  className="btn-step-action"
                  title="Move step up"
                  disabled={index === 0}
                  onClick={() => handleMoveUp(index)}
                  aria-label={`Move Step ${index + 1} up`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn-step-action"
                  title="Move step down"
                  disabled={index === steps.length - 1}
                  onClick={() => handleMoveDown(index)}
                  aria-label={`Move Step ${index + 1} down`}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="btn-step-action danger"
                  title={t.removeStep}
                  onClick={() => handleRemoveStep(step.id)}
                  aria-label={`${t.removeStep} ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Step Instruction Text */}
            <div style={{ marginBottom: '0.65rem' }}>
              <textarea
                className="form-control"
                rows={2}
                required
                value={step.text}
                onChange={(e) => handleUpdate(step.id, 'text', e.target.value)}
                placeholder={`Instruction for Step ${index + 1}...`}
              />
            </div>

            {/* Step Consistency Note / Cue */}
            <div style={{ marginBottom: '0.65rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.2rem',
                }}
              >
                💡 {t.stepNotesLabel}
              </label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                value={step.notes || ''}
                onChange={(e) => handleUpdate(step.id, 'notes', e.target.value)}
                placeholder={t.stepNotesPlaceholder}
              />
            </div>

            {/* Step Photo with thumbnail and delete X */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.2rem',
                }}
              >
                📸 {t.stepPhoto}
              </label>
              <ImagePickerWithPreview
                imageUrl={step.imageSrc || ''}
                onChange={(url) => handleUpdate(step.id, 'imageSrc', url)}
                idPrefix={`step-${step.id}`}
                t={t}
              />

              {step.imageSrc && (
                <div style={{ marginTop: '0.4rem' }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                    placeholder="Photo caption (e.g., Consistency after kneading)"
                    value={step.imageCaption || ''}
                    onChange={(e) =>
                      handleUpdate(step.id, 'imageCaption', e.target.value)
                    }
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn-add-step"
        onClick={handleAddStep}
      >
        {t.addStep}
      </button>
    </div>
  );
};
