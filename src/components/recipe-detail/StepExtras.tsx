import React from 'react';
import { PathExtras } from '../../utils/recipeMethod';
import { capitalizeFirstLetter } from '../../utils/timeEstimator';
import { UiTranslations } from '../../i18n/translations';

interface StepExtrasProps {
  /** The step's tip and photo, or on a fork the chosen path's. */
  step: PathExtras;
  /** The step's place in the recipe, which the photo viewer is opened with. */
  index: number;
  /** Whether this step's photo is the one the viewer grows from and shrinks back into. */
  isZoomSource: boolean;
  onZoomImage: (src: string, step: number) => void;
  t: UiTranslations;
}

/** A step's tip and photo, under its text. */
export const StepExtras: React.FC<StepExtrasProps> = ({
  step,
  index,
  isZoomSource,
  onZoomImage,
  t,
}) => (
  <>
    {step.notes && <div className="step-note-pill">{capitalizeFirstLetter(step.notes)}</div>}

    {step.hasImage && step.imageSrc && (
      <div
        className={`step-visual-frame clickable-zoom${isZoomSource ? ' is-zoom-source' : ''}`}
        title={t.viewStepPhoto}
        role="button"
        tabIndex={0}
        onClick={() => onZoomImage(step.imageSrc!, index)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onZoomImage(step.imageSrc!, index);
        }}
      >
        <img
          className="step-visual-img"
          src={step.imageSrc}
          alt={step.imageCaption || t.stepPhotoAlt}
          loading="lazy"
        />
      </div>
    )}
  </>
);
