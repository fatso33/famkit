import React, { useState } from 'react';
import { ArrowUpRight, BookOpen, Globe } from 'lucide-react';
import { Recipe } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { sourceHost, webAddress } from '../../utils/recipeForm';
import { SourcePopover } from './SourcePopover';

interface RecipeSourceProps {
  recipe: Recipe;
  t: UiTranslations;
}

/**
 * "Adapted from" at the foot of a recipe: a web page as its site's name in a chip, which asks
 * before opening the page (SourcePopover), or plain words beside a book. Nothing when the recipe
 * names no source. A site name too long for the line ends in "…" (Peter's call), at full size.
 * The record is untrusted: only an http(s) address is ever opened.
 */
export const RecipeSource: React.FC<RecipeSourceProps> = ({ recipe, t }) => {
  const url = webAddress(typeof recipe.sourceUrl === 'string' ? recipe.sourceUrl : '');
  const host = url ? sourceHost(url) : '';
  const words = !host && typeof recipe.sourceText === 'string' ? recipe.sourceText.trim() : '';
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!host && !words) return null;

  return (
    <footer className="detail-source">
      <p className="detail-source-label">{t.adaptedFrom}</p>
      {host ? (
        <button
          type="button"
          className="detail-source-chip"
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <Globe size="1.1em" strokeWidth={2} aria-hidden="true" />
          <span>{host}</span>
          <ArrowUpRight size="1em" strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : (
        <p className="detail-source-words">
          <BookOpen size="1.1em" strokeWidth={2} aria-hidden="true" />
          <span>{words}</span>
        </p>
      )}
      {anchor && url && (
        <SourcePopover anchor={anchor} url={url} t={t} onClose={() => setAnchor(null)} />
      )}
    </footer>
  );
};
