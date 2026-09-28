import React from 'react';
import { Recipe } from '../../types/recipe';
import { categoryOf } from '../../utils/vault';
import { CATEGORY_ICONS } from './vaultIcons';

interface CategoryTileProps {
  recipe: Pick<Recipe, 'category'>;
  className?: string;
}

/**
 * Stands in for the photo of a recipe saved without one: tinted paper with the category's icon
 * inside faint rings, in the season's colours (index.css, .category-tile). It fills its frame
 * like a photo, and morphs like one between a card or row and the recipe page.
 */
export const CategoryTile: React.FC<CategoryTileProps> = ({ recipe, className = '' }) => {
  const category = categoryOf(recipe);
  const Icon = CATEGORY_ICONS[category];
  return (
    <div className={`category-tile ${className}`.trim()} data-category={category}>
      <Icon className="category-tile-icon" strokeWidth={1.4} aria-hidden="true" />
    </div>
  );
};
