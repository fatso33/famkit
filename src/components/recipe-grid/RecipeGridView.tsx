import React, { useState } from 'react';
import { Recipe, Language, FilterType } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { FilterTabs } from './FilterTabs';
import { RecipeCard } from './RecipeCard';

interface RecipeGridViewProps {
  recipes: Recipe[];
  language: Language;
  onSelectRecipe: (id: string) => void;
  onOpenAddModal: () => void;
  t: UiTranslations;
}

export const RecipeGridView: React.FC<RecipeGridViewProps> = ({
  recipes,
  language,
  onSelectRecipe,
  onOpenAddModal,
  t,
}) => {
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');

  const filteredRecipes = recipes.filter((r) => {
    if (currentFilter === 'breads') return r.category === 'breads';
    if (currentFilter === 'heirloom') return r.isDefault;
    if (currentFilter === 'recent') return !r.isDefault;
    return true;
  });

  return (
    <section className="animate-[fadeIn_0.2s_ease-out]">
      {/* Vault Hero */}
      <div
        className="mb-8 pb-6 border-b flex justify-between items-end flex-wrap gap-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <h1
            className="font-serif font-bold text-3xl sm:text-4xl leading-tight mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {t.vaultTitle}
          </h1>
          <p className="text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }}>
            {t.vaultSubtitle}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <FilterTabs
        currentFilter={currentFilter}
        onSelectFilter={setCurrentFilter}
        t={t}
      />

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            language={language}
            onSelect={onSelectRecipe}
            t={t}
          />
        ))}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={onOpenAddModal}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full text-white grid place-items-center shadow-2xl cursor-pointer hover:scale-105 active:scale-95 transition-transform z-30 border-none"
        style={{ backgroundColor: 'var(--accent)' }}
        title={t.addRecipe}
        aria-label={t.addRecipe}
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    </section>
  );
};
