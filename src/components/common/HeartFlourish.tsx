import React from 'react';

/** The splash's heart flourish: a line drawn out to each side of a small heart. */
export const HeartFlourish: React.FC<{ className: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 160 14" aria-hidden="true" focusable="false">
    <path
      className="vault-flourish-line"
      pathLength={1}
      d="M70 7.5C56 3.5 42 11 26 7.5C18 5.8 11 5.8 4 7.5"
    />
    <path
      className="vault-flourish-line"
      pathLength={1}
      d="M90 7.5C104 3.5 118 11 134 7.5C142 5.8 149 5.8 156 7.5"
    />
    <path
      className="vault-flourish-heart"
      d="M80 12.5C77 10.5 74.5 8.3 74.5 6C74.5 4.2 75.8 3 77.3 3C78.5 3 79.5 3.7 80 4.7C80.5 3.7 81.5 3 82.7 3C84.2 3 85.5 4.2 85.5 6C85.5 8.3 83 10.5 80 12.5Z"
    />
  </svg>
);
