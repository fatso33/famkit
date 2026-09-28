import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, History, RotateCcw, Trash2 } from 'lucide-react';
import {
  Recipe,
  Ingredient,
  Step,
  AuthorMode,
  Language,
  RecipeCategory,
  VersionSummary,
} from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { ImagePickerWithPreview } from './ImagePickerWithPreview';
import { IngredientBuilder, IngredientRowState } from './IngredientBuilder';
import { StepBuilder, StepBuilderItem } from './StepBuilder';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useBlockBack } from '../../hooks/useBackStep';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { authorModeOf, resolveAuthor } from '../../utils/ownership';
import { formatVersionDate, RecipeChanges, RestorableField } from '../../utils/recipeVersions';
import { VersionHistorySheet } from './VersionHistorySheet';
import { CATEGORY_ICONS } from '../recipe-grid/vaultIcons';
import { RECIPE_CATEGORIES, isRecipeCategory } from '../../utils/vault';

const DRAFT_STORAGE_KEY = 'family_kitchen_recipe_draft';

function writeDraft(json: string) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, json);
  } catch {
    // localStorage full or restricted
  }
}

interface FormState {
  title: string;
  authorMode: AuthorMode;
  /** The typed name, used when the recipe is someone else's. */
  author: string;
  /** Empty until picked: a new recipe, or an older one saved before categories. */
  category: RecipeCategory | '';
  cardDescription: string;
  yieldHeader: string;
  heroImage: string;
  tips: string;
  notes: string;
  ingredientRows: IngredientRowState[];
  steps: StepBuilderItem[];
  hasRestoredDraft: boolean;
}

const EMPTY_FORM: FormState = {
  title: '',
  authorMode: 'auto',
  author: '',
  category: '',
  cardDescription: '',
  yieldHeader: 'For 1 loaf:',
  heroImage: '',
  tips: '',
  notes: '',
  ingredientRows: [{ id: 'ing-1', name: '', amount: '' }],
  steps: [{ id: 'step-1', text: '', notes: '', imageSrc: '', imageCaption: '' }],
  hasRestoredDraft: false,
};

// Initial form contents: the recipe being edited, else a saved create-mode draft, else empty.
function loadInitialForm(initialRecipe?: Recipe | null): FormState {
  if (initialRecipe) {
    const authorMode = authorModeOf(initialRecipe);
    return {
      title: initialRecipe.name || '',
      authorMode,
      author: authorMode === 'custom' ? initialRecipe.author || '' : '',
      category: isRecipeCategory(initialRecipe.category) ? initialRecipe.category : '',
      cardDescription: initialRecipe.cardDescription || '',
      yieldHeader: initialRecipe.yieldHeader || EMPTY_FORM.yieldHeader,
      heroImage: initialRecipe.heroImage || '',
      tips: initialRecipe.tips || '',
      notes: initialRecipe.notes || '',
      ingredientRows:
        initialRecipe.ingredients && initialRecipe.ingredients.length > 0
          ? initialRecipe.ingredients.map((ing, idx) => {
              const raw = ing.text || '';
              let name: string;
              let amount = '';
              if (ing.name && ing.qty !== undefined && ing.qty !== null) {
                name = ing.name;
                amount = `${ing.qty} ${ing.unit || ''}`.trim();
              } else if (raw.includes(' - ')) {
                // Also covers translated rows, which carry a name but no quantity field.
                const parts = raw.split(' - ');
                name = parts[0].trim();
                amount = parts.slice(1).join(' - ').trim();
              } else {
                name = raw || ing.name || '';
              }
              return { id: 'ing-' + idx, name, amount };
            })
          : EMPTY_FORM.ingredientRows,
      steps:
        initialRecipe.steps && initialRecipe.steps.length > 0
          ? initialRecipe.steps.map((st, idx) => ({
              id: 'step-' + idx,
              text: st.text || '',
              notes: st.notes || '',
              imageSrc: st.imageSrc || '',
              imageCaption: st.imageCaption || '',
            }))
          : EMPTY_FORM.steps,
      hasRestoredDraft: false,
    };
  }

  try {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      const parsed = JSON.parse(savedDraft);
      return {
        title: parsed.title || '',
        // Drafts from before the author choice only have a typed name.
        authorMode: parsed.authorMode ?? (parsed.author ? 'custom' : 'auto'),
        author: parsed.author || '',
        category: isRecipeCategory(parsed.category) ? parsed.category : '',
        cardDescription: parsed.cardDescription || '',
        yieldHeader: parsed.yieldHeader || EMPTY_FORM.yieldHeader,
        heroImage: parsed.heroImage || '',
        tips: parsed.tips || '',
        notes: parsed.notes || '',
        ingredientRows:
          parsed.ingredientRows?.length > 0 ? parsed.ingredientRows : EMPTY_FORM.ingredientRows,
        steps: parsed.steps?.length > 0 ? parsed.steps : EMPTY_FORM.steps,
        hasRestoredDraft: true,
      };
    }
  } catch {
    // Ignore draft parse failure
  }

  return EMPTY_FORM;
}

