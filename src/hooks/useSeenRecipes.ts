import { useState } from 'react';
import { getSeenRecipes, setSeenRecipes } from '../services/storage';

interface Seen {
  email: string;
  ids: ReadonlySet<string>;
}

const read = (email: string): Seen => ({ email, ids: new Set(getSeenRecipes(email)) });

/**
 * The recipes this person has opened on this device, for the vault's Unseen filter. Kept per
 * person, so someone else signing in on the same phone starts with their own.
 */
export function useSeenRecipes(email: string) {
  const [seen, setSeen] = useState(() => read(email));
  // Someone else signed in: their own list, straight away.
  let current = seen;
  if (seen.email !== email) {
    current = read(email);
    setSeen(current);
  }

  const markSeen = (id: string) => {
    if (current.ids.has(id)) return;
    const ids = new Set(current.ids).add(id);
    setSeen({ email, ids });
    setSeenRecipes(email, [...ids]);
  };

  return { seen: current.ids, markSeen };
}
