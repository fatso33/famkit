import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, RotateCcw, Trash2, TriangleAlert, Lightbulb } from 'lucide-react';
import { Recipe, RecipeDraft, Language, VersionSummary } from '../../types/recipe';
import { UI_TEXT, UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { keepStillBelow } from '../../hooks/useListMotion';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import type { ToastAction } from '../../hooks/useToast';
import { resolveAuthor, shortName } from '../../utils/ownership';
import { formatVersionDate, RecipeChanges, RestorableField } from '../../utils/recipeVersions';
import { draftVersion } from '../../utils/recipeDrafts';
import {
  FormState,
  LegacyLabels,
  emptyForm,
  formFromDraft,
  formFromRecipe,
  formText,
  formToRecipe,
  hasContent,
  ingredientRowsOnly,
  addPastedMethod,
  methodToSteps,
  pastedIngredients,
  pastedMethod,
  pastedStepCount,
} from '../../utils/recipeForm';
import { ImportedPage, readImportedPage, recipeFromPage } from '../../utils/recipeImport';
import {
  ImportError,
  fetchRecipePage,
  fetchRecipePhoto,
  isRecipeImportAvailable,
} from '../../services/recipeImport';
import { estimateRecipeMinutes } from '../../utils/timeEstimator';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { AutoGrowTextarea } from '../common/AutoGrowTextarea';
import { ConfirmSheet } from '../common/ConfirmSheet';
import { CategorySelect } from './CategorySelect';
import { EditorBar } from './EditorBar';
import { EditorPreview } from './EditorPreview';
import { HeroPhotoField } from './HeroPhotoField';
import { IngredientEditor } from './IngredientEditor';
import { MethodEditor } from './MethodEditor';
import { ImportProblem, PasteSheet, PasteTarget } from './PasteSheet';
import { RecipeTimeField } from './RecipeTimeField';
import { SaveMenu } from './SaveMenu';
import { VersionMenu } from './VersionMenu';

const DRAFT_STORAGE_KEY = 'family_kitchen_recipe_draft';

function writeDraft(json: string) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, json);
  } catch {
    // localStorage full or restricted
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const legacyLabels = (t: UiTranslations): LegacyLabels => ({
  bakingSection: t.bakingOptions,
  bakingPaths: t.legacyBakingPaths,
});

// Initial contents: a saved draft, else the recipe being edited, else the unsaved new recipe
// kept on this phone, else empty.
function loadInitialForm(
  initialRecipe: Recipe | null | undefined,
  draft: RecipeDraft | null | undefined,
  t: UiTranslations,
): { form: FormState; fromDraft: boolean } {
  if (draft) return { form: formFromRecipe(draft.recipe, legacyLabels(t)), fromDraft: false };
  if (initialRecipe)
    return { form: formFromRecipe(initialRecipe, legacyLabels(t)), fromDraft: false };
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    const form = saved ? formFromDraft(JSON.parse(saved)) : null;
    if (form) return { form, fromDraft: true };
  } catch {
    // Ignore draft parse failure
  }
  return { form: emptyForm(), fromDraft: false };
}

type FieldError = 'title' | 'author' | 'category' | 'ingredients' | 'steps';
type Sheet = 'paste' | 'discard' | 'leave' | 'delete' | 'startOver' | 'discardDraft' | null;

/** A recipe as written so far, which a draft keeps: unchecked, so it may lack a title. */
export type DraftContent = Omit<Recipe, 'id' | 'createdAt'>;

