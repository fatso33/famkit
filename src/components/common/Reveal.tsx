import React, { useState } from 'react';

/**
 * Opens and closes its contents by sliding them down and up (index.css, .reveal). Closed, the
 * contents are inert, so nobody can tab into controls they can't see. They're only built once
 * opened, and dropped again when it has slid shut: a long recipe has a closed tool strip under
 * every row and step, and building them all would slow the editor's opening.
 */
export const Reveal: React.FC<{
  open: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ open, className = '', children }) => {
  const [built, setBuilt] = useState(open);
  // Built in the same render that opens it, so the slide starts with its contents in place.
  if (open && !built) setBuilt(true);

  return (
    <div
      className={`reveal${open ? ' is-open' : ''} ${className}`.trim()}
      inert={!open}
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget) setBuilt(false);
      }}
    >
      <div className="reveal-inner">{built && children}</div>
    </div>
  );
};
