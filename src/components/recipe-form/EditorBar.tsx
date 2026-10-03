import React, { useLayoutEffect, useRef } from 'react';
import { BookOpenText, ChevronDown, CircleCheck, ClipboardPaste, Shuffle, X } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';
import { NumberRoll } from '../common/NumberRoll';

const FITS = [
  'row text long',
  'row icons long',
  'row icons short',
  'wrap text long',
  'wrap icons long',
  'wrap icons short',
];

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
  /** Saves, or (with things missing) lifts the first of them. */
  onSave: () => void;
  /** How many things a save still needs: Save counts them down ("Save · 2 left"). */
  missing: number;
  /** Keeps it as a draft, finished or not. Missing with nobody signed in. */
  onSaveDraft?: () => void;
  /** The Draft key's full name, e.g. "Save draft v4". */
  draftName: string;
  /** New recipes only. */
  onPaste?: () => void;
  /** Reading: the page shows only what the family will see (prompts, keys and tools put away). */
  reading: boolean;
  onToggleRead: () => void;
  /** Offered while a restored draft is open: a link after the status that says so. */
  onStartOver?: () => void;
  /** Offered while a saved draft is open: a link after the draft's label. */
  onDiscardDraft?: () => void;
  /**
   * Reports the bar's height, which the form below leaves room for, and how far it slides up to
   * put its banner away (which the form's sticky restore banner follows).
   */
  onHeight: (px: number, tuck: number) => void;
  /** Out of reach while a preview or a sheet covers the page. */
  inert?: boolean;
  /** The jump pills, hanging under the row of actions once the page is scrolled. */
  jump?: React.ReactNode;
  /** The version list, dropping down from under the title. */
  children?: React.ReactNode;
  t: UiTranslations;
}

/**
 * The editor's bar: a banner with the title (and the version, which drops down its history),
 * and under it one row of everything there is to do: Close, Paste (new recipes), Read, then
 * Draft and Save. Save counts down what's still needed. Scrolling down the form slides the
 * banner away and leaves the row; scrolling up brings it back.
 *
 * The row never squeezes a word: when it doesn't fit, Paste and Read become icon keys, then
 * Save drops its "left" ("Save · 2"), and when that's still too wide (a small phone, large text),
 * Draft and Save take a row of their own.
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
  missing,
  onSaveDraft,
  draftName,
  onPaste,
  reading,
  onToggleRead,
  onStartOver,
  onDiscardDraft,
  onHeight,
  inert,
  jump,
  children,
  t,
}) => {
  const bar = useRef<HTMLElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const saveKey = useRef<HTMLButtonElement>(null);
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

  // How the row fits (data-fit, three words): on one row or with Draft and Save on a row of their
  // own; Paste and Read with their words or as icon keys; Save's count with its "left" or
  // without. Tried from roomiest to tightest whenever the width or what the keys say changes.
  const fitKey = `${missing > 0}:${String(missing).length}:${Boolean(onPaste)}:${Boolean(onSaveDraft)}:${Boolean(onStartOver)}`;
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const overflows = () => {
      const box = tools.current;
      return (
        el.scrollWidth > el.clientWidth + 1 ||
        (box !== null && box.scrollWidth > box.clientWidth + 1)
      );
    };
    const fit = () => {
      for (const mode of FITS) {
        el.dataset.fit = mode;
        if (!overflows()) return;
      }
    };
    fit();
    // A font arriving widens the words without resizing the row (see useFitText).
    document.fonts?.addEventListener?.('loadingdone', fit);
    let width = el.clientWidth;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (el.clientWidth === width) return;
            width = el.clientWidth;
            fit();
          });
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [fitKey]);

  const save = () => {
    // Not ready yet: the key gives a small shake as the first missing part lifts.
    if (missing > 0) {
      saveKey.current?.animate?.(
        [
          { transform: 'none' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(-2px)' },
          { transform: 'none' },
        ],
        { duration: 320, easing: 'ease-out' },
      );
    }
    onSave();
  };

  const link = (label: string, onClick: () => void) => (
    <>
      <span className="editor-bar-link-dot" aria-hidden="true">
        ·
      </span>
      <button type="button" className="editor-bar-link" onClick={onClick}>
        {label}
      </button>
    </>
  );

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
            <span className="editor-bar-line">
              {hasVersions ? (
                <button
                  type="button"
                  className="editor-version"
                  aria-haspopup="dialog"
                  aria-expanded={versionsOpen}
                  onClick={onToggleVersions}
                >
                  {draftLabel ?? t.versionLabel(version)}
                  <ChevronDown
                    className="editor-version-chevron"
                    size="1.05em"
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <span className="editor-bar-status">{draftLabel ?? t.versionLabel(version)}</span>
              )}
              {onDiscardDraft && link(t.discardDraft, onDiscardDraft)}
            </span>
            {/* Only from the start (a restored edit): a line appearing mid-typing would move the form. */}
            {status && (
              <span className="editor-bar-line">
                <span className="editor-bar-status" role="status">
                  <CircleCheck size="1.05em" aria-hidden="true" />
                  {status}
                </span>
                {onStartOver && link(t.startOver, onStartOver)}
              </span>
            )}
          </>
        ) : (
          // Always there, empty or not, so the form doesn't move down when it first says something.
          <span className="editor-bar-line">
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
            {onStartOver && link(t.startOver, onStartOver)}
            {onDiscardDraft && link(t.discardDraft, onDiscardDraft)}
          </span>
        )}
      </div>
      <div ref={row} className="editor-bar-actions" data-fit={FITS[0]}>
        <button
          type="button"
          className="editor-bar-close"
          aria-label={t.closeDialog}
          onClick={onClose}
        >
          <X size="1.35rem" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div ref={tools} className="editor-bar-tools">
          {onPaste && (
            <button type="button" className="editor-chip" aria-label={t.paste} onClick={onPaste}>
              <ClipboardPaste size="1.15em" aria-hidden="true" />
              <span className="editor-chip-label">{t.paste}</span>
            </button>
          )}
          <button
            type="button"
            className="editor-chip editor-read-key"
            aria-label={t.read}
            aria-pressed={reading}
            onClick={onToggleRead}
          >
            <BookOpenText size="1.15em" aria-hidden="true" />
            <span className="editor-chip-label">{t.read}</span>
          </button>
        </div>
        <div className="editor-save-group">
          {onSaveDraft && (
            <button
              type="button"
              className="editor-draft-key"
              aria-label={draftName}
              onClick={onSaveDraft}
            >
              {t.draftKey}
            </button>
          )}
          <button
            ref={saveKey}
            type="button"
            className={`editor-save${missing > 0 ? ' is-incomplete' : ''}`}
            aria-label={missing > 0 ? t.saveMissing(missing) : t.save}
            onClick={save}
          >
            <span className="editor-save-label">{t.save}</span>
            {missing > 0 && (
              <span className="editor-save-left" aria-hidden="true">
                <span className="editor-save-dot">·</span>
                {t.saveLeftBefore && (
                  <span className="editor-save-left-word">{t.saveLeftBefore}</span>
                )}
                <NumberRoll value={missing} />
                {t.saveLeftAfter && (
                  <span className="editor-save-left-word">{t.saveLeftAfter}</span>
                )}
              </span>
            )}
          </button>
        </div>
      </div>
      {jump}
      {/* Outside the rows, which slide: a moving row would trap the menus' tap catchers. */}
      {children}
    </header>
  );
};
