import React from 'react';

/** Three sliders, whose knobs glide to new settings while the preferences are open. */
export const PrefsGlyph: React.FC = () => (
  <svg
    className="fk-prefs-glyph"
    viewBox="0 0 24 24"
    width="1.3em"
    height="1.3em"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    <circle cx="9" cy="6.5" r="2.4" />
    <circle cx="15.5" cy="12" r="2.4" />
    <circle cx="7.5" cy="17.5" r="2.4" />
  </svg>
);
