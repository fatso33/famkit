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
    <section id="viewGrid" className="recipe-grid-view">
      <div className="vault-hero">
        <h1 className="font-serif">{t.vaultTitle}</h1>
      </div>

      {/* Filter tabs */}
      <FilterTabs
        currentFilter={currentFilter}
        onSelectFilter={setCurrentFilter}
        t={t}
      />

      {/* Recipe Cards Grid */}
      <div className="recipe-grid" id="recipesGrid">
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
        className="fab-add"
        id="fabAddBtn"
        title={t.addRecipe}
        aria-label={t.addRecipe}
        onClick={onOpenAddModal}
      >
        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>+</span>
      </button>
    </section>
  );
};