// The form's readable text, for telling a real text edit apart from a photo/author-only change.
function formText(form: Pick<FormState, TextField>): string {
  return JSON.stringify([
    form.title.trim(),
    form.cardDescription.trim(),
    form.yieldHeader.trim(),
    form.tips.trim(),
    form.notes.trim(),
    form.ingredientRows.map((r) => [r.name.trim(), r.amount.trim()]).filter(([n, a]) => n || a),
    form.steps
      .filter((s) => s.text.trim())
      .map((s) => [s.text.trim(), s.notes?.trim() || '', s.imageCaption?.trim() || '']),
  ]);
}

type TextField =
  'title' | 'cardDescription' | 'yieldHeader' | 'tips' | 'notes' | 'ingredientRows' | 'steps';

interface AddRecipeModalProps {
  onClose: () => void;
  /** False when it reopens on another version, which swaps the form in place. */
  animateIn?: boolean;
  /**
   * `textChanged` is false when an edit touched only photos or the author. `changeNote` is the
   * author's optional "what changed" (edits only).
   */
  onSave: (
    recipeData: Omit<Recipe, 'id' | 'createdAt'>,
    existingId: string | undefined,
    textChanged: boolean,
    changeNote: string,
  ) => void;
  initialRecipe?: Recipe | null;
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
  language?: Language;
  t: UiTranslations;
}