interface AddRecipeModalProps {
  onClose: () => void;
  /** False when it reopens on another version, which swaps the form in place. */
  animateIn?: boolean;
  /** Where the page opens out of and closes back into (the button that opened it). */
  origin?: { x: number; y: number };
  /**
   * `textChanged` is false when an edit touched only photos, author, category or time.
   * `changeNote` is the author's optional "what changed" (edits only).
   */
  onSave: (
    recipeData: Omit<Recipe, 'id' | 'createdAt'>,
    existingId: string | undefined,
    textChanged: boolean,
    changeNote: string,
  ) => void;
  initialRecipe?: Recipe | null;
  /** A saved draft to carry on with, in place of the recipe as it is (or an empty form). */
  draft?: RecipeDraft | null;
  /** Keeps what's written as a draft. Missing when there's nobody signed in to keep it for. */
  onSaveDraft?: (content: DraftContent, changeNote: string) => void;
  /** Deletes the open draft (asked to confirm first). */
  onDiscardDraft?: () => void;
  /** Earlier versions the author can restore (edit mode). */
  versions?: VersionSummary[];
  /** Set when the form holds an earlier version: which one, and what differs from the current. */
  restore?: { version: VersionSummary; changes: RecipeChanges };
  /** Loads an earlier version into the form; resolves false if it couldn't be loaded. */
  onPickVersion?: (id: string) => Promise<boolean>;
  /** Goes back to the current version. */
  onKeepCurrent?: () => void;
  /** Deletes the recipe being edited (its owner only); asked to confirm first. */
  onDelete?: () => void;
  /** Shows a message, e.g. "Step removed" with Undo. */
  onToast?: (message: string, action?: ToastAction) => void;
  language?: Language;
  t: UiTranslations;
}

/**
 * The recipe editor: a page that opens out of the button that asked for it, laid out like the
 * recipe page it makes. Mount only while open, keyed by recipe (and restored version), so each
 * opening starts from loadInitialForm().
 */
