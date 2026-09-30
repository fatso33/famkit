import React from 'react';
import { BookHeart, FilePen } from 'lucide-react';
import { RecipeCategory } from '../../types/recipe';
import { CATEGORY_ICONS } from './vaultIcons';
import { Monogram } from './Monogram';

/** What a divider tab in the Recipe Box names: a category, a cook, or both, and the drafts. */
export interface VaultTab {
  /** Tells the tabs apart. */
  key: string;
  label: string;
  count: number;
  category?: RecipeCategory;
  cook?: string;
  /** This person's drafts, or the family's recipes under them. */
  kind?: 'drafts' | 'family';
}

/** A divider tab's face: its icon (a category's, or a cook's initials), name and count. */
export const VaultTabLabel: React.FC<{ tab: VaultTab }> = ({ tab }) => {
  const Icon = tab.category
    ? CATEGORY_ICONS[tab.category]
    : tab.kind === 'drafts'
      ? FilePen
      : tab.kind === 'family'
        ? BookHeart
        : null;
  return (
    <>
      {Icon ? (
        <Icon className="vault-tab-icon" size="1.05em" strokeWidth={2} aria-hidden="true" />
      ) : (
        tab.cook && <Monogram name={tab.cook} />
      )}
      <span className="vault-tab-name">{tab.label}</span>
      <span className="vault-tab-count" aria-hidden="true">
        {tab.count}
      </span>
    </>
  );
};
