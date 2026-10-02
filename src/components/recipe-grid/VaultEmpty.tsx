import React from 'react';
import { VaultFilter } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { filterEntries, type VaultEntry } from '../../utils/vault';

interface VaultEmptyProps {
  /** Nothing in the box at all. */
  boxEmpty: boolean;
  entries: VaultEntry[];
  filter: VaultFilter;
  shownCount: number;
  /** Clears the filter and search, to show every recipe again. */
  onShowAll: () => void;
  t: UiTranslations;
}

/**
 * What the Recipe Box (or its deck) says when it shows no recipes: that it's empty, or that
 * nothing matches, with a way back to every recipe. Nothing while it shows some.
 */
export const VaultEmpty: React.FC<VaultEmptyProps> = ({
  boxEmpty,
  entries,
  filter,
  shownCount,
  onShowAll,
  t,
}) => {
  if (boxEmpty) return <p className="vault-empty">{t.emptyVault}</p>;
  if (entries.length === 0 || shownCount > 0) return null;
  // Only the unseen filter came up empty: everything else would show something.
  const allSeen = filter.unseen && filterEntries(entries, { ...filter, unseen: false }).length > 0;
  return (
    <div className="vault-empty">
      <p>{allSeen ? t.allSeen : t.noMatches}</p>
      <button type="button" className="vault-empty-reset" onClick={onShowAll}>
        {t.showAllRecipes}
      </button>
    </div>
  );
};