export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  onClose,
  animateIn = true,
  origin,
  onSave,
  initialRecipe,
  draft,
  onSaveDraft,
  onDiscardDraft,
  versions = [],
  restore,
  onPickVersion,
  onKeepCurrent,
  onDelete,
  onToast = () => {},
  language = 'en',
  t,
}) => {
  const isEditMode = Boolean(initialRecipe);
  // Closing folds the page back into the button it came from; saving lets it sink away.
  const [exit, setExit] = useState<'cancel' | 'save'>('cancel');
  const { ref: layerRef, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const currentUser = useCurrentUser();

  const [initial] = useState(() => loadInitialForm(initialRecipe, draft, t));
  // What a save to the vault is compared against to tell a text edit: the recipe as the family
  // sees it, even when the form opened on a draft of it.
  const [publishedText] = useState(() =>
    draft && initialRecipe ? formText(formFromRecipe(initialRecipe, legacyLabels(t))) : null,
  );
  const [form, setForm] = useState<FormState>(initial.form);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(initial.fromDraft);
  // With nobody signed in there is no "me" to credit, so the author is always typed.
  const authorMode = currentUser ? form.authorMode : 'custom';
  const initialNote = restore ? t.restoredNote(restore.version.version) : (draft?.changeNote ?? '');
  const [changeNote, setChangeNote] = useState(initialNote);
  // The version a draft of it becomes (the next, or 1 for a new recipe).
  const nextVersion = draftVersion(initialRecipe);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [previewing, setPreviewing] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  const [scroll, setScroll] = useState({ tucked: false, scrolled: false });
  const lastScrollTop = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nextChangeIndex = useRef(0);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const changes = restore?.changes;
  const restoredClass = (field: RestorableField) =>
    changes?.fields.has(field) ? ' is-restored' : '';
  const restoredChip = (field: RestorableField) =>
    changes?.fields.has(field) && <span className="restored-chip">{t.restoredChip}</span>;

  // --- Kept on this phone (create mode) ---------------------------------------------------

  // A new recipe not yet saved anywhere is kept on this phone as it's typed, so closing the app
  // by accident loses nothing. Not while a saved draft is open: that has its own place.
  const keptOnPhone = !isEditMode && !draft;

  // Draft JSON waiting on the 400ms debounce. Flushed on close so the last keystrokes
  // aren't lost; cleared when the form is emptied, submitted or the draft is discarded.
  const pendingDraft = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (pendingDraft.current !== null) writeDraft(pendingDraft.current);
    },
    [],
  );
  const draftWorthy = keptOnPhone && hasContent({ ...form, authorMode });
  useEffect(() => {
    if (!keptOnPhone) return;
    if (!draftWorthy) {
      pendingDraft.current = null;
      return;
    }
    const json = JSON.stringify({ ...form, authorMode });
    pendingDraft.current = json;
    const timeout = window.setTimeout(() => {
      writeDraft(json);
      pendingDraft.current = null;
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [keptOnPhone, draftWorthy, form, authorMode]);

  // --- Checking and saving ----------------------------------------------------------------

  const errorsOf = (): Partial<Record<FieldError, string>> => {
    const errors: Partial<Record<FieldError, string>> = {};
    if (!form.title.trim()) errors.title = t.titleRequired;
    if (authorMode === 'custom' && !form.author.trim()) errors.author = t.authorRequired;
    // An older recipe saved before categories can still be edited; it stays under Other.
    if (!isEditMode && !form.category) errors.category = t.categoryRequired;
    if (!ingredientRowsOnly(form.ingredientRows).some((r) => r.name.trim() || r.amount.trim())) {
      errors.ingredients = t.ingredientsRequired;
    }
    if (methodToSteps(form.sections, form.numberFrom).length === 0) errors.steps = t.stepsRequired;
    return errors;
  };
  const errors = showErrors ? errorsOf() : {};

  // The recipe as it would be saved now: for saving, and for the preview.
  const recipeFromForm = (): Omit<Recipe, 'id' | 'createdAt'> => {
    const content = formToRecipe(form);
    return {
      ...content,
      author: resolveAuthor(authorMode, form.author, currentUser),
      authorMode,
      // The form requires a pick; an older record keeps what it had until one is made.
      category: content.category || initialRecipe?.category || 'other',
      baseYield: initialRecipe?.baseYield ?? 1,
    };
  };

  const close = (how: 'cancel' | 'save') => {
    setExit(how);
    requestClose();
  };

  const save = () => {
    if (Object.keys(errorsOf()).length > 0) {
      setShowErrors(true);
      // Brings the first problem into view, under the bar.
      requestAnimationFrame(() => {
        const first = bodyRef.current?.querySelector<HTMLElement>('.has-error');
        first?.scrollIntoView?.({
          block: 'center',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        first?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: true });
      });
      return;
    }
    const textChanged = (publishedText ?? formText(initial.form)) !== formText(form);
    onSave(recipeFromForm(), initialRecipe?.id, textChanged, changeNote);
    forgetKeptCopy();
    // Not reset: the form keeps its content while it sinks away, then unmounts.
    close('save');
  };

  // A draft keeps the form as it is, finished or not: no checks.
  const saveDraft = () => {
    if (!onSaveDraft) return;
    const content = formToRecipe(form);
    onSaveDraft(
      {
        ...content,
        author: resolveAuthor(authorMode, form.author, currentUser),
        authorMode,
        baseYield: initialRecipe?.baseYield ?? 1,
      },
      changeNote,
    );
    forgetKeptCopy();
    close('save');
  };

  // Saved somewhere for real (or let go), so the copy kept on this phone goes.
  const forgetKeptCopy = () => {
    if (!keptOnPhone) return;
    pendingDraft.current = null;
    clearDraft();
  };

  // With drafts, Save offers its two choices; without, it saves to the vault.
  const requestSave = () => {
    if (onSaveDraft) setSaveMenuOpen(!saveMenuOpen);
    else save();
  };

  // Changed since it opened: an edit or a draft from how it was, a new recipe from empty.
  const isDirty = () =>
    isEditMode || draft
      ? JSON.stringify([formToRecipe(form), authorMode, form.author.trim(), changeNote]) !==
        JSON.stringify([
          formToRecipe(initial.form),
          currentUser ? initial.form.authorMode : 'custom',
          initial.form.author.trim(),
          initialNote,
        ])
      : hasContent({ ...form, authorMode });
  // Closing with changes offers to keep them as a draft. Without drafts, an edit asks before
  // its changes go, and a new recipe stays kept on this phone.
  const requestCancel = () => {
    if (!isDirty()) close('cancel');
    else if (onSaveDraft) setSheet('leave');
    else if (isEditMode) setSheet('discard');
    else close('cancel');
  };
  // Escape and the phone's back gesture close it like the ✕ (asking first when there are
  // changes); sheets and menus opened over it take them for themselves.
  useDialogDismiss(requestCancel);
  useBackStep(true, () => requestCancel());

  // --- Pasting ----------------------------------------------------------------------------

  // Pasted text: the ingredient list, the steps, or both at once.
  const addPasted = (text: Record<PasteTarget, string>) => {
    const rows = pastedIngredients(text.ingredients);
    const method = pastedMethod(text.steps);
    const ingredientCount = ingredientRowsOnly(rows).length;
    const stepCount = pastedStepCount(method);
    if (rows.length === 0 && stepCount === 0) return;
    setForm((f) => {
      const blank = f.ingredientRows.every((r) => !r.name.trim() && !r.amount.trim());
      return {
        ...f,
        ingredientRows:
          rows.length === 0 ? f.ingredientRows : blank ? rows : [...f.ingredientRows, ...rows],
        sections: stepCount > 0 ? addPastedMethod(f.sections, method) : f.sections,
      };
    });
    onToast(
      ingredientCount > 0 && stepCount > 0
        ? t.pastedBoth(ingredientCount, stepCount)
        : stepCount > 0
          ? t.pastedSteps(stepCount)
          : t.pastedIngredients(ingredientCount),
    );
  };

  // A recipe page's address: the form is filled in from the page, and its picture follows. Each
  // import is numbered, so one that's closed or overtaken fills in nothing when it lands.
  const importRun = useRef(0);
  const [photoLoading, setPhotoLoading] = useState(false);
  const pagePending = useRef(false);
  const latestPhoto = useRef(0);
  const importFromWebsite = async (url: string): Promise<ImportProblem | null> => {
    const run = ++importRun.current;
    let page: ImportedPage | null;
    pagePending.current = true;
    try {
      page = readImportedPage(await fetchRecipePage(url));
    } catch (error) {
      return error instanceof ImportError ? error.reason : 'failed';
    } finally {
      if (run === importRun.current) pagePending.current = false;
    }
    if (run !== importRun.current) return null;
    // A number of servings is worded in the page's language when it's one of the family's.
    const pageLanguage = page?.lang.slice(0, 2).toLowerCase();
    const words = pageLanguage === 'en' || pageLanguage === 'pl' ? UI_TEXT[pageLanguage] : t;
    const imported = page && recipeFromPage(page, { servings: words.importServings });
    if (!imported) return 'noRecipe';

    setForm(imported.form);
    setShowErrors(false);
    bodyRef.current?.scrollTo?.({ top: 0 });
    onToast(
      imported.amountsMissing
        ? t.importDoneNoAmounts
        : imported.guessed
          ? t.importDoneGuessed
          : t.importDone,
    );
    setPhotoLoading(Boolean(imported.imageUrl));
    // The photo answers to the recipe now in the form, not to later attempts that fill nothing.
    const photoRun = ++latestPhoto.current;
    if (imported.imageUrl) {
      void fetchRecipePhoto(imported.imageUrl).then((photo) => {
        if (photoRun !== latestPhoto.current) return;
        setPhotoLoading(false);
        if (!photo) {
          onToast(t.importPhotoFailed);
          return;
        }
        // Only into the recipe it belongs to, and never over a photo picked meanwhile.
        setForm((f) =>
          f.sourceUrl === imported.form.sourceUrl ? { ...f, heroImage: f.heroImage || photo } : f,
        );
      });
    }
    return null;
  };
  // Closing the editor lets go of an import still on its way.
  useEffect(
    () => () => {
      importRun.current = -1;
      latestPhoto.current = -1;
    },
    [],
  );

  // --- Version restore --------------------------------------------------------------------

  // Brings the next highlighted field into view, cycling through them.
  const showNextChange = () => {
    const highlighted = bodyRef.current?.querySelectorAll<HTMLElement>('.is-restored');
    if (!highlighted?.length) return;
    const target = highlighted[nextChangeIndex.current % highlighted.length];
    nextChangeIndex.current += 1;
    target.scrollIntoView?.({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  // --- The page -------------------------------------------------------------------------

  // The item under a tap or focus: its tools open, and any other's close. Only a finished tap or
  // focus counts, never a touch alone, so a scroll that starts on a step leaves it be.
  const activate = (target: EventTarget) => {
    const item = (target as Element).closest?.<HTMLElement>('[data-item-id]') ?? null;
    const id = item?.dataset.itemId ?? null;
    if (id === activeId) return;
    const scroller = bodyRef.current;
    const open = [...(scroller?.querySelectorAll<HTMLElement>('[data-item-id]') ?? [])].find(
      (el) => el.dataset.itemId === activeId,
    );
    // The open item's tools fold away above what was tapped: keep that under the finger.
    if (scroller && open && open.compareDocumentPosition(target as Node) & 4) {
      keepStillBelow(scroller, open);
    }
    setActiveId(id);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const delta = top - lastScrollTop.current;
    lastScrollTop.current = top;
    // Down past the bar tucks the tools away; any scroll up brings them back.
    const tucked = delta > 4 && top > barHeight ? true : delta < -4 ? false : scroll.tucked;
    const scrolled = top > 2;
    if (tucked !== scroll.tucked || scrolled !== scroll.scrolled) setScroll({ tucked, scrolled });
  };

  const estimate = estimateRecipeMinutes({ steps: methodToSteps(form.sections, form.numberFrom) });
  // How far the opening circle must grow to cover the screen: to the corner farthest from it.
  const reach = origin
    ? Math.ceil(
        Math.hypot(
          Math.max(origin.x, window.innerWidth - origin.x),
          Math.max(origin.y, window.innerHeight - origin.y),
        ),
      )
    : null;
  let rise = 0;
  const riseStyle = () => ({ '--i': rise++ }) as React.CSSProperties;

  return (
    <div
      ref={layerRef}
      className={`editor-layer${animateIn ? '' : ' is-instant'}${isClosing ? ' is-closing' : ''}`}
      data-exit={exit}
      id="addRecipeModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editorTitle"
      style={
        {
          '--editor-origin-x': origin ? `${origin.x}px` : '50%',
          '--editor-origin-y': origin ? `${origin.y}px` : '100%',
          '--editor-reach': reach ? `${reach}px` : '150vmax',
          '--editor-bar-height': `${barHeight}px`,
        } as React.CSSProperties
      }
    >
      <EditorBar
        isEditMode={isEditMode}
        version={initialRecipe?.version ?? 1}
        draftLabel={draft ? t.draftLabel(nextVersion) : undefined}
        hasVersions={Boolean(onPickVersion) && versions.length > 0}
        versionsOpen={versionsOpen}
        onToggleVersions={() => setVersionsOpen(!versionsOpen)}
        status={
          draft
            ? t.draftLabel(nextVersion)
            : hasRestoredDraft
              ? t.draftRestored
              : draftWorthy
                ? t.draftSaved
                : null
        }
        tucked={scroll.tucked}
        scrolled={scroll.scrolled}
        onClose={requestCancel}
        onSave={requestSave}
        saveMenuOpen={saveMenuOpen}
        saveMenu={
          onSaveDraft && (
            <SaveMenu
              version={isEditMode ? nextVersion : null}
              draftVersion={nextVersion}
              onSaveToVault={save}
              onSaveDraft={saveDraft}
              onClose={() => setSaveMenuOpen(false)}
              t={t}
            />
          )
        }
        // Pasting is for starting a recipe; an edit changes what's there.
        onPaste={isEditMode ? undefined : () => setSheet('paste')}
        onPreview={() => setPreviewing(true)}
        onStartOver={hasRestoredDraft && keptOnPhone ? () => setSheet('startOver') : undefined}
        onDiscardDraft={draft && onDiscardDraft ? () => setSheet('discardDraft') : undefined}
        onHeight={setBarHeight}
        t={t}
      >
        {versionsOpen && onPickVersion && (
          <VersionMenu
            current={{
              version: initialRecipe?.version ?? 1,
              savedAt: initialRecipe?.updatedAt ?? initialRecipe?.createdAt ?? 0,
              note: initialRecipe?.changeNote,
            }}
            versions={versions}
            shownId={restore?.version.id}
            language={language}
            onPick={onPickVersion}
            onClose={() => setVersionsOpen(false)}
            t={t}
          />
        )}
      </EditorBar>

      <div
        className="editor-scroll"
        ref={bodyRef}
        onScroll={handleScroll}
        onFocus={(e) => activate(e.target)}
        // A touch that turns into a scroll ends in pointercancel, never pointerup.
        onPointerUp={(e) => activate(e.target)}
      >
        <div className="editor-body">
          {restore && (
            <div className="restore-banner" role="status">
              <RotateCcw size="1.1em" strokeWidth={2} aria-hidden="true" />
              <div className="restore-banner-text">
                <strong>
                  {t.restoredFrom(
                    restore.version.version,
                    formatVersionDate(restore.version.savedAt, language),
                  )}
                </strong>
                <span>
                  {restore.changes.count > 0 ? t.changesCount(restore.changes.count) : t.noChanges}
                </span>
              </div>
              <div className="restore-banner-actions">
                {restore.changes.count > 0 && (
                  <button type="button" className="btn btn-meta-pill" onClick={showNextChange}>
                    {t.nextChange}
                    <ChevronDown size="1em" aria-hidden="true" />
                  </button>
                )}
                <button type="button" className="btn btn-meta-pill" onClick={onKeepCurrent}>
                  {t.keepCurrent}
                </button>
              </div>
            </div>
          )}

          {/* Title */}
          <div
            className={`form-group editor-rise${restoredClass('name')}${errors.title ? ' has-error' : ''}`}
            style={riseStyle()}
          >
            {restoredChip('name')}
            <label className="form-label" htmlFor="recipeTitleInput">
              {t.recipeTitle}
            </label>
            <input
              className="form-control editor-title-input"
              type="text"
              id="recipeTitleInput"
              required
              autoComplete="off"
              aria-invalid={Boolean(errors.title) || undefined}
              aria-describedby={errors.title ? 'recipeTitleError' : undefined}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
            {errors.title && (
              <p className="field-error" id="recipeTitleError" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* Photo, as the recipe page opens with it */}
          <div
            className={`form-group editor-rise${restoredClass('heroImage')}`}
            style={riseStyle()}
          >
            {restoredChip('heroImage')}
            <div className="form-label-row">
              <span className="form-label" id="heroPhotoLabel">
                {t.heroPhoto}
              </span>
              <span className="form-optional" aria-hidden="true">
                {t.optional}
              </span>
            </div>
            <HeroPhotoField
              photo={form.heroImage}
              onChange={(photo) => set('heroImage', photo)}
              loading={photoLoading}
              labelId="heroPhotoLabel"
              t={t}
            />
          </div>

          {/* Author: the signed-in family member, or someone else by name */}
          <fieldset
            className={`form-group author-field editor-rise${restoredClass('author')}${errors.author ? ' has-error' : ''}`}
            style={riseStyle()}
          >
            {restoredChip('author')}
            <legend className="form-label">{t.authorLabel}</legend>
            {currentUser && (
              <div className="choice-pill" data-value={authorMode === 'auto' ? 'first' : 'other'}>
                <span className="choice-pill-thumb" aria-hidden="true" />
                {(['auto', 'custom'] as const).map((mode) => (
                  <label key={mode} className={authorMode === mode ? 'is-active' : ''}>
                    <input
                      type="radio"
                      name="authorMode"
                      value={mode}
                      checked={authorMode === mode}
                      onChange={() => set('authorMode', mode)}
                    />
                    {mode === 'auto' ? shortName(currentUser.name) : t.authorSomeoneElse}
                  </label>
                ))}
              </div>
            )}
            {authorMode === 'auto' && currentUser ? (
              <p className="author-hint">{t.authorShownAs(currentUser.name)}</p>
            ) : (
              <div className="author-custom">
                <label className="form-label is-small" htmlFor="recipeAuthorInput">
                  {t.authorNameLabel}
                </label>
                <input
                  className="form-control"
                  type="text"
                  id="recipeAuthorInput"
                  required
                  autoComplete="off"
                  aria-invalid={Boolean(errors.author) || undefined}
                  aria-describedby={errors.author ? 'recipeAuthorError' : undefined}
                  value={form.author}
                  onChange={(e) => set('author', e.target.value)}
                />
                {errors.author && (
                  <p className="field-error" id="recipeAuthorError" role="alert">
                    {errors.author}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          {/* Category: what the vault's filter sorts it under */}
          <div
            className={`form-group editor-rise${errors.category ? ' has-error' : ''}`}
            style={riseStyle()}
          >
            <CategorySelect
              value={form.category}
              onChange={(category) => set('category', category)}
              error={errors.category}
              t={t}
            />
          </div>

          {/* Description */}
          <div
            className={`form-group editor-rise${restoredClass('cardDescription')}`}
            style={riseStyle()}
          >
            {restoredChip('cardDescription')}
            <div className="form-label-row">
              <label className="form-label" htmlFor="recipeDescInput">
                {t.descriptionLabel}
              </label>
              <span className="form-optional" aria-hidden="true">
                {t.optional}
              </span>
            </div>
            <AutoGrowTextarea
              id="recipeDescInput"
              value={form.cardDescription}
              onChange={(e) => set('cardDescription', e.target.value)}
            />
          </div>

          {/* Recipe time: worked out from the steps, or set by hand */}
          <div className={`form-group editor-rise${restoredClass('time')}`} style={riseStyle()}>
            {restoredChip('time')}
            <RecipeTimeField
              manualMinutes={form.manualMinutes}
              estimate={estimate}
              onChange={(minutes) => set('manualMinutes', minutes)}
              t={t}
            />
          </div>

          <div
            className={`editor-rise${errors.ingredients ? ' has-error' : ''}`}
            style={riseStyle()}
          >
            <IngredientEditor
              rows={form.ingredientRows}
              onChange={(change) =>
                setForm((f) => ({ ...f, ingredientRows: change(f.ingredientRows) }))
              }
              yieldHeader={form.yieldHeader}
              onYieldChange={(value) => set('yieldHeader', value)}
              activeId={activeId}
              restoredRows={changes?.ingredients}
              restoredYield={changes?.fields.has('yieldHeader')}
              error={errors.ingredients}
              onToast={onToast}
              t={t}
            />
          </div>

          {/* Kitchen tip and crucial note, styled as the recipe page shows them */}
          <div
            className={`form-group editor-callout is-tip editor-rise${restoredClass('tips')}`}
            style={riseStyle()}
          >
            {restoredChip('tips')}
            <div className="form-label-row">
              <label className="callout-label" htmlFor="recipeTipsInput">
                <Lightbulb size="1.15em" aria-hidden="true" />
                {t.kitchenTip}
              </label>
              <span className="form-optional" aria-hidden="true">
                {t.optional}
              </span>
            </div>
            <AutoGrowTextarea
              id="recipeTipsInput"
              value={form.tips}
              onChange={(e) => set('tips', e.target.value)}
            />
          </div>

          <div
            className={`form-group editor-callout is-warn editor-rise${restoredClass('notes')}`}
            style={riseStyle()}
          >
            {restoredChip('notes')}
            <div className="form-label-row">
              <label className="callout-label" htmlFor="recipeNotesInput">
                <TriangleAlert size="1.15em" aria-hidden="true" />
                {t.crucialNote}
              </label>
              <span className="form-optional" aria-hidden="true">
                {t.optional}
              </span>
            </div>
            <AutoGrowTextarea
              id="recipeNotesInput"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          <div className={`editor-rise${errors.steps ? ' has-error' : ''}`} style={riseStyle()}>
            <MethodEditor
              sections={form.sections}
              onChange={(change) => setForm((f) => ({ ...f, sections: change(f.sections) }))}
              numberFrom={form.numberFrom}
              activeId={activeId}
              restoredSteps={changes?.steps}
              error={errors.steps}
              onToast={onToast}
              t={t}
            />
          </div>

          {/* What changed: kept with this version in its history */}
          {isEditMode && (
            <div className="form-group change-note">
              <div className="form-label-row">
                <label className="form-label" htmlFor="recipeChangeNoteInput">
                  {t.changeNoteLabel(initialRecipe?.version ?? 1)}
                </label>
                <span className="form-optional" aria-hidden="true">
                  {t.optional}
                </span>
              </div>
              <input
                className="form-control"
                type="text"
                id="recipeChangeNoteInput"
                maxLength={200}
                autoComplete="off"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
              />
            </div>
          )}

          {isEditMode && onDelete && (
            <div className="delete-recipe-zone">
              <button
                type="button"
                className="btn btn-danger-quiet"
                onClick={() => setSheet('delete')}
              >
                <Trash2 size="1em" aria-hidden="true" />
                {t.deleteRecipe}
              </button>
            </div>
          )}
        </div>
      </div>

      {previewing && (
        <EditorPreview
          recipe={{
            ...recipeFromForm(),
            id: initialRecipe?.id ?? 'preview',
            ownerEmail: initialRecipe?.ownerEmail ?? currentUser?.email,
            ownerName: initialRecipe?.ownerName ?? currentUser?.name,
            createdAt: initialRecipe?.createdAt,
          }}
          language={language}
          onClose={() => setPreviewing(false)}
          t={t}
        />
      )}

      {sheet === 'paste' && (
        <PasteSheet
          onAdd={addPasted}
          onImport={isRecipeImportAvailable ? importFromWebsite : undefined}
          replaces={hasContent({ ...form, authorMode })}
          onClose={() => {
            // Closed while a page was still being read: that page fills in nothing.
            if (pagePending.current) {
              pagePending.current = false;
              importRun.current += 1;
            }
            setSheet(null);
          }}
          t={t}
        />
      )}
      {sheet === 'discard' && (
        <ConfirmSheet
          title={t.discardTitle}
          message={t.discardBody}
          confirmLabel={t.discard}
          cancelLabel={t.keepEditing}
          danger
          onConfirm={() => close('cancel')}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'leave' && (
        <ConfirmSheet
          title={t.leaveTitle}
          message={t.leaveBody}
          alternative={{ label: t.saveDraft(nextVersion), onSelect: saveDraft }}
          confirmLabel={t.discard}
          cancelLabel={t.keepEditing}
          danger
          onConfirm={() => {
            forgetKeptCopy();
            close('cancel');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'discardDraft' && onDiscardDraft && (
        <ConfirmSheet
          title={t.discardDraft}
          message={t.discardDraftBody}
          confirmLabel={t.discardDraft}
          cancelLabel={t.keepEditing}
          danger
          onConfirm={() => {
            onDiscardDraft();
            close('cancel');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'delete' && onDelete && (
        <ConfirmSheet
          title={t.deleteRecipe}
          message={t.confirmDeleteRecipe(initialRecipe?.name ?? '')}
          confirmLabel={t.deleteRecipe}
          cancelLabel={t.cancel}
          danger
          onConfirm={onDelete}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'startOver' && (
        <ConfirmSheet
          title={t.startOver}
          message={t.confirmClearDraft}
          confirmLabel={t.startOver}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            pendingDraft.current = null;
            clearDraft();
            setForm(emptyForm());
            setHasRestoredDraft(false);
            setShowErrors(false);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
};
