import React, { useState, useEffect, useRef } from 'react';
import { Recipe, Ingredient, Step } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { ImagePickerWithPreview } from './ImagePickerWithPreview';
import { IngredientBuilder, IngredientRowState } from './IngredientBuilder';
import { StepBuilder, StepBuilderItem } from './StepBuilder';

const DRAFT_STORAGE_KEY = 'family_kitchen_recipe_draft';

interface FormState {
  title: string;
  author: string;
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
  author: '',
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
    return {
      title: initialRecipe.name || '',
      author: initialRecipe.author || '',
      cardDescription: initialRecipe.cardDescription || '',
      yieldHeader: initialRecipe.yieldHeader || EMPTY_FORM.yieldHeader,
      heroImage: initialRecipe.heroImage || '',
      tips: initialRecipe.tips || '',
      notes: initialRecipe.notes || '',
      ingredientRows:
        initialRecipe.ingredients && initialRecipe.ingredients.length > 0
          ? initialRecipe.ingredients.map((ing, idx) => {
              const raw = ing.text || '';
              let name = ing.name || '';
              let amount = '';
              if (!name && raw.includes(' - ')) {
                const parts = raw.split(' - ');
                name = parts[0].trim();
                amount = parts.slice(1).join(' - ').trim();
              } else if (!name) {
                name = raw;
              } else if (ing.qty !== undefined && ing.qty !== null) {
                amount = `${ing.qty} ${ing.unit || ''}`.trim();
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
        author: parsed.author || '',
        cardDescription: parsed.cardDescription || '',
        yieldHeader: parsed.yieldHeader || EMPTY_FORM.yieldHeader,
        heroImage: parsed.heroImage || '',
        tips: parsed.tips || '',
        notes: parsed.notes || '',
        ingredientRows: parsed.ingredientRows?.length > 0 ? parsed.ingredientRows : EMPTY_FORM.ingredientRows,
        steps: parsed.steps?.length > 0 ? parsed.steps : EMPTY_FORM.steps,
        hasRestoredDraft: true,
      };
    }
  } catch {
    // Ignore draft parse failure
  }

  return EMPTY_FORM;
}

interface AddRecipeModalProps {
  onClose: () => void;
  onSave: (recipeData: Omit<Recipe, 'id' | 'createdAt'>, existingId?: string) => void;
  initialRecipe?: Recipe | null;
  t: UiTranslations;
}

// Mount only while open, keyed by recipe, so each opening starts from loadInitialForm().
export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  onClose,
  onSave,
  initialRecipe,
  t,
}) => {
  const isEditMode = Boolean(initialRecipe);

  const [initial] = useState(() => loadInitialForm(initialRecipe));
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [cardDescription, setCardDescription] = useState(initial.cardDescription);
  const [yieldHeader, setYieldHeader] = useState(initial.yieldHeader);
  const [heroImage, setHeroImage] = useState<string>(initial.heroImage);
  const [ingredientRows, setIngredientRows] = useState<IngredientRowState[]>(initial.ingredientRows);
  const [tips, setTips] = useState(initial.tips);
  const [notes, setNotes] = useState(initial.notes);
  const [steps, setSteps] = useState<StepBuilderItem[]>(initial.steps);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(initial.hasRestoredDraft);

  const resetForm = () => {
    setTitle(EMPTY_FORM.title);
    setAuthor(EMPTY_FORM.author);
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
  const draftSaveTimeout = useRef<number | null>(null);
  useEffect(() => {
    if (isEditMode) return;

    if (draftSaveTimeout.current) {
      window.clearTimeout(draftSaveTimeout.current);
    }

    draftSaveTimeout.current = window.setTimeout(() => {
      // Only save if there's some content
      const hasContent =
        title.trim() ||
        author.trim() ||
        ingredientRows.some((r) => r.name.trim()) ||
        steps.some((s) => s.text.trim());

      if (hasContent) {
        const draftData = {
          title,
          author,
          cardDescription,
          yieldHeader,
          heroImage,
          tips,
          notes,
          ingredientRows,
          steps,
        };
        try {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
        } catch {
          // localStorage full or restricted
        }
      }
    }, 400);

    return () => {
      if (draftSaveTimeout.current) {
        window.clearTimeout(draftSaveTimeout.current);
      }
    };
  }, [
    isEditMode,
    title,
    author,
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
      author: author.trim(),
      category: initialRecipe?.category || 'family',
      isDefault: initialRecipe?.isDefault ?? false,
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

    onSave(recipeData, initialRecipe?.id);

    // Clear draft upon successful save
    if (!isEditMode) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    resetForm();
    onClose();
  };

  return (
    <div
      className="modal-overlay active"
      id="addRecipeModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
      onClick={onClose}
    >
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Sticky Header */}
        <div className="modal-header-sticky">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 className="modal-title" id="modalTitle">
              {isEditMode
                ? t.editRecipeTitle(initialRecipe?.version || 1)
                : t.addRecipe}
            </h2>
            {hasRestoredDraft && !isEditMode && (
              <span className="draft-badge" title="Restored from previous session">
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
            <button
              className="btn btn-icon"
              id="closeModalBtn"
              aria-label="Close modal"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <form
          id="addRecipeForm"
          onSubmit={handleSubmit}
          style={{ display: 'contents' }}
        >
          <div className="modal-body-scroll">
            {/* Title */}
            <div className="form-group">
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
                placeholder="e.g., Grandma's Sourdough"
              />
            </div>

            {/* Author */}
            <div className="form-group">
              <label className="form-label" htmlFor="recipeAuthorInput">
                {t.authorContributor}
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeAuthorInput"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g., Wanda G."
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="recipeDescInput">
                Description (Optional)
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeDescInput"
                value={cardDescription}
                onChange={(e) => setCardDescription(e.target.value)}
                placeholder="e.g., A delicious heirloom family favorite passed down for generations."
              />
            </div>

            {/* Yield Header */}
            <div className="form-group">
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
                placeholder="e.g., For 1 loaf: or Serves 4:"
              />
            </div>

            {/* Hero Photo Picker with Thumbnail & Delete X */}
            <div className="form-group">
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
              t={t}
            />

            {/* Kitchen Tip (Moved above steps) */}
            <div className="form-group">
              <label className="form-label" htmlFor="recipeTipsInput">
                💡 {t.tipsOptional}
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeTipsInput"
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                placeholder="e.g., Use non-stick spatula or similar for handling dough."
              />
            </div>

            {/* Crucial Notes / Warnings (Moved ABOVE Steps to match viewing view) */}
            <div className="form-group">
              <label className="form-label" htmlFor="recipeNotesInput">
                ⚠️ {t.notesOptional}
              </label>
              <input
                className="form-control"
                type="text"
                id="recipeNotesInput"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Will not work in an air fryer."
              />
            </div>

            {/* Interactive Step Builder with Step Notes & Pictures */}
            <StepBuilder steps={steps} onChange={setSteps} t={t} />
          </div>

          {/* Sticky Footer */}
          <div className="modal-footer-sticky">
            <button
              type="button"
              className="btn"
              id="cancelModalBtn"
              onClick={onClose}
            >
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditMode ? t.saveChanges : t.saveToVault}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
