import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { ChevronDown, Clock, Shapes } from 'lucide-react';
import { AuthorMode, RecipeCategory } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import type { CurrentUser } from '../../hooks/useCurrentUser';
import { useAboveKeyboard } from '../../hooks/useAboveKeyboard';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { memberName } from '../../utils/ownership';
import { TIME_KINDS, TimeKind, TimeTexts, timesFromText, timesTotal } from '../../utils/timeText';
import { CATEGORY_ICONS } from '../recipe-grid/vaultIcons';
import { CategoryList } from './CategoryList';
import { RecipeTimeField } from './RecipeTimeField';

export type BylinePart = 'author' | 'category' | 'times';

interface EditorBylineProps {
  /** The part whose popover is open. */
  open: BylinePart | null;
  onOpen: (part: BylinePart | null) => void;
  /** Null with nobody signed in: the author is always typed then. */
  currentUser: CurrentUser | null;
  authorMode: AuthorMode;
  onAuthorMode: (mode: AuthorMode) => void;
  author: string;
  onAuthor: (name: string) => void;
  category: RecipeCategory | '';
  onCategory: (category: RecipeCategory) => void;
  times: TimeTexts;
  /** An older recipe's single total, in minutes, while no time is typed; null when none. */
  manualMinutes: number | null;
  /** The steps' estimate, offered for the cook time: 0 while there are none. */
  estimate: number;
  onTime: (kind: TimeKind, text: string) => void;
  errors: { author?: string; category?: string };
  /** Parts that differ in a restored earlier version. */
  restored: { author?: boolean; time?: boolean };
  t: UiTranslations;
}

/**
 * The editor's byline, where the recipe page has it: "by Peter G. · Cakes · 1h 20m", each part a
 * pill key that opens its own small popover under the line: whose recipe it is, its category,
 * and its times. A part still needed (no category yet) is drawn dashed in the accent.
 */
