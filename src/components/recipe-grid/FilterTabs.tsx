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
    <div className="filter-nav" role="tablist">
      {tabs.map((tab) => {
        const isActive = currentFilter === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelectFilter(tab.key)}
            className={`filter-tab ${isActive ? 'active' : ''}`}
            data-filter={tab.key}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
