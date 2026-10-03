import React, { useLayoutEffect, useRef } from 'react';
import {
  Check,
  ChevronDown,
  CircleCheck,
  ClipboardPaste,
  Eye,
  RotateCcw,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';

interface EditorBarProps {
  isEditMode: boolean;
  /** A remix: a new recipe started from another one. */
  isRemix?: boolean;
  /** The recipe's current version (edit mode). */
  version: number;
  /** Shown in place of the version while a draft is open, e.g. "Draft v4". */
  draftLabel?: string;
  /** Whether it has earlier versions to pick from, in the dropdown under the title. */
  hasVersions: boolean;
  versionsOpen: boolean;
  onToggleVersions: () => void;
  /** "Kept on this phone", "Unsaved work restored", the draft or the remix it is. */
  status: string | null;
  /** Scrolled down the form: the banner slides away, leaving the row of actions. */
  tucked: boolean;
  /** Scrolled at all: a hairline separates the bar from the form. */
  scrolled: boolean;
  onClose: () => void;
  onSave: () => void;
  /** Save opens its choices (vault or draft), shown here while open. */
  saveMenu?: React.ReactNode;
  saveMenuOpen?: boolean;
  /** New recipes only. */
  onPaste?: () => void;
  onPreview: () => void;
  /** Offered while a restored draft is open. */
  onStartOver?: () => void;
  /** Offered while a saved draft is open. */
  onDiscardDraft?: () => void;
  /**
   * Reports the bar's height, which the form below leaves room for, and how far it slides up to
   * put its banner away (which the form's sticky restore banner follows).
   */
  onHeight: (px: number, tuck: number) => void;
  /** Out of reach while a preview or a sheet covers the page. */
  inert?: boolean;
  /** The version list, dropping down from under the title. */
  children?: React.ReactNode;
  t: UiTranslations;
}

/**
 * The editor's bar: a banner with the title (and the version, which drops down its history),
 * and under it one row of everything there is to do: Close, Paste (new recipes), Preview and
 * Save. Scrolling down the form slides the banner away and leaves the row; scrolling up brings
 * it back.
 */
export const EditorBar: React.FC<EditorBarProps> = ({
  isEditMode,
  isRemix = false,
  version,
  draftLabel,
  hasVersions,
  versionsOpen,
  onToggleVersions,
  status,
  tucked,
  scrolled,
  onClose,
  onSave,
  saveMenu,
  saveMenuOpen,
  onPaste,
  onPreview,
  onStartOver,
  onDiscardDraft,
  onHeight,
  inert,
  children,
  t,
}) => {
  const bar = useRef<HTMLElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const latestOnHeight = useRef(onHeight);
  useLayoutEffect(() => {
    latestOnHeight.current = onHeight;
  });

  // The bar's height changes with the text size, so the form's top margin follows it, and so
  // does how far the bar slides up to put its banner away (all of it but the status-bar inset).
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const measure = () => {
      const title = banner.current;
      const inset = title ? parseFloat(getComputedStyle(title).paddingTop) || 0 : 0;
      latestOnHeight.current(el.offsetHeight, title ? title.offsetHeight - inset : 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={bar}
      className={`editor-bar${tucked ? ' is-tucked' : ''}${scrolled ? ' is-scrolled' : ''}`}
      inert={inert}
    >
      <div ref={banner} className="editor-bar-banner" inert={tucked}>
        <h2 className="editor-bar-title" id="editorTitle">
          {isEditMode ? t.editorTitleEdit : isRemix ? t.editorTitleRemix : t.editorTitleNew}
        </h2>
        {isEditMode ? (
          <>
            {hasVersions ? (
              <button
                type="button"
                className="editor-version"
                aria-haspopup="dialog"
                aria-expanded={versionsOpen}
                onClick={onToggleVersions}
              >
                {draftLabel ?? t.versionLabel(version)}
                <ChevronDown className="editor-version-chevron" size="1.05em" aria-hidden="true" />
              </button>
            ) : (
              <span className="editor-bar-status">{draftLabel ?? t.versionLabel(version)}</span>
            )}
            {/* Only from the start (a restored edit): a line appearing mid-typing would move the form. */}
            {status && (
              <span className="editor-bar-status" role="status">
                <CircleCheck size="1.05em" aria-hidden="true" />
                {status}
              </span>
            )}
          </>
        ) : (
          // Always there, empty or not, so the form doesn't move down when it first says something.
          <span className="editor-bar-status" role="status">
            {status && (
              <span key={status} className="editor-bar-status-text">
                {isRemix ? (
                  <Shuffle size="1.05em" strokeWidth={2.1} aria-hidden="true" />
                ) : (
                  <CircleCheck size="1.05em" aria-hidden="true" />
                )}
                {status}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="editor-bar-actions">
        <button
          type="button"
          className="editor-bar-close"
          aria-label={t.closeDialog}
          onClick={onClose}
        >
          <X size="1.35rem" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="editor-bar-tools">
          {onPaste && (
            <button type="button" className="editor-chip" onClick={onPaste}>
              <ClipboardPaste size="1.15em" aria-hidden="true" />
              {t.paste}
            </button>
          )}
          <button type="button" className="editor-chip" onClick={onPreview}>
            <Eye size="1.15em" aria-hidden="true" />
            {t.preview}
          </button>
          {onStartOver && (
            <button type="button" className="editor-chip" onClick={onStartOver}>
              <RotateCcw size="1.1em" aria-hidden="true" />
              {t.startOver}
            </button>
          )}
          {onDiscardDraft && (
            <button type="button" className="editor-chip" onClick={onDiscardDraft}>
              <Trash2 size="1.05em" aria-hidden="true" />
              {t.discardDraft}
            </button>
          )}
        </div>
        <button
          type="button"
          className="editor-save"
          aria-label={t.save}
          aria-haspopup={saveMenu !== undefined ? 'dialog' : undefined}
          aria-expanded={saveMenu !== undefined ? Boolean(saveMenuOpen) : undefined}
          onClick={onSave}
        >
          <Check className="editor-save-icon" size="1.35rem" strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
      {/* Outside the rows, which slide: a moving row would trap the menus' tap catchers. */}
      {children}
      {saveMenuOpen && saveMenu}
    </header>
  );
};
