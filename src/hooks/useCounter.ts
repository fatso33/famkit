import { useCallback, useEffect, useState } from 'react';
import { getCounterMemory, setCounterMemory } from '../services/storage';
import { GREETING_IDS, pickGreeting, type GreetingId } from '../utils/greeting';
import { daysBetween } from '../utils/counter';
import type { Season } from '../utils/season';

const isGreetingId = (id: string | undefined): id is GreetingId =>
  GREETING_IDS.includes(id as GreetingId);

/**
 * What My Counter remembers about this person, on this device: the greeting picked for this
 * launch (kept for the rest of it, so coming back to the counter doesn't change it), and the
 * hearts on their makes they've already been told about, as of the launch, so a line about new
 * ones stays up until the app is next opened.
 */
export function useCounterMemory(email: string, season: Season, unseenRecipes: number) {
  const [launch] = useState(() => {
    const memory = getCounterMemory(email);
    const now = Date.now();
    const greeting = pickGreeting(
      {
        now: new Date(now),
        season,
        unseenRecipes,
        daysAway: memory.lastVisit === undefined ? null : daysBetween(memory.lastVisit, now),
        lastId: isGreetingId(memory.lastGreeting) ? memory.lastGreeting : null,
      },
      Math.random(),
    );
    return { greeting, heartsShown: memory.heartsShown };
  });

  // This visit, and its greeting, are next launch's "last".
  useEffect(() => {
    if (!email) return;
    setCounterMemory(email, {
      ...getCounterMemory(email),
      lastGreeting: launch.greeting,
      lastVisit: Date.now(),
    });
  }, [email, launch.greeting]);

  /** The make's hearts have been shown to this person: they aren't news next launch. */
  const markHeartsShown = useCallback(
    (makeId: string, hearts: readonly string[]) => {
      if (!email) return;
      const memory = getCounterMemory(email);
      setCounterMemory(email, {
        ...memory,
        heartsShown: { ...memory.heartsShown, [makeId]: [...hearts] },
      });
    },
    [email],
  );

  return { greetingId: launch.greeting, heartsShown: launch.heartsShown, markHeartsShown };
}
