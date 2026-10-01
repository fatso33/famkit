import { useCallback, useEffect, useRef, useState } from 'react';
import { Language } from '../types/recipe';
import { Make, MakeContent } from '../types/make';
import { getStoredMakes, saveMakes, withDeviceMakePhotos } from '../services/storage';
import { whenDevicePhotosLoad } from '../services/photoStore';
import {
  hasCloud,
  saveMakeToCloud,
  saveMakeTranslationToCloud,
  setMakeHeartInCloud,
  subscribeToMakes,
} from '../services/firestore';
import { isFirebaseConfigured } from '../services/firebase';
import { isTranslationAvailable } from '../services/gemini';
import type { CurrentUser } from './useCurrentUser';
import type { TranslationJob } from './useTranslationQueue';
import { ownerCredit } from '../utils/ownership';
import { PieceTranslation, otherLanguage } from '../utils/recipeTranslation';
import { Piece } from '../utils/translationPieces';
import { makeWithDeletedAt, isMakeDeleted, newMakeId, withHeart } from '../utils/makes';
import {
  applyMakeTranslation,
  makeLanguage,
  makeNeedsTranslation,
  makeSourceHash,
  makeTranslationDoc,
  makeTranslationDueAt,
  makeTranslationFits,
  makeTranslationPending,
  pendingMakePieces,
} from '../utils/makeTranslation';

/**
 * Whether a reader in `lang` is waiting for some of the make's words: only where translation
 * runs (it doesn't without Firebase, e.g. local development).
 */
export function awaitsMakeTranslation(make: Make, lang: Language): boolean {
  return isTranslationAvailable && makeTranslationPending(make, lang);
}

/** Only the words a make has: an emptied title or note is left out. */
function tidyContent(content: MakeContent): MakeContent {
  const title = content.title?.trim();
  const note = content.note?.trim();
  return {
    recipeId: content.recipeId,
    photo: content.photo,
    ...(title ? { title } : {}),
    ...(note ? { note } : {}),
    ...(content.madeOn ? { madeOn: content.madeOn } : {}),
  };
}

/** Saves a make to the cloud in the background; this device keeps it either way. */
const syncMake = (make: Make, what: string) =>
  saveMakeToCloud(make).catch((err: unknown) => {
    console.warn(`Failed to sync ${what} make to cloud (retained locally):`, err);
  });

/**
 * The family's makes, kept in sync with Firestore and on this device. `currentUser` owns the
 * makes added here. `collectMakeJobs` lists the makes waiting for translation, for the queue
 * they share with the recipes (useRecipes, hooks/useTranslationQueue).
 */
