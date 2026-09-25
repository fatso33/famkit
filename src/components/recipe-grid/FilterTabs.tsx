import React from 'react';
import { FilterType } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';

interface FilterTabsProps {
  currentFilter: FilterType;
  onSelectFilter: (filter: FilterType) => void;
  t: UiTranslations;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  currentFilter,
  onSelectFilter,
  t,
}) => {
  const tabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: t.allRecipes },
    { key: 'breads', label: t.breads },
    { key: 'heirloom', label: t.heirlooms },
    { key: 'recent', label: t.recent },
  ];

  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1" role="tablist">
      {tabs.map((tab) => {
        const isActive = currentFilter === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelectFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer ${
              isActive ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: isActive
                ? 'var(--text-primary)'
                : 'var(--bg-surface)',
              color: isActive ? 'var(--bg-surface)' : 'var(--text-secondary)',
              borderColor: isActive
                ? 'var(--text-primary)'
                : 'var(--border-subtle)',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
