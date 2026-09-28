import React, { useLayoutEffect, useRef } from 'react';
import { Check, ChevronDown, CircleCheck, ClipboardPaste, Eye, RotateCcw, X } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';

interface EditorBarProps {
  isEditMode: boolean;
  /** The recipe's current version (edit mode). */
  version: number;
  /** Whether it has earlier versions to pick from, in the dropdown under the title. */
  hasVersions: boolean;
  versionsOpen: boolean;
  onToggleVersions: () => void;
  /** New recipes: "Draft saved" or "Draft restored". */
  status: string | null;
  /** Scrolled down the form: the tools slide away under the title row. */
  tucked: boolean;
  /** Scrolled at all: a hairline separates the bar from the form. */
  scrolled: boolean;
  onClose: () => void;
  onSave: () => void;
  onPaste: () => void;
  onPreview: () => void;
  /** Offered while a restored draft is open. */
  onStartOver?: () => void;
  /** Reports the bar's height, which the form below leaves room for. */
  onHeight: (px: number) => void;
  /** The version list, dropping down from under the title. */
  children?: React.ReactNode;
  t: UiTranslations;
}

/**
 * The editor's one bar: Close, the title (with the version, which drops down its history), and
 * Save; under them Paste and Preview, which slide away as the form scrolls down and come back as
 * it scrolls up.
 */
export const EditorBar: React.FC<EditorBarProps> = ({
  isEditMode,
  version,
  hasVersions,
  versionsOpen,
  onToggleVersions,
  status,
  tucked,
  scrolled,
  onClose,
  onSave,
  onPaste,
  onPreview,
  onStartOver,
  onHeight,
  children,
  t,
}) => {
  const bar = useRef<HTMLElement>(null);
  const latestOnHeight = useRef(onHeight);
  useLayoutEffect(() => {
    latestOnHeight.current = onHeight;
  });

  // The bar's height changes with the text size, so the form's top margin follows it.
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    latestOnHeight.current(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => latestOnHeight.current(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={bar}
      className={`editor-bar${tucked ? ' is-tucked' : ''}${scrolled ? ' is-scrolled' : ''}`}
    >
      <div className="editor-bar-main">
        <button
          type="button"
          className="editor-bar-close"
          aria-label={t.closeDialog}
          onClick={onClose}
        >
          <X size="1.35rem" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="editor-bar-heading">
          <h2 className="editor-bar-title" id="editorTitle">
            {isEditMode ? t.editorTitleEdit : t.editorTitleNew}
          </h2>
          {isEditMode ? (
            hasVersions ? (
              <button
                type="button"
                className="editor-version"
                aria-haspopup="dialog"
                aria-expanded={versionsOpen}
                onClick={onToggleVersions}
              >
                {t.versionLabel(version)}
                <ChevronDown className="editor-version-chevron" size="1.05em" aria-hidden="true" />
              </button>
            ) : (
              <span className="editor-bar-status">{t.versionLabel(version)}</span>
            )
          ) : (
            status && (
              <span className="editor-bar-status" role="status">
                <CircleCheck size="1.05em" aria-hidden="true" />
                {status}
              </span>
            )
          )}
          {children}
        </div>
        <button type="button" className="editor-save" onClick={onSave}>
          <Check className="editor-save-icon" size="1.25rem" strokeWidth={2.6} aria-hidden="true" />
          <span className="editor-save-label">{t.save}</span>
        </button>
      </div>
      <div className="editor-bar-tools" inert={tucked}>
        <button type="button" className="editor-chip" onClick={onPaste}>
          <ClipboardPaste size="1.15em" aria-hidden="true" />
          {t.paste}
        </button>
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
      </div>
    </header>
  );
};