export function useMakes(currentUser: CurrentUser | null) {
  const [makes, setMakes] = useState<Make[]>(getStoredMakes);
  const latestMakes = useRef(makes);
  useEffect(() => {
    latestMakes.current = makes;
  }, [makes]);

  // Make id → words fingerprint this device saved: its translation is this phone's to start.
  const savedOnThisDevice = useRef(new Map<string, string>());
  // "id@words fingerprint" of translations made here: this phone finishes them without waiting.
  const translatedOnThisDevice = useRef(new Set<string>());

  useEffect(() => subscribeToMakes(setMakes), []);
  // Photos kept on this device that were still being read at the first render (a slow phone).
  useEffect(() => whenDevicePhotosLoad(() => setMakes((prev) => withDeviceMakePhotos(prev))), []);

  /** Changes one make here (and on this device), returning it; null when it isn't here. */
  const change = useCallback((id: string, update: (make: Make) => Make): Make | null => {
    const existing = latestMakes.current.find((m) => m.id === id);
    if (!existing) return null;
    const updated = update(existing);
    setMakes((prev) => {
      const next = prev.map((m) => (m.id === id ? update(m) : m));
      saveMakes(next, { photosInCloud: hasCloud });
      return next;
    });
    return updated;
  }, []);

  /** Adds a make, written in `language` (the translator settles the real one). */
  const addMake = useCallback(
    (content: MakeContent, language: Language): Make => {
      const now = Date.now();
      const make: Make = {
        ...tidyContent(content),
        id: newMakeId(),
        ownerEmail: currentUser?.email,
        ...ownerCredit(undefined, currentUser),
        sourceLanguage: language,
        createdAt: now,
        updatedAt: now,
      };
      savedOnThisDevice.current.set(make.id, makeSourceHash(make));
      setMakes((prev) => {
        const next = [make, ...prev];
        saveMakes(next, { photosInCloud: hasCloud });
        return next;
      });
      void syncMake(make, 'new');
      return make;
    },
    [currentUser],
  );

  /**
   * Saves the maker's edit. Its translation stays: the pieces it didn't change keep theirs, and
   * changed ones are translated again once it has settled. Null while this device's copy lacks
   * its photo (the save would erase it).
   */
  const updateMake = useCallback(
    (id: string, content: MakeContent): Make | null => {
      const existing = latestMakes.current.find((m) => m.id === id);
      if (!existing || existing.photoOmitted) return null;
      const edit = (make: Make): Make => {
        const { title: _t, note: _n, madeOn: _d, ...rest } = make;
        return {
          ...rest,
          ...tidyContent(content),
          ...ownerCredit(make, currentUser),
          updatedAt: Date.now(),
        };
      };
      const updated = change(id, edit);
      if (!updated) return null;
      savedOnThisDevice.current.set(id, makeSourceHash(updated));
      void syncMake(updated, 'edited');
      return updated;
    },
    [change, currentUser],
  );

  /** Deletes (`deleted`) or restores a make: only marked, never erased. Whether it was done. */
  const setMakeDeleted = useCallback(
    (id: string, deleted: boolean): boolean => {
      const existing = latestMakes.current.find((m) => m.id === id);
      if (!existing || existing.photoOmitted) return false;
      const updated = change(id, (m) => makeWithDeletedAt(m, deleted ? Date.now() : undefined));
      if (updated) void syncMake(updated, deleted ? 'deleted' : 'restored');
      return Boolean(updated);
    },
    [change],
  );
  const deleteMake = useCallback((id: string) => setMakeDeleted(id, true), [setMakeDeleted]);
  const restoreMake = useCallback((id: string) => setMakeDeleted(id, false), [setMakeDeleted]);

  /** Gives or takes back this person's heart. Resolves false when the cloud refused it. */
  const setHeart = useCallback(
    async (id: string, on: boolean): Promise<boolean> => {
      const email = currentUser?.email;
      if (!email) return false;
      // Hearts aren't part of the make's own fields, so a copy without its photo may take one.
      change(id, (m) => withHeart(m, email, on));
      try {
        await setMakeHeartInCloud(id, email, on);
        return true;
      } catch (err) {
        console.warn('Failed to sync a heart on a make (taking it back):', err);
        change(id, (m) => withHeart(m, email, !on));
        return false;
      }
    },
    [change, currentUser],
  );

  /** Keeps a finished translation. The pieces still untranslated, or null if the words moved on. */
  const storeTranslation = useCallback(
    (id: string, hash: string, result: PieceTranslation): Piece[] | null => {
      const current = latestMakes.current.find((m) => m.id === id);
      if (!current || makeSourceHash(current) !== hash) return null;
      const at = Date.now();
      const updated = applyMakeTranslation(current, result, hash, at);
      change(id, (m) => applyMakeTranslation(m, result, hash, at));
      const lang = makeLanguage(updated);
      saveMakeTranslationToCloud(id, lang, updated.translations![otherLanguage(lang)]!).catch(
        (err: unknown) => {
          console.warn('Failed to sync make translation to cloud (retained locally):', err);
        },
      );
      translatedOnThisDevice.current.add(`${id}@${hash}`);
      return pendingMakePieces(updated);
    },
    [change],
  );

  // Each make waiting for translation. Every make may ride along with a request that's going
  // anyway: none is translated at once by the phone that added it.
  const collectMakeJobs = useCallback(
    (): TranslationJob[] =>
      makes.flatMap((make) => {
        // A synced make always has its maker; one without is a stale copy.
        if (isFirebaseConfigured && !make.ownerEmail) return [];
        if (isMakeDeleted(make) || !makeNeedsTranslation(make)) return [];
        const hash = makeSourceHash(make);
        const here = {
          savedHere: savedOnThisDevice.current.get(make.id) === hash,
          translatedHere: translatedOnThisDevice.current.has(`${make.id}@${hash}`),
        };
        return [
          {
            id: `make:${make.id}`,
            hash,
            pieces: pendingMakePieces(make),
            dueAt: makeTranslationDueAt(make, here),
            rideAlong: true,
            language: makeLanguage(make),
            doc: (pieces, sofar) => makeTranslationDoc(make, pieces, sofar),
            fits: (result) => makeTranslationFits(make, result),
            store: (result) => storeTranslation(make.id, hash, result),
          },
        ];
      }),
    [makes, storeTranslation],
  );

  return {
    /** Every make, deleted ones included. */
    makes,
    addMake,
    updateMake,
    deleteMake,
    restoreMake,
    setHeart,
    collectMakeJobs,
  };
}
