import React, { useState } from 'react';
import { Recipe } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => void;
  t: UiTranslations;
}

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  t,
}) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [cardDescription, setCardDescription] = useState('');
  const [yieldHeader, setYieldHeader] = useState('For 1 loaf:');
  const [rawIngredients, setRawIngredients] = useState('');
  const [rawSteps, setRawSteps] = useState('');
  const [tips, setTips] = useState('');
  const [notes, setNotes] = useState('');
  const [heroImage, setHeroImage] = useState<string>('');

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (!dataUrl) return;

        // Automatically downscale and compress images to ~80-150KB for fast Firestore syncing
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            setHeroImage(compressed);
          } else {
            setHeroImage(dataUrl);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedIngredients = rawIngredients
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text }));

    const parsedSteps = rawSteps
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, idx) => ({ num: idx + 1, text }));

    const fallbackImage =
      'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=80';

    onSave({
      name: title.trim(),
      author: author.trim(),
      category: 'family',
      isDefault: false,
      heroImage: heroImage || fallbackImage,
      yieldHeader: yieldHeader.trim() || 'For 1 loaf:',
      baseYield: 1,
      cardDescription: cardDescription.trim() || undefined,
      ingredients: parsedIngredients,
      steps: parsedSteps,
      tips: tips.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    // Reset & close
    setTitle('');
    setAuthor('');
    setCardDescription('');
    setRawIngredients('');
    setRawSteps('');
    setTips('');
    setNotes('');
    setHeroImage('');
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
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="modalTitle">
            {t.addRecipe}
          </h2>
          <button
            className="btn btn-icon"
            id="closeModalBtn"
            aria-label="Close modal"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form id="addRecipeForm" onSubmit={handleSubmit}>
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

          <div className="form-group">
            <label className="form-label" htmlFor="recipeImageFile">
              {t.heroPhoto}
            </label>
            <input
              className="form-control"
              type="file"
              id="recipeImageFile"
              accept="image/*"
              onChange={handleImageChange}
            />
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'block',
                marginTop: '0.25rem',
              }}
            >
              {t.photoOptionalHelp}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="recipeIngredientsInput">
              {t.ingredientsHelp}
            </label>
            <textarea
              className="form-control"
              id="recipeIngredientsInput"
              rows={5}
              required
              value={rawIngredients}
              onChange={(e) => setRawIngredients(e.target.value)}
              placeholder="Flour - 450g&#10;Yeast - 2 teaspoons&#10;Salt - 1.5 teaspoon"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="recipeTipsInput">
              {t.tipsOptional}
            </label>
            <input
              className="form-control"
              type="text"
              id="recipeTipsInput"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              placeholder="e.g., use non-stick spatula or similar for handling dough."
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="recipeStepsInput">
              {t.stepsHelp}
            </label>
            <textarea
              className="form-control"
              id="recipeStepsInput"
              rows={6}
              required
              value={rawSteps}
              onChange={(e) => setRawSteps(e.target.value)}
              placeholder="Add flour, yeast, and salt in a bowl and mix well.&#10;Add water and mix until a sloppy dough"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="recipeNotesInput">
              {t.notesOptional}
            </label>
            <input
              className="form-control"
              type="text"
              id="recipeNotesInput"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., will not work on an air fryer."
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '1.5rem',
            }}
          >
            <button
              type="button"
              className="btn"
              id="cancelModalBtn"
              onClick={onClose}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {t.saveToVault}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
