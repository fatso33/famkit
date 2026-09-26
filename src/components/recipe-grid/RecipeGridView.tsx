import React, { useState } from 'react';
import { Recipe, Language, FilterType } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { FilterTabs } from './FilterTabs';
import { RecipeCard } from './RecipeCard';

interface RecipeGridViewProps {
  recipes: Recipe[];
  language: Language;
  onSelectRecipe: (id: string) => void;
  /** Shown above the vault title, e.g. the install prompt. */
  banner?: React.ReactNode;
  t: UiTranslations;
}

export const RecipeGridView: React.FC<RecipeGridViewProps> = ({
  recipes,
  language,
  onSelectRecipe,
  banner,
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
      {banner}

      <div className="vault-hero">
        <h1 className="font-serif">{t.vaultTitle}</h1>
      </div>

      {/* Filter tabs */}
      <FilterTabs currentFilter={currentFilter} onSelectFilter={setCurrentFilter} t={t} />

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
    </section>
  );
};
