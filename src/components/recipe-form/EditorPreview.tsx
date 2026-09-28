import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Language, Recipe } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { RecipeDetailView } from '../recipe-detail/RecipeDetailView';

interface EditorPreviewProps {
  /** The recipe as the form would save it. */
  recipe: Recipe;
  language: Language;
  onClose: () => void;
  t: UiTranslations;
}

const noop = () => {};

/**
 * The recipe page exactly as the family will see it, opened over the editor. The back button
 * springs out where the menu button sits on a recipe page; it, Escape and the phone's back
 * gesture all return to the form. Mount only while open.
 */
export const EditorPreview: React.FC<EditorPreviewProps> = ({ recipe, language, onClose, t }) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());

  return (
    <div
      ref={ref}
      className={`editor-preview${isClosing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t.preview}
    >
      <div className="app-container editor-preview-page">
        <RecipeDetailView
          recipe={recipe}
          language={language}
          isWakeLocked={false}
          onToggleWakeLock={noop}
          isWakeLockSupported={false}
          onUnrolled={noop}
          t={t}
        />
      </div>
      <div className="editor-preview-back">
        <button
          type="button"
          className="fab-back editor-preview-back-button"
          aria-label={t.backToEditing}
          onClick={requestClose}
        >
          <ArrowLeft
            className="fab-back-arrow"
            size="1.6rem"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
};
