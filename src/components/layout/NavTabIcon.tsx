import React from 'react';
import { MainPage } from '../../types/navigation';

/**
 * The navigation island's tab icons, drawn inline so their parts can move (index.css, the
 * nav-icon rules): the chef's hat puffs, a card pops up out of the recipe tin, and the pot's lid
 * lifts with a breath of steam, each when its tab becomes the current one. While a recipe is
 * open, the tin holds its card pulled up: the recipe icon (RecipeCardIcon), from the same paths.
 */
export const NavTabIcon: React.FC<{ page: MainPage }> = ({ page }) => (
  <svg
    className={`nav-icon nav-icon-${page}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={page === 'recipes' ? 1.75 : 1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {page === 'counter' && (
      <g className="nav-hat">
        <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
        <path d="M6 17h12" />
      </g>
    )}
    {page === 'recipes' && (
      <>
        {/* The card, settled in the tin; its pulled-up shape is in index.css (.nav-card). */}
        <path
          className="nav-card"
          d="M7.01 11 7.54 7.68Q7.76 6.3 9.14 6.52L15.26 7.48Q16.64 7.7 16.43 9.09L16.13 11"
        />
        {/* Where a path can't change shape (Safari), this pulled-up card fades in instead. */}
        <path
          className="nav-card-up"
          d="M6.31 11 7.54 3.28Q7.76 1.9 9.14 2.12L15.26 3.08Q16.64 3.3 16.43 4.69L15.43 11"
        />
        <path className="nav-card-line" d="M9.59 4.72 13.81 5.39" />
        <path d="M3 11h18v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5z" />
        <rect x="9.2" y="14.4" width="5.6" height="2.4" rx=".5" />
      </>
    )}
    {page === 'makes' && (
      <>
        <path d="M2 12h20" />
        <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
        <g className="nav-lid">
          <path d="m4 8 16-4" />
          <path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8" />
        </g>
        <path className="nav-steam" d="M7 9.5c-.8-1 .8-1.6 0-2.8" />
        <path className="nav-steam" d="M17 8.5c-.8-1 .8-1.6 0-2.8" />
      </>
    )}
  </svg>
);
