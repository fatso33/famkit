import React from 'react';
import { CookingPot } from 'lucide-react';
import { UiTranslations } from '../../i18n/translations';

interface MakesViewProps {
  t: UiTranslations;
}

export const MakesView: React.FC<MakesViewProps> = ({ t }) => (
  <section id="viewMakes">
    <div className="vault-hero">
      <h1 className="font-serif">{t.makes}</h1>
    </div>

    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <CookingPot size="1.75rem" strokeWidth={1.6} />
      </span>
      <h2 className="empty-state-title">{t.makesEmptyTitle}</h2>
      <p className="empty-state-body">{t.makesEmptyBody}</p>
    </div>
  </section>
);
