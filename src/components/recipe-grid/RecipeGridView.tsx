import React, { useState } from 'react';
import { Recipe, Language, FilterType } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { FilterTabs } from './FilterTabs';
import { RecipeCard } from './RecipeCard';
import { isHeirloom } from '../../utils/ownership';

const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

interface RecipeGridViewProps {
  recipes: Recipe[];
  language: Language;
  /** Kept by the app, so it survives a visit to a recipe. */
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  /** The recipe whose card a photo morphs to and from when opening or leaving it. */
  morphRecipeId: string | null;
  onSelectRecipe: (id: string) => void;
  /** Shown above the vault title, e.g. the install prompt. */
  banner?: React.ReactNode;
  t: UiTranslations;
}

export const RecipeGridView: React.FC<RecipeGridViewProps> = ({
  recipes,
  language,
  filter: currentFilter,
  onFilterChange,
  morphRecipeId,
  onSelectRecipe,
  banner,
  t,
}) => {
  // Read once per mount: "recent" doesn't need to tick over while the page is open.
  const [now] = useState(Date.now);
  const filteredRecipes = recipes.filter((r) => {
    if (currentFilter === 'breads') return r.category === 'breads';
    if (currentFilter === 'heirloom') return isHeirloom(r);
    if (currentFilter === 'recent') return now - (r.createdAt ?? 0) < RECENT_MS;
    return true;
  });

  return (
    <section id="viewGrid" className="recipe-grid-view">
      {banner}

      <div className="vault-hero">
        <h1 className="font-serif">{t.vaultTitle}</h1>
      </div>

      {/* Filter tabs */}
      <FilterTabs currentFilter={currentFilter} onSelectFilter={onFilterChange} t={t} />

      {/* Recipe Cards Grid */}
      <div className="recipe-grid" id="recipesGrid">
        {filteredRecipes.length === 0 && (
          <p className="vault-empty">{recipes.length === 0 ? t.emptyVault : t.emptyFilter}</p>
        )}
        {filteredRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            language={language}
            isMorphTarget={recipe.id === morphRecipeId}
            onSelect={onSelectRecipe}
            t={t}
          />
        ))}
      </div>
    </section>
  );
};
