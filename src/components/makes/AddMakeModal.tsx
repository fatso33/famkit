import React, { useLayoutEffect, useRef, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { Language, Recipe } from '../../types/recipe';
import { Make, MakeContent } from '../../types/make';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { isoDay } from '../../utils/makes';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { AutoGrowTextarea } from '../common/AutoGrowTextarea';
import { ConfirmSheet } from '../common/ConfirmSheet';
import { HeroPhotoField } from '../recipe-form/HeroPhotoField';
import { RecipeLinkSelect } from './RecipeLinkSelect';

interface MakeForm {
  recipeId: string;
  photo: string;
  title: string;
  note: string;
  madeOn: string;
}

type FieldError = 'photo' | 'recipe';

interface AddMakeModalProps {
  /** The make being edited, in its own language; null for a new one. */
  make: Make | null;
  /** A new make's recipe, when it's added from that recipe's page. */
  recipeId?: string;
  /** The Recipe Box's recipes, to pick from. */
  recipes: Recipe[];
  language: Language;
  /** Where the page opens out of and folds back into (the button that opened it). */
  origin?: { x: number; y: number };
  onSave: (content: MakeContent) => void;
  /** Deletes the make being edited (asked to confirm first). */
  onDelete?: () => void;
  onClose: () => void;
  t: UiTranslations;
}

const formOf = (make: Make | null, recipeId = ''): MakeForm => ({
  recipeId: make?.recipeId ?? recipeId,
  photo: make?.photo ?? '',
  title: make?.title ?? '',
  note: make?.note ?? '',
  madeOn: make?.madeOn ?? isoDay(),
});

/**
 * Adding (or editing) a make: a page that opens out of the button that asked for it, like the
 * recipe editor, with the photo first, then the recipe it was made from, a title, a note and the
 * day it was made. Mount only while open.
 */
export const AddMakeModal: React.FC<AddMakeModalProps> = ({
  make,
  recipeId,
  recipes,
  language,
  origin,
  onSave,
  onDelete,
  onClose,
  t,
}) => {
  // Closing folds the page back into the button it came from; saving lets it sink away.
  const [exit, setExit] = useState<'cancel' | 'save'>('cancel');
  const { ref: layerRef, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const [initial] = useState(() => formOf(make, recipeId));
  const [form, setForm] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [sheet, setSheet] = useState<'discard' | 'delete' | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [today] = useState(() => isoDay());

  // The form scrolls under the bar, whose height follows the text size.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => setBarHeight(bar.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // How far the opening circle must grow to cover the screen from where it starts.
  const [reach] = useState(() =>
    origin
      ? Math.ceil(
          Math.hypot(
            Math.max(origin.x, window.innerWidth - origin.x),
            Math.max(origin.y, window.innerHeight - origin.y),
          ),
        )
      : 0,
  );

  const set = <K extends keyof MakeForm>(key: K, value: MakeForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const picked = recipes.find((r) => r.id === form.recipeId);
  const pickedName = picked ? (getLocalizedRecipe(picked, language) ?? picked).name : '';

  const errorsOf = (): Partial<Record<FieldError, string>> => ({
    ...(form.photo ? {} : { photo: t.makePhotoRequired }),
    // A make keeps the recipe it was made from, even one since deleted from the Recipe Box.
    ...(picked || (make && form.recipeId === make.recipeId)
      ? {}
      : { recipe: t.makeRecipeRequired }),
  });
  const errors = showErrors ? errorsOf() : {};

  const close = (how: 'cancel' | 'save') => {
    setExit(how);
    requestClose();
  };

  const save = () => {
    if (Object.keys(errorsOf()).length > 0) {
      setShowErrors(true);
      // Brings the first problem into view.
      requestAnimationFrame(() => {
        bodyRef.current?.querySelector<HTMLElement>('.has-error')?.scrollIntoView?.({
          block: 'center',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
      });
      return;
    }
    onSave({
      recipeId: form.recipeId,
      photo: form.photo,
      title: form.title,
      note: form.note,
      madeOn: form.madeOn || undefined,
    });
    close('save');
  };

  const isDirty = () => JSON.stringify(form) !== JSON.stringify(initial);
  // Closing with changes asks first: nothing else keeps them.
  const requestCancel = () => {
    if (isDirty()) setSheet('discard');
    else close('cancel');
  };
  // Escape and the phone's back gesture close it like the ✕; sheets opened over it take them
  // for themselves.
  useDialogDismiss(requestCancel);
  useBackStep(true, () => requestCancel());

  let rise = 0;
  const riseStyle = () => ({ '--i': rise++ }) as React.CSSProperties;

  return (
    <div
      ref={layerRef}
      className={`editor-layer make-editor${isClosing ? ' is-closing' : ''}`}
      data-exit={exit}
      role="dialog"
      aria-modal="true"
      aria-labelledby="makeEditorTitle"
      style={
        {
          '--editor-origin-x': origin ? `${origin.x}px` : '50%',
          '--editor-origin-y': origin ? `${origin.y}px` : '100%',
          '--editor-reach': reach ? `${reach}px` : '150vmax',
          '--editor-bar-height': `${barHeight}px`,
        } as React.CSSProperties
      }
    >
      <header ref={barRef} className="editor-bar">
        <div className="editor-bar-actions make-editor-bar">
          <button
            type="button"
            className="editor-bar-close"
            aria-label={t.closeDialog}
            onClick={requestCancel}
          >
            <X size="1.35rem" strokeWidth={2.2} aria-hidden="true" />
          </button>
          <h2 className="editor-bar-title" id="makeEditorTitle">
            {make ? t.editMakeTitle : t.addMake}
          </h2>
          <button type="button" className="editor-save" aria-label={t.save} onClick={save}>
            <Check
              className="editor-save-icon"
              size="1.35rem"
              strokeWidth={2.6}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      <div className="editor-scroll" ref={bodyRef}>
        <div className="editor-body make-editor-body">
          {/* The photo, first: it's what a make is for. */}
          <div
            className={`form-group editor-rise${errors.photo ? ' has-error' : ''}`}
            style={riseStyle()}
          >
            <span className="form-label" id="makePhotoLabel">
              {t.makePhoto}
            </span>
            <HeroPhotoField
              photo={form.photo}
              onChange={(photo) => set('photo', photo)}
              labelId="makePhotoLabel"
              hint={t.makePhotoHint}
              errorId={errors.photo ? 'makePhotoError' : undefined}
              t={t}
            />
            {errors.photo && (
              <p className="field-error" id="makePhotoError" role="alert">
                {errors.photo}
              </p>
            )}
          </div>

          <div
            className={`form-group editor-rise${errors.recipe ? ' has-error' : ''}`}
            style={riseStyle()}
          >
            <RecipeLinkSelect
              value={form.recipeId}
              recipes={recipes}
              language={language}
              onChange={(id) => set('recipeId', id)}
              error={errors.recipe}
              t={t}
            />
          </div>

          <div className="form-group editor-rise" style={riseStyle()}>
            <div className="form-label-row">
              <label className="form-label" htmlFor="makeTitleInput">
                {t.makeTitle}
              </label>
              <span className="form-optional" aria-hidden="true">
                {t.optional}
              </span>
            </div>
            {/* Without one, the make is shown under its recipe's name, as the field suggests. */}
            <input
              className="form-control"
              type="text"
              id="makeTitleInput"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={200}
              placeholder={pickedName}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>

          <div className="form-group editor-rise" style={riseStyle()}>
            <div className="form-label-row">
              <label className="form-label" htmlFor="makeNoteInput">
                {t.makeNote}
              </label>
              <span className="form-optional" aria-hidden="true">
                {t.optional}
              </span>
            </div>
            <AutoGrowTextarea
              className="form-control make-note-input"
              id="makeNoteInput"
              rows={3}
              maxLength={4000}
              placeholder={t.makeNotePlaceholder}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>

          <div className="form-group editor-rise" style={riseStyle()}>
            <label className="form-label" htmlFor="makeMadeOnInput">
              {t.madeOn}
            </label>
            <input
              className="form-control make-date-input"
              type="date"
              id="makeMadeOnInput"
              max={today}
              value={form.madeOn}
              onChange={(e) => set('madeOn', e.target.value)}
            />
          </div>

          {onDelete && (
            <div className="form-group editor-rise make-editor-delete" style={riseStyle()}>
              <button
                type="button"
                className="btn btn-danger-quiet"
                onClick={() => setSheet('delete')}
              >
                <Trash2 size="1.05em" aria-hidden="true" />
                {t.deleteMake}
              </button>
            </div>
          )}
        </div>
      </div>

      {sheet === 'discard' && (
        <ConfirmSheet
          title={t.discardTitle}
          message={t.makeDiscardBody}
          confirmLabel={t.discard}
          cancelLabel={t.keepEditing}
          danger
          onConfirm={() => close('cancel')}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'delete' && onDelete && (
        <ConfirmSheet
          title={t.deleteMakeTitle}
          message={t.deleteMakeBody}
          confirmLabel={t.deleteMake}
          cancelLabel={t.keepEditing}
          danger
          onConfirm={() => {
            onDelete();
            close('save');
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
};