export const EditorByline: React.FC<EditorBylineProps> = ({
  open,
  onOpen,
  currentUser,
  authorMode,
  onAuthorMode,
  author,
  onAuthor,
  category,
  onCategory,
  times,
  manualMinutes,
  estimate,
  onTime,
  errors,
  restored,
  t,
}) => {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const keys = useRef<Partial<Record<BylinePart, HTMLButtonElement | null>>>({});
  const CategoryIcon = category ? CATEGORY_ICONS[category] : Shapes;

  // The popover springs from the part that opened it.
  useLayoutEffect(() => {
    const key = open && keys.current[open];
    const box = wrap.current;
    if (!key || !box) return;
    const middle = key.getBoundingClientRect().left + key.offsetWidth / 2;
    box.style.setProperty(
      '--pop-origin-x',
      `${Math.round(middle - box.getBoundingClientRect().left)}px`,
    );
  }, [open]);

  // Closed, the popover hands focus back to its part.
  const close = (part: BylinePart) => {
    onOpen(null);
    keys.current[part]?.focus({ preventScroll: true });
  };
  const toggle = (part: BylinePart) => onOpen(open === part ? null : part);

  const authorName =
    authorMode === 'auto' && currentUser
      ? memberName(currentUser.name, currentUser.nameAsTyped)
      : author.trim();
  const typedTimes = timesFromText(times);
  const timeLabel = typedTimes
    ? timesTotal(typedTimes, t).label ||
      TIME_KINDS.map((kind) => times[kind].trim())
        .filter(Boolean)
        .join(' · ')
    : manualMinutes !== null
      ? t.totalTime(manualMinutes)
      : '';

  const part = (name: BylinePart, className: string, children: React.ReactNode) => (
    <button
      ref={(el) => {
        keys.current[name] = el;
      }}
      type="button"
      className={`byline-part ${className}`.trim()}
      aria-haspopup={name === 'category' ? 'listbox' : 'dialog'}
      aria-expanded={open === name}
      onClick={() => toggle(name)}
    >
      {children}
    </button>
  );

  return (
    <div ref={wrap} className="editor-byline-wrap">
      <div className="editor-byline">
        <span className="editor-byline-by" aria-hidden="true">
          {t.bylineBy}
        </span>
        {part(
          'author',
          `${authorName ? '' : 'is-needed'}${errors.author ? ' has-error' : ''}${restored.author ? ' is-restored' : ''}`,
          <>
            <span className="sr-only">{t.authorLabel}: </span>
            <span className="byline-part-text">{authorName || t.whoseRecipe}</span>
            <ChevronDown className="byline-part-chevron" size="1em" aria-hidden="true" />
          </>,
        )}
        {part(
          'category',
          `${category ? '' : 'is-needed'}${errors.category ? ' has-error' : ''}`,
          <>
            <CategoryIcon className="byline-part-icon" size="1.1em" aria-hidden="true" />
            <span className="sr-only" id={`${id}-category`}>
              {t.categoryLabel}{' '}
            </span>
            <span className="byline-part-text">
              {category ? t.recipeCategories[category] : t.chooseCategory}
            </span>
            <ChevronDown className="byline-part-chevron" size="1em" aria-hidden="true" />
          </>,
        )}
        {part(
          'times',
          `${timeLabel ? '' : 'is-quiet'}${restored.time ? ' is-restored' : ''}`,
          <>
            <Clock className="byline-part-icon" size="1.05em" aria-hidden="true" />
            <span className="sr-only">{t.recipeTime}: </span>
            <span className="byline-part-text">{timeLabel || t.addTimes}</span>
          </>,
        )}
      </div>

      {open === 'author' && (
        <BylinePopover
          label={t.authorLabel}
          focusField={Boolean(errors.author)}
          onClosed={() => close('author')}
          t={t}
        >
          <fieldset className="byline-author">
            <legend className="sr-only">{t.authorLabel}</legend>
            {currentUser && (
              <div className="choice-pill" data-value={authorMode === 'auto' ? 'first' : 'other'}>
                <span className="choice-pill-thumb" aria-hidden="true" />
                {(['auto', 'custom'] as const).map((mode) => (
                  <label key={mode} className={authorMode === mode ? 'is-active' : ''}>
                    <input
                      type="radio"
                      name={`${id}-authorMode`}
                      value={mode}
                      checked={authorMode === mode}
                      onChange={() => onAuthorMode(mode)}
                    />
                    {mode === 'auto'
                      ? memberName(currentUser.name, currentUser.nameAsTyped)
                      : t.authorSomeoneElse}
                  </label>
                ))}
              </div>
            )}
            {authorMode === 'auto' && currentUser ? (
              <p className="author-hint">
                {t.authorShownAs(memberName(currentUser.name, currentUser.nameAsTyped))}
              </p>
            ) : (
              <div className="author-custom">
                <label className="form-label is-small" htmlFor={`${id}-authorName`}>
                  {t.authorNameLabel}
                </label>
                <input
                  className="form-control"
                  type="text"
                  id={`${id}-authorName`}
                  required
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-invalid={Boolean(errors.author) || undefined}
                  value={author}
                  onChange={(e) => onAuthor(e.target.value)}
                />
              </div>
            )}
          </fieldset>
        </BylinePopover>
      )}

      {open === 'category' && (
        <CategoryList
          id={`${id}-categories`}
          labelId={`${id}-category`}
          value={category}
          onPick={(picked) => {
            onCategory(picked);
            keys.current.category?.focus({ preventScroll: true });
          }}
          onClosed={() => close('category')}
          t={t}
        />
      )}

      {open === 'times' && (
        <BylinePopover label={t.recipeTime} onClosed={() => close('times')} t={t}>
          <RecipeTimeField
            times={times}
            manualMinutes={manualMinutes}
            estimate={estimate}
            onChange={onTime}
            t={t}
          />
        </BylinePopover>
      )}

      {(errors.author || errors.category) && (
        <p className="field-error" role="alert">
          {errors.author ?? errors.category}
        </p>
      )}
    </div>
  );
};

interface BylinePopoverProps {
  label: string;
  /** Starts with the cursor in its first field: when that field is what Save still needs. */
  focusField?: boolean;
  /** Runs once it has closed, whichever way. */
  onClosed: () => void;
  children: React.ReactNode;
  t: UiTranslations;
}

/**
 * A byline part's popover: a card under the line, with Done. A tap outside, Escape or the back
 * gesture close it too. Focus starts on the card itself, so a phone's keyboard waits for a tap on
 * a field; only a typed name that Save still needs gets the cursor at once. The card stays in
 * view, above the keyboard too.
 */
const BylinePopover: React.FC<BylinePopoverProps> = ({
  label,
  focusField = false,
  onClosed,
  children,
  t,
}) => {
  const { ref, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClosed);
  const backdropProps = useDialogDismiss(requestClose);
  useBackStep(true, () => requestClose());
  const panel = useRef<HTMLDivElement>(null);
  useAboveKeyboard(panel);
  // Only as it opens.
  const focusAtOpen = useRef(focusField);

  useEffect(() => {
    const box = panel.current;
    const field = focusAtOpen.current
      ? box?.querySelector<HTMLElement>('input[type="text"]')
      : null;
    (field ?? box)?.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={ref} className={`byline-pop-layer${isClosing ? ' is-closing' : ''}`}>
      <div className="category-list-catcher" aria-hidden="true" {...backdropProps} />
      <div ref={panel} className="byline-pop" role="dialog" aria-label={label} tabIndex={-1}>
        {children}
        <div className="byline-pop-actions">
          <button type="button" className="btn btn-meta-pill" onClick={requestClose}>
            {t.done}
          </button>
        </div>
      </div>
    </div>
  );
};
