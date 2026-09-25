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
        if (ev.target?.result) {
          setHeroImage(ev.target.result as string);
        }
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
      ingredients: parsedIngredients,
      steps: parsedSteps,
      tips: tips.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    // Reset & close
    setTitle('');
    setAuthor('');
    setRawIngredients('');
    setRawSteps('');
    setTips('');
    setNotes('');
    setHeroImage('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="addModalTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto my-auto animate-[scaleUp_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 id="addModalTitle" className="font-serif font-bold text-2xl">
            {t.addRecipe}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full grid place-items-center hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-sm font-semibold"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
          <div>
            <label className="font-semibold block mb-1">{t.recipeTitle}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Grandma's Sourdough"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">{t.authorContributor}</label>
            <input
              type="text"
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. Wanda G."
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">{t.yieldHeader}</label>
            <input
              type="text"
              required
              value={yieldHeader}
              onChange={(e) => setYieldHeader(e.target.value)}
              placeholder="For 1 loaf: or Serves 4:"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">{t.heroPhoto}</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full text-xs"
            />
            <span className="text-xs block mt-1" style={{ color: 'var(--text-muted)' }}>
              {t.photoOptionalHelp}
            </span>
          </div>

          <div>
            <label className="font-semibold block mb-1">{t.ingredientsHelp}</label>
            <textarea
              required
              rows={4}
              value={rawIngredients}
              onChange={(e) => setRawIngredients(e.target.value)}
              placeholder="Flour - 450g&#10;Yeast - 2 teaspoons&#10;Salt - 1.5 teaspoons"
              className="w-full px-3 py-2 rounded-lg border text-sm resize-y"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">{t.stepsHelp}</label>
            <textarea
              required
              rows={4}
              value={rawSteps}
              onChange={(e) => setRawSteps(e.target.value)}
              placeholder="Add flour, yeast, and salt in a bowl and mix well.&#10;Add water and mix until a sloppy dough forms."
              className="w-full px-3 py-2 rounded-lg border text-sm resize-y"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">{t.tipsOptional}</label>
            <input
              type="text"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              placeholder="e.g. Use a non-stick spatula for handling the dough."
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">{t.notesOptional}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Will not work in an air fryer."
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary cursor-pointer"
            >
              {t.saveToVault}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
