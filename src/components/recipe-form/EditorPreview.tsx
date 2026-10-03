import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Language, Recipe } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { RecipeDetailView, RecipePageHandle } from '../recipe-detail/RecipeDetailView';

interface EditorPreviewProps {
  /** The recipe as the form would save it. */
  recipe: Recipe;
  language: Language;
  onClose: () => void;
  t: UiTranslations;
}

const noop = () => {};

/**
 * The recipe page exactly as the family will see it, opened over the editor. The back button,
 * the navigation island's back capsule on its own, rises into the island's place at the foot of
 * the screen; it, Escape and the phone's back gesture all return to the form. While a step photo is open full screen, the back button rises
 * over it and closes it instead. Mount only while open.
 */
export const EditorPreview: React.FC<EditorPreviewProps> = ({ recipe, language, onClose, t }) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  const page = useRef<RecipePageHandle>(null);
  const back = useRef<HTMLButtonElement>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  // Focus starts on the way back; the key that opened the preview gets it back after.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    back.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);

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
          ref={page}
          recipe={recipe}
          language={language}
          onUnrolled={noop}
          onPhotoOpenChange={setPhotoOpen}
          t={t}
        />
      </div>
      <button
        ref={back}
        type="button"
        className={`editor-preview-back${photoOpen ? ' is-over-photo' : ''}`}
        aria-label={photoOpen ? t.closePhotoPreview : t.backToEditing}
        onClick={() => (photoOpen ? page.current?.closePhoto() : requestClose())}
      >
        <ArrowLeft className="nav-back-arrow" size="1.4em" strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
};