// Mount only while open, keyed by recipe (and restored version), so each opening starts from
// loadInitialForm().
export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  onClose,
  animateIn = true,
  onSave,
  initialRecipe,
  versions = [],
  restore,
  onPickVersion,
  onKeepCurrent,
  onDelete,
  language = 'en',
  t,
}) => {
  const isEditMode = Boolean(initialRecipe);
  // Every way of closing slides the editor away first; onClose runs once it's gone.
  const { ref: layerRef, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  const backdropProps = useDialogDismiss(requestClose);
  // A stray back swipe must not close the editor and lose the draft.
  useBlockBack();
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [changeNote, setChangeNote] = useState(() =>
    restore ? t.restoredNote(restore.version.version) : '',
  );
  const bodyRef = useRef<HTMLDivElement>(null);
  const nextChangeIndex = useRef(0);

  const changes = restore?.changes;
  const restoredClass = (field: RestorableField) =>
    changes?.fields.has(field) ? ' is-restored' : '';
  const restoredChip = (field: RestorableField) =>
    changes?.fields.has(field) && <span className="restored-chip">{t.restoredChip}</span>;

  // Brings the next highlighted field into view, cycling through them.
  const showNextChange = () => {
    const highlighted = bodyRef.current?.querySelectorAll<HTMLElement>('.is-restored');
    if (!highlighted?.length) return;
    const target = highlighted[nextChangeIndex.current % highlighted.length];
    nextChangeIndex.current += 1;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const [initial] = useState(() => loadInitialForm(initialRecipe));
  const [title, setTitle] = useState(initial.title);
  const currentUser = useCurrentUser();
  const [chosenAuthorMode, setAuthorMode] = useState<AuthorMode>(initial.authorMode);
  // With nobody signed in there is no "me" to credit, so the author is always typed.
  const authorMode: AuthorMode = currentUser ? chosenAuthorMode : 'custom';
  const [author, setAuthor] = useState(initial.author);
  const [category, setCategory] = useState<RecipeCategory | ''>(initial.category);
  const [cardDescription, setCardDescription] = useState(initial.cardDescription);
  const [yieldHeader, setYieldHeader] = useState(initial.yieldHeader);
  const [heroImage, setHeroImage] = useState<string>(initial.heroImage);
  const [ingredientRows, setIngredientRows] = useState<IngredientRowState[]>(
    initial.ingredientRows,
  );
  const [tips, setTips] = useState(initial.tips);
  const [notes, setNotes] = useState(initial.notes);
  const [steps, setSteps] = useState<StepBuilderItem[]>(initial.steps);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(initial.hasRestoredDraft);

  const resetForm = () => {
    setTitle(EMPTY_FORM.title);
    setAuthorMode(EMPTY_FORM.authorMode);
    setAuthor(EMPTY_FORM.author);
    setCategory(EMPTY_FORM.category);
    setCardDescription(EMPTY_FORM.cardDescription);
    setYieldHeader(EMPTY_FORM.yieldHeader);
    setHeroImage(EMPTY_FORM.heroImage);
    setTips(EMPTY_FORM.tips);
    setNotes(EMPTY_FORM.notes);
    setIngredientRows(EMPTY_FORM.ingredientRows);
    setSteps(EMPTY_FORM.steps);
    setHasRestoredDraft(false);
  };

  // Debounced auto-save draft to localStorage (only in create mode)
  // Draft JSON waiting on the 400ms debounce. Flushed on close so the last keystrokes
  // aren't lost; cleared when the form is emptied, submitted or the draft is discarded.
  const pendingDraft = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (pendingDraft.current !== null) writeDraft(pendingDraft.current);
    },
    [],
  );

  useEffect(() => {
    if (isEditMode) return;

    // Only save if there's some content
    const hasContent =
      title.trim() ||
      (authorMode === 'custom' && author.trim()) ||
      ingredientRows.some((r) => r.name.trim()) ||
      steps.some((s) => s.text.trim());
    if (!hasContent) {
      pendingDraft.current = null;
      return;
    }

    const json = JSON.stringify({
      title,
      authorMode,
      author,
      category,
      cardDescription,
      yieldHeader,
      heroImage,
      tips,
      notes,
      ingredientRows,
      steps,
    });
    pendingDraft.current = json;
    const timeout = window.setTimeout(() => {
      writeDraft(json);
      pendingDraft.current = null;
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [
    isEditMode,
    title,
    authorMode,
    author,
    category,
    cardDescription,
    yieldHeader,
    heroImage,
    tips,
    notes,
    ingredientRows,
    steps,
  ]);

  const handleClearDraft = () => {
    if (window.confirm(t.confirmClearDraft)) {
      pendingDraft.current = null;
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
      resetForm();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Map ingredient rows to Ingredient objects
    const finalIngredients: Ingredient[] = ingredientRows
      .filter((row) => row.name.trim() || row.amount.trim())
      .map((row) => {
        const n = row.name.trim();
        const a = row.amount.trim();
        if (n && a) {
          return { text: `${n} - ${a}` };
        } else if (n) {
          return { text: n };
        } else {
          return { text: a };
        }
      });

    // Map step rows to Step objects
    const finalSteps: Step[] = steps
      .filter((s) => s.text.trim())
      .map((s, idx) => ({
        num: idx + 1,
        text: s.text.trim(),
        notes: s.notes?.trim() || undefined,
        hasImage: Boolean(s.imageSrc),
        imageSrc: s.imageSrc || undefined,
        imageCaption: s.imageCaption?.trim() || undefined,
      }));

    const fallbackImage =
      'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=80';

    const recipeData: Omit<Recipe, 'id' | 'createdAt'> = {
      name: title.trim(),
      author: resolveAuthor(authorMode, author, currentUser),
      authorMode,
      // The form requires a pick; an older record keeps what it had until one is made.
      category: category || initialRecipe?.category || 'other',
      heroImage: heroImage || fallbackImage,
      yieldHeader: yieldHeader.trim() || 'For 1 loaf:',
      baseYield: initialRecipe?.baseYield ?? 1,
      cardDescription: cardDescription.trim() || undefined,
      ingredients: finalIngredients,
      tips: tips.trim() || undefined,
      notes: notes.trim() || undefined,
      steps: finalSteps,
      laminationDirective: initialRecipe?.laminationDirective,
      bakingOptions: initialRecipe?.bakingOptions,
    };

    const textChanged =
      formText(initial) !==
      formText({ title, cardDescription, yieldHeader, tips, notes, ingredientRows, steps });
    onSave(recipeData, initialRecipe?.id, textChanged, changeNote);

    // Clear draft upon successful save
    if (!isEditMode) {
      pendingDraft.current = null;
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    // Not reset: the form keeps its content while it slides away, then unmounts.
    requestClose();
  };

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      ref={layerRef}
      className={`modal-overlay active${animateIn ? '' : ' is-instant'}${isClosing ? ' is-closing' : ''}`}
      id="addRecipeModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
      {...backdropProps}
    >
      <div className="modal-sheet">
        {/* Sticky Header */}
        <div className="modal-header-sticky">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 className="modal-title" id="modalTitle">
              {isEditMode ? t.editRecipeTitle(initialRecipe?.version || 1) : t.addRecipe}
            </h2>
            {hasRestoredDraft && !isEditMode && (
              <span className="draft-badge" title={t.draftRestoredTooltip}>
                ✓ {t.draftRestored}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!isEditMode && hasRestoredDraft && (
              <button
                type="button"
                className="btn"
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                }}
                onClick={handleClearDraft}
              >
                {t.clearDraft}
              </button>
            )}
            {isEditMode && onPickVersion && versions.length > 0 && (
              <button
                type="button"
                className="btn btn-icon"
                aria-label={t.versionHistory}
                title={t.versionHistory}
                onClick={() => setHistoryOpen(true)}
              >
                <History size="1.1em" strokeWidth={2} aria-hidden="true" />
              </button>
            )}
            <button
              className="btn btn-icon"
              id="closeModalBtn"
              aria-label={t.closeDialog}
              onClick={requestClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <form id="addRecipeForm" onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modal-body-scroll" ref={bodyRef}>
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
                    {restore.changes.count > 0
                      ? t.changesCount(restore.changes.count)
                      : t.noChanges}
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
            <div className={`form-group${restoredClass('name')}`}>
              {restoredChip('name')}
              <label className="form-label" htmlFor="recipeTitleInput">
                {t.recipeTitle}
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeTitleInput"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Author: the signed-in family member, or someone else by name */}
            <fieldset className={`form-group author-field${restoredClass('author')}`}>
              {restoredChip('author')}
              <legend className="form-label">{t.authorLabel}</legend>
              {currentUser && (
                <div className="author-choice" data-value={authorMode}>
                  <span className="author-choice-thumb" aria-hidden="true" />
                  {(['auto', 'custom'] as const).map((mode) => (
                    <label key={mode} className={authorMode === mode ? 'is-active' : ''}>
                      <input
                        type="radio"
                        name="authorMode"
                        value={mode}
                        checked={authorMode === mode}
                        onChange={() => setAuthorMode(mode)}
                      />
                      {mode === 'auto' ? t.authorMe : t.authorSomeoneElse}
                    </label>
                  ))}
                </div>
              )}
              {authorMode === 'auto' && currentUser ? (
                <p className="author-hint">{t.authorShownAs(currentUser.name)}</p>
              ) : (
                <div className="author-custom">
                  <label className="form-label" htmlFor="recipeAuthorInput">
                    {t.authorNameLabel}
                  </label>
                  <input
                    className="form-control"
                    type="text"
                    id="recipeAuthorInput"
                    required
                    autoComplete="off"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </div>
              )}
            </fieldset>

            {/* Category: what the vault's filter sorts it under. A new recipe must have one; an
                older one without can still be edited, and stays under Other until it gets one. */}
            <fieldset className="form-group category-field">
              <legend className="form-label">{t.categoryLabel}</legend>
              <div className="category-options">
                {RECIPE_CATEGORIES.map((option) => {
                  const Icon = CATEGORY_ICONS[option];
                  return (
                    <label
                      key={option}
                      className={`category-option${category === option ? ' is-active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="recipeCategory"
                        value={option}
                        required={!isEditMode}
                        checked={category === option}
                        onChange={() => setCategory(option)}
                      />
                      <Icon size="1.15em" strokeWidth={2} aria-hidden="true" />
                      <span>{t.recipeCategories[option]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Description */}
            <div className={`form-group${restoredClass('cardDescription')}`}>
              {restoredChip('cardDescription')}
              <label className="form-label" htmlFor="recipeDescInput">
                {t.descriptionOptional}
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeDescInput"
                value={cardDescription}
                onChange={(e) => setCardDescription(e.target.value)}
              />
            </div>

            {/* Yield Header */}
            <div className={`form-group${restoredClass('yieldHeader')}`}>
              {restoredChip('yieldHeader')}
              <label className="form-label" htmlFor="recipeYieldInput">
                {t.yieldHeader}
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeYieldInput"
                required
                value={yieldHeader}
                onChange={(e) => setYieldHeader(e.target.value)}
              />
            </div>

            {/* Hero Photo Picker with Thumbnail & Delete X */}
            <div className={`form-group${restoredClass('heroImage')}`}>
              {restoredChip('heroImage')}
              <ImagePickerWithPreview
                imageUrl={heroImage}
                onChange={setHeroImage}
                label={t.heroPhoto}
                helpText={t.photoOptionalHelp}
                idPrefix="recipeHero"
                t={t}
              />
            </div>

            {/* Interactive Row-by-Row Ingredients Builder */}
            <IngredientBuilder
              rows={ingredientRows}
              onChange={setIngredientRows}
              restoredRows={changes?.ingredients}
              t={t}
            />

            {/* Kitchen Tip (Moved above steps) */}
            <div className={`form-group${restoredClass('tips')}`}>
              {restoredChip('tips')}
              <label className="form-label" htmlFor="recipeTipsInput">
                💡 {t.tipsOptional}
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeTipsInput"
                value={tips}
                onChange={(e) => setTips(e.target.value)}
              />
            </div>

            {/* Crucial Notes / Warnings (Moved ABOVE Steps to match viewing view) */}
            <div className={`form-group${restoredClass('notes')}`}>
              {restoredChip('notes')}
              <label className="form-label" htmlFor="recipeNotesInput">
                ⚠️ {t.notesOptional}
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeNotesInput"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Interactive Step Builder with Step Notes & Pictures */}
            <StepBuilder steps={steps} onChange={setSteps} restoredSteps={changes?.steps} t={t} />

            {/* What changed: kept with this version in its history */}
            {isEditMode && (
              <div className="form-group change-note">
                <label className="form-label" htmlFor="recipeChangeNoteInput">
                  {t.changeNoteLabel}
                </label>
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
                  onClick={() => {
                    if (window.confirm(t.confirmDeleteRecipe(initialRecipe?.name ?? ''))) {
                      onDelete();
                    }
                  }}
                >
                  <Trash2 size="1em" aria-hidden="true" />
                  {t.deleteRecipe}
                </button>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="modal-footer-sticky">
            <button type="button" className="btn" id="cancelModalBtn" onClick={requestClose}>
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditMode ? t.saveChanges : t.saveToVault}
            </button>
          </div>
        </form>
      </div>

      {isHistoryOpen && onPickVersion && (
        <VersionHistorySheet
          current={{
            version: initialRecipe?.version ?? 1,
            savedAt: initialRecipe?.updatedAt ?? initialRecipe?.createdAt ?? 0,
            note: initialRecipe?.changeNote,
          }}
          versions={versions}
          shownId={restore?.version.id}
          language={language}
          onPick={onPickVersion}
          onClose={() => setHistoryOpen(false)}
          t={t}
        />
      )}
    </div>
  );
};
