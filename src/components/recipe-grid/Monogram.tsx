import React from 'react';

/** An author's initials in a small round, where a category would have its icon. */
export const Monogram: React.FC<{ name: string }> = ({ name }) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1
      ? words[0].charAt(0) + words[words.length - 1].charAt(0)
      : (words[0] ?? '').charAt(0);
  return (
    <span className="vault-monogram" aria-hidden="true">
      {initials.toUpperCase()}
    </span>
  );
};
