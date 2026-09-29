import React, { useEffect, useRef } from 'react';
import { Check, FilePen } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';

interface SaveMenuProps {
  /** The version saving makes: null for a new recipe. */
  version: number | null;
  /** The version a draft of it becomes. */
  draftVersion: number;
  onSaveToVault: () => void;
  onSaveDraft: () => void;
  onClose: () => void;
  t: UiTranslations;
}

/**
 * The Save pill's two choices, unfolding from under it: into the vault for the family, or a
 * draft only its writer sees. Mount only while open. A tap outside, Escape or the back gesture
 * closes it.
 */
export const SaveMenu: React.FC<SaveMenuProps> = ({
  version,
  draftVersion,
  onSaveToVault,
  onSaveDraft,
  onClose,
  t,
}) => {
  const { ref: layerRef, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  const first = useRef<HTMLButtonElement>(null);

  // Focus starts on saving to the vault; the Save pill gets it back when the choices close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    first.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);

  const pick = (choice: () => void) => {
    requestClose();
    choice();
  };

  return (
    <div ref={layerRef} className={`save-menu-layer${isClosing ? ' is-closing' : ''}`}>
      <div className="version-menu-catcher" aria-hidden="true" {...backdropProps} />
      <div className="save-menu" role="dialog" aria-label={t.saveChoices}>
        <button
          ref={first}
          type="button"
          className="save-option is-vault"
          onClick={() => pick(onSaveToVault)}
        >
          <span className="save-option-icon" aria-hidden="true">
            <Check size="1.2rem" strokeWidth={2.6} />
          </span>
          <span className="save-option-text">
            <span className="save-option-title">{t.saveToVault}</span>
            <span className="save-option-hint">{t.saveToVaultHint(version)}</span>
          </span>
        </button>
        <button type="button" className="save-option" onClick={() => pick(onSaveDraft)}>
          <span className="save-option-icon" aria-hidden="true">
            <FilePen size="1.15rem" strokeWidth={2.2} />
          </span>
          <span className="save-option-text">
            <span className="save-option-title">{t.saveDraft(draftVersion)}</span>
            <span className="save-option-hint">{t.saveDraftHint}</span>
          </span>
        </button>
      </div>
    </div>
  );
};
