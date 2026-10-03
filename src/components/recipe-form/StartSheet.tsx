import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ClipboardPaste, Globe, PencilLine } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { useInertBehind } from '../../hooks/useInertBehind';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { importRecipe } from '../../services/importRecipe';
import { ImportedRecipe } from '../../utils/recipeImport';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { PasteTarget, PasteTextPanel } from './PasteTextPanel';
import { PasteWebsitePanel } from './PasteWebsitePanel';

type Stage = 'choose' | 'text' | 'website';

interface StartSheetProps {
  /** An empty page, unrolling out of the tapped choice. */
  onType: (from: Element) => void;
  /** The page filled in with pasted text, unrolling out of Add. */
  onPasted: (text: Record<PasteTarget, string>, from: Element) => void;
  /** The page filled in from a website, unrolling out of Add. */
  onImported: (recipe: ImportedRecipe, from: Element) => void;
  /** Websites can be read (the build has an import worker). */
  canImport: boolean;
  /** A new recipe is kept on this phone, which a website's recipe would replace. */
  replaces?: boolean;
  onClose: () => void;
  t: UiTranslations;
}

/**
 * How a new recipe starts, in a sheet over the page it was asked for from: typed, pasted as
 * text, or read off a website. Paste and website turn the sheet into their panel (it grows or
 * shrinks to fit, sliding rather than jumping); the editor then unrolls already filled in, out
 * of the key that finished it, while the sheet sinks away under it. Mount only while open.
 */
export const StartSheet: React.FC<StartSheetProps> = ({
  onType,
  onPasted,
  onImported,
  canImport,
  replaces = false,
  onClose,
  t,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  // Closed by the cook: a website still being read then opens nothing.
  const left = useRef(false);
  const close = () => {
    left.current = true;
    requestClose();
  };
  const backdropProps = useDialogDismiss(close);
  const [stage, setStage] = useState<Stage>('choose');
  // The back gesture steps back to the choices from a panel, and closes the sheet from them.
  useBackStep(true, close);
  useBackStep(stage !== 'choose', () => setStage('choose'));
  useInertBehind(ref);
  useKeyboardInset(ref);
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  // Handed on to the editor: the focus stays with it rather than coming back here.
  const handedOn = useRef(false);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    first.current?.focus({ preventScroll: true });
    return () => {
      if (!handedOn.current) opener?.focus({ preventScroll: true });
    };
  }, []);

  // A change of stage changes the sheet's height. Fixed to the foot of the screen, its top
  // would jump: instead it starts where it was and glides to where it now is.
  const height = useRef(0);
  const shownStage = useRef<Stage>(stage);
  useLayoutEffect(() => {
    // Back at the choices, the one that was left is under the finger again.
    if (stage === 'choose' && shownStage.current !== 'choose') {
      first.current?.focus({ preventScroll: true });
    }
    shownStage.current = stage;
    const el = sheet.current;
    if (!el) return;
    const before = height.current;
    height.current = el.offsetHeight;
    if (!before || before === height.current || prefersReducedMotion()) return;
    el.animate?.(
      [{ transform: `translateY(${height.current - before}px)` }, { transform: 'none' }],
      { duration: 380, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    );
  }, [stage]);

  const handOn = (open: () => void) => {
    if (left.current) return;
    left.current = true;
    handedOn.current = true;
    open();
    requestClose();
  };

  // Add, which the page unrolls out of.
  const addKey = () => sheet.current?.querySelector('.btn-primary') ?? sheet.current!;

  const choice = (
    to: Stage | 'type',
    icon: React.ReactNode,
    name: string,
    hint: string,
    isFirst = false,
  ) => (
    <button
      ref={isFirst ? first : undefined}
      type="button"
      className="start-choice"
      onClick={(e) => {
        if (to === 'type') {
          const from = e.currentTarget;
          handOn(() => onType(from));
        } else setStage(to);
      }}
    >
      <span className="start-choice-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="start-choice-words">
        <span className="start-choice-name">{name}</span>
        <span className="start-choice-hint">{hint}</span>
      </span>
    </button>
  );

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={ref}
      className={`editor-sheet-layer is-over-page${isClosing ? ' is-closing' : ''}`}
      {...backdropProps}
    >
      <div
        ref={sheet}
        className={`editor-sheet start-sheet${stage === 'choose' ? '' : ' is-paste'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-stage={stage}
      >
        <div className="editor-sheet-grip" aria-hidden="true" />
        <h3 className="editor-sheet-title start-sheet-title" id={titleId}>
          {stage !== 'choose' && (
            <button
              type="button"
              className="start-sheet-back"
              aria-label={t.startBack}
              onClick={() => setStage('choose')}
            >
              <ArrowLeft size="1.2rem" strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
          {/* Keyed, so the words fade in as they change. */}
          <span key={stage} className="start-sheet-name">
            {stage === 'text' ? t.startPaste : stage === 'website' ? t.startWebsite : t.startTitle}
          </span>
        </h3>

        {stage === 'choose' && (
          <div key="choose" className="start-choices paste-panel">
            {choice(
              'type',
              <PencilLine size="1.35rem" strokeWidth={2} />,
              t.startType,
              t.startTypeHint,
              true,
            )}
            {choice(
              'text',
              <ClipboardPaste size="1.35rem" strokeWidth={2} />,
              t.startPaste,
              t.startPasteHint,
            )}
            {canImport &&
              choice(
                'website',
                <Globe size="1.35rem" strokeWidth={2} />,
                t.startWebsite,
                t.startWebsiteHint,
              )}
          </div>
        )}
        {stage === 'text' && (
          <PasteTextPanel
            key="text"
            onAdd={(text) => {
              const from = addKey();
              handOn(() => onPasted(text, from));
            }}
            onCancel={close}
            t={t}
          />
        )}
        {stage === 'website' && (
          <PasteWebsitePanel
            key="website"
            onImport={async (url) => {
              const result = await importRecipe(url, t);
              if ('problem' in result) return result.problem;
              const from = addKey();
              handOn(() => onImported(result.recipe, from));
              return null;
            }}
            // Already handed on to the editor by then.
            onDone={() => {}}
            onCancel={close}
            replaces={replaces}
            t={t}
          />
        )}
      </div>
    </div>
  );
};
