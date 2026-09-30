import { useState, useCallback, useEffect, useRef } from 'react';
import { Recipe, RecipeVersion, Language } from '../types/recipe';
import {
  getStoredRecipes,
  getTranslationFailures,
  getTranslationPause,
  recordTranslationFailure,
  saveRecipes,
  setTranslationPause,
} from '../services/storage';
import {
  subscribeToRecipes,
  saveRecipeToCloud,
  saveTranslationToCloud,
  fetchRecipeVersion,
  hasCloud,
} from '../services/firestore';
import { hasLeftOutPhotos, keepLoadedPhotos } from '../utils/deviceCopy';
import { legacyVersions, prepareEdit } from '../utils/recipeVersions';
import { isDeleted, withDeletedAt } from '../utils/recipeTrash';
import { newRecipeId } from '../utils/recipeId';
import type { CurrentUser } from './useCurrentUser';
import { isTranslationAvailable, translateDocuments } from '../services/gemini';
import { isFirebaseConfigured } from '../services/firebase';
import {
  PieceTranslation,
  TranslationQuotaError,
  TranslationRejectedError,
  applyTranslation,
  localizeRecipe,
  needsTranslation,
  otherLanguage,
  pendingPieces,
  recipeTranslationDoc,
  retryDelayMs,
  sourceHash,
  sourceLanguageOf,
  translationFitsRecipe,
  translationPending,
} from '../utils/recipeTranslation';
import { QueueItem, mayRideAlong, pickBatch, translationDueAt } from '../utils/translationQueue';
import { DocReply, ReviewedReply, TranslationDoc, reviewReply } from '../utils/translationRequest';
import { Piece, fnv1a, pieceHash } from '../utils/translationPieces';
export function getLocalizedRecipe(
  recipe: Recipe | null | undefined,
  lang: Language = 'en',
): Recipe | null {
  return recipe ? localizeRecipe(recipe, lang) : null;
}

/**
 * Whether a reader in `lang` is waiting for some of the recipe's words to be translated: only
 * where translation runs (it doesn't without Firebase, e.g. local development).
 */
export function awaitsTranslation(recipe: Recipe, lang: Language): boolean {
  return isTranslationAvailable && translationPending(recipe, lang);
}

/**
 * Whether a save may replace this recipe. Not this device's copy without its photos: the save
 * would write the recipe back without them. The full recipe arrives with the cloud's answer.
 */
function canSaveOver(existing: Recipe | undefined): boolean {
  if (!existing || !hasLeftOutPhotos(existing)) return true;
  console.warn(`Not saving recipe ${existing.id}: its photos haven't loaded on this device yet`);
  return false;
}

/** A recipe's pending pieces, as one entry of a translation request. */
interface TranslationJob {
  recipe: Recipe;
  /** Its text's fingerprint when asked: a reply for older text is dropped. */
  hash: string;
  /** Recipe, text and pending pieces: what was tried, for the once-a-session and backoff rules. */
  key: string;
  pieces: Piece[];
}

const jobKey = (recipe: Recipe, pieces: Piece[]) =>
  `${recipe.id}@${sourceHash(recipe)}@${fnv1a(pieces.map(pieceHash).join())}`;

/**
 * One request. An unusable answer (blocked, garbled) is often a one-off, so it's asked for once
 * more straight away, from the same model, before the longer wait (retryDelayMs).
 */
async function askOnceMore(docs: TranslationDoc[]): Promise<DocReply[]> {
  try {
    return await translateDocuments(docs);
  } catch (err) {
    if (!(err instanceof TranslationRejectedError)) throw err;
    console.warn('Unusable translation reply, asking once more:', err);
    return translateDocuments(docs);
  }
}

/** A reply's language, when it's one the recipe can have (a new recipe's is checked). */
function replyLanguage(recipe: Recipe, doc: TranslationDoc, reply: DocReply) {
  const language = reply.detectedLanguage;
  if (!language) return undefined;
  const fits =
    doc.language !== undefined ||
    translationFitsRecipe(recipe, { detectedLanguage: language, values: reply.values });
  return fits ? language : undefined;
}

/**
 * Translates the jobs in one request, checking every piece (reviewReply). Whatever didn't pass
 * (left out, amounts changed, still in the original language, or a new recipe whose language the
 * reply got wrong) is asked for once more, together, in one more request. Resolves to each
 * recipe's translation (by id; missing when nothing usable came back), and to a quota pause
 * when the second request found the allowance used up.
 */
async function requestTranslations(jobs: TranslationJob[]): Promise<{
  results: Map<string, PieceTranslation>;
  quota?: TranslationQuotaError;
}> {
  const docs = jobs.map((job) => recipeTranslationDoc(job.recipe, job.pieces));
  const first = await askOnceMore(docs);
  const rounds = jobs.map((job, i): ReviewedReply & { language?: Language } => {
    const language = replyLanguage(job.recipe, docs[i], first[i]);
    if (!language) return { values: new Map(), retry: job.pieces, gaveUp: [] };
    return { language, ...reviewReply(docs[i], first[i], false) };
  });

  const again = jobs.flatMap((job, i) => {
    const { language, values, retry } = rounds[i];
    if (retry.length === 0) return [];
    // Asked with what came back so far as its current translation, in its language.
    const sofar = language
      ? applyTranslation(job.recipe, { detectedLanguage: language, values }, job.hash)
      : job.recipe;
    return [{ i, doc: recipeTranslationDoc(sofar, retry) }];
  });
  let quota: TranslationQuotaError | undefined;
  if (again.length > 0) {
    try {
      const second = await translateDocuments(again.map((a) => a.doc));
      again.forEach(({ i, doc }, j) => {
        const round = rounds[i];
        const language = round.language ?? replyLanguage(jobs[i].recipe, doc, second[j]);
        if (!language || (round.language && second[j].detectedLanguage !== language)) return;
        const last = reviewReply(doc, second[j], true);
        round.language = language;
        for (const [hash, value] of last.values) round.values.set(hash, value);
        round.gaveUp.push(...last.gaveUp);
      });
    } catch (err) {
      // What passed the first time is kept; the rest waits for a later request.
      if (err instanceof TranslationQuotaError) quota = err;
      else console.warn('Second translation request failed (keeping the first):', err);
    }
  }

  const results = new Map<string, PieceTranslation>();
  jobs.forEach((job, i) => {
    const { language, values, gaveUp } = rounds[i];
    if (language && (values.size > 0 || gaveUp.length > 0)) {
      results.set(job.recipe.id, { detectedLanguage: language, values, gaveUp });
    }
  });
  return { results, quota };
}

/** The vault, kept in sync with Firestore. `currentUser` owns the recipes added here. */
export function useRecipes(currentUser: CurrentUser | null) {
  const [recipes, setRecipes] = useState<Recipe[]>(getStoredRecipes);
  // The latest list, for callbacks that must build on it (an edit needs the version it replaces).
  const latestRecipes = useRef(recipes);
  useEffect(() => {
    latestRecipes.current = recipes;
  }, [recipes]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Background translation bookkeeping (see the effect below).
  const triedKeys = useRef(new Set<string>());
  // Recipe id → text fingerprint this device saved. A later edit from another phone changes the
  // fingerprint, so it no longer counts as "saved here" (no head start for this phone).
  const savedOnThisDevice = useRef(new Map<string, string>());
  // "id@text fingerprint" of translations made here: this phone finishes them without waiting.
  const translatedOnThisDevice = useRef(new Set<string>());
  const translationInFlight = useRef(false);
  const [translationScan, setTranslationScan] = useState(0);

  // Subscribe to real-time Cloud Firestore updates
  useEffect(() => {
    const unsubscribe = subscribeToRecipes((updatedRecipes) => {
      setRecipes((prev) => keepLoadedPhotos(prev, updatedRecipes));
    });

    return () => unsubscribe();
  }, []);

  // Translates new and edited recipes into their other language, only the pieces that have no
  // translation yet, when they're due (utils/translationQueue), several in one request. Each
  // request is tried once per session; coming back online or reopening the app retries lost
  // connections; an unusable answer is asked for once more at once, then waits longer; a used-up
  // allowance pauses every request until it resets.
  useEffect(() => {
    if (!isTranslationAvailable || translationInFlight.current) return;

    const now = Date.now();
    const pausedUntil = getTranslationPause();
    const failures = getTranslationFailures();
    const queue: QueueItem<TranslationJob>[] = [];
    // Every piece already translated (e.g. steps only moved): rebuilt here, with no request.
    const rebuilt: TranslationJob[] = [];
    for (const recipe of recipes) {
      // Every synced recipe has an owner, so one without is a stale copy cached from before
      // (e.g. Wanda's, whose hand-written Polish wasn't stamped yet). Its cloud version is coming.
      if (isFirebaseConfigured && !recipe.ownerEmail) continue;
      if (isDeleted(recipe)) continue;
      if (!needsTranslation(recipe)) continue;
      const hash = sourceHash(recipe);
      const pieces = pendingPieces(recipe);
      const key = jobKey(recipe, pieces);
      if (triedKeys.current.has(key)) continue;
      const failure = failures[key];
      if (failure && now - failure.at < retryDelayMs(failure.count)) continue;
      const job: TranslationJob = { recipe, hash, key, pieces };
      if (pieces.length === 0) {
        rebuilt.push(job);
        continue;
      }
      const here = {
        savedHere: savedOnThisDevice.current.get(recipe.id) === hash,
        translatedHere: translatedOnThisDevice.current.has(`${recipe.id}@${hash}`),
      };
      queue.push({
        item: job,
        dueAt: translationDueAt(recipe, here),
        rideAlong: mayRideAlong(recipe, here),
        pieces: pieces.length,
        chars: JSON.stringify(recipeTranslationDoc(recipe, pieces)).length,
      });
    }

    const paused = pausedUntil > now;
    const batch = [...rebuilt, ...(paused ? [] : pickBatch(queue, now))];
    if (batch.length === 0) {
      // Nothing due yet (a head start, an edit settling, or a pause): look again when it is.
      const next = paused ? pausedUntil : Math.min(...queue.map((q) => q.dueAt));
      if (!Number.isFinite(next)) return;
      const timer = window.setTimeout(
        () => setTranslationScan((n) => n + 1),
        Math.max(1000, next - now),
      );
      return () => window.clearTimeout(timer);
    }

    for (const job of batch) triedKeys.current.add(job.key);
    translationInFlight.current = true;
    const asking = batch.filter((job) => job.pieces.length > 0);

    const store = (job: TranslationJob, result: PieceTranslation) => {
      // Edited or synced meanwhile: the new text gets its own translation.
      const current = latestRecipes.current.find((r) => r.id === job.recipe.id);
      if (!current || sourceHash(current) !== job.hash) return;

      const at = Date.now();
      const updated = applyTranslation(current, result, job.hash, at);
      const lang = sourceLanguageOf(updated);
      setRecipes((prev) => {
        const next = prev.map((r) =>
          r.id === job.recipe.id ? applyTranslation(r, result, job.hash, at) : r,
        );
        saveRecipes(next, { photosInCloud: hasCloud });
        return next;
      });
      saveTranslationToCloud(
        job.recipe.id,
        lang,
        updated.translations![otherLanguage(lang)]!,
      ).catch((err) => {
        console.warn('Failed to sync recipe translation to cloud (retained locally):', err);
      });
      translatedOnThisDevice.current.add(`${job.recipe.id}@${job.hash}`);
      // Pieces still missing after both tries wait: not again this session, then longer.
      const left = pendingPieces(updated);
      if (left.length > 0) {
        const leftKey = jobKey(updated, left);
        triedKeys.current.add(leftKey);
        recordTranslationFailure(leftKey, at);
      }
    };

    const work = asking.length > 0 ? requestTranslations(asking) : Promise.resolve(null);
    work
      .then((answer) => {
        if (answer?.quota) setTranslationPause(answer.quota.retryAt);
        for (const job of batch) {
          const result =
            job.pieces.length === 0
              ? { detectedLanguage: sourceLanguageOf(job.recipe), values: new Map() }
              : answer?.results.get(job.recipe.id);
          if (result) store(job, result);
          // Its second try found the allowance used up: asked for again once it's back.
          else if (answer?.quota) triedKeys.current.delete(job.key);
          else recordTranslationFailure(job.key, Date.now());
        }
      })
      .catch((err: unknown) => {
        for (const job of rebuilt) {
          store(job, { detectedLanguage: sourceLanguageOf(job.recipe), values: new Map() });
        }
        if (err instanceof TranslationQuotaError) {
          // Asked for again once the allowance is back, even in this session.
          setTranslationPause(err.retryAt);
          for (const job of asking) triedKeys.current.delete(job.key);
        } else if (err instanceof TranslationRejectedError) {
          for (const job of asking) recordTranslationFailure(job.key, Date.now());
        }
        console.warn('Recipe translation failed (showing the original):', err);
      })
      .finally(() => {
        translationInFlight.current = false;
        setTranslationScan((n) => n + 1);
      });
  }, [recipes, translationScan]);

  // Back online: retry translations that failed while offline.
  useEffect(() => {
    const handleOnline = () => {
      triedKeys.current.clear();
      setTranslationScan((n) => n + 1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Deleted recipes stay in the vault (for restoring) but aren't shown.
  const visibleRecipes = recipes.filter((r) => !isDeleted(r));
  const selectedRecipe = visibleRecipes.find((r) => r.id === selectedRecipeId) || null;

  const addRecipe = useCallback(
    (newRecipe: Omit<Recipe, 'id' | 'createdAt'>): Recipe => {
      const recipeWithId: Recipe = {
        ...newRecipe,
        ownerEmail: currentUser?.email,
        ownerName: currentUser?.name,
        id: newRecipeId(),
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      savedOnThisDevice.current.set(recipeWithId.id, sourceHash(recipeWithId));

      // Optimistic local update
      setRecipes((prev) => {
        const updated = [recipeWithId, ...prev];
        saveRecipes(updated, { photosInCloud: hasCloud });
        return updated;
      });

      setSelectedRecipeId(recipeWithId.id);

      // Async sync to Cloud Firestore in background
      saveRecipeToCloud(recipeWithId).catch((err) => {
        console.warn('Failed to sync new recipe to cloud (retained locally):', err);
      });

      return recipeWithId;
    },
    [currentUser],
  );

  /**
   * Saves an edit as a new version. The version it replaces is backed up whole, photos included,
   * so the owner can restore it later. `note` is the optional "what changed". Returns null, saving
   * nothing, while the recipe is this device's copy without its photos.
   */
  const updateRecipe = useCallback((recipeUpdates: Recipe, note = ''): Recipe | null => {
    const existing = latestRecipes.current.find((r) => r.id === recipeUpdates.id);
    if (!canSaveOver(existing) || !canSaveOver(recipeUpdates)) return null;
    savedOnThisDevice.current.set(recipeUpdates.id, sourceHash(recipeUpdates));

    const now = Date.now();
    const { recipe: finalRecipe, newVersions } = existing
      ? prepareEdit(existing, recipeUpdates, note, now)
      : { recipe: { ...recipeUpdates, updatedAt: now }, newVersions: [] };

    setRecipes((prev) => {
      const updated = prev.map((r) => (r.id === finalRecipe.id ? finalRecipe : r));
      saveRecipes(updated, { photosInCloud: hasCloud });
      return updated;
    });

    // Async sync to Cloud Firestore in background
    saveRecipeToCloud(finalRecipe, newVersions).catch((err) => {
      console.warn('Failed to sync updated recipe to cloud (retained locally):', err);
    });

    return finalRecipe;
  }, []);

  /** One earlier version of a recipe, for the owner to restore. Rejects when it can't be loaded. */
  const loadVersion = useCallback(
    async (recipe: Recipe, versionId: string): Promise<RecipeVersion> =>
      legacyVersions(recipe).find((v) => v.id === versionId) ??
      fetchRecipeVersion(recipe.id, versionId),
    [],
  );

  /**
   * Deletes (`deleted`) or restores a recipe. Nothing is erased: the recipe is only marked, so it
   * stays restorable. Not a content change, so no new version. Returns whether it was done.
   */
  const setRecipeDeleted = useCallback((id: string, deleted: boolean): boolean => {
    const existing = latestRecipes.current.find((r) => r.id === id);
    if (!existing || !canSaveOver(existing)) return false;
    const updated = withDeletedAt(existing, deleted ? Date.now() : undefined);

    setRecipes((prev) => {
      const next = prev.map((r) => (r.id === id ? updated : r));
      saveRecipes(next, { photosInCloud: hasCloud });
      return next;
    });

    saveRecipeToCloud(updated).catch((err) => {
      console.warn(`Failed to sync recipe ${deleted ? 'deletion' : 'restore'} to cloud:`, err);
    });
    return true;
  }, []);

  const deleteRecipe = useCallback((id: string) => setRecipeDeleted(id, true), [setRecipeDeleted]);
  const restoreRecipe = useCallback(
    (id: string) => setRecipeDeleted(id, false),
    [setRecipeDeleted],
  );

  return {
    recipes: visibleRecipes,
    /** Every recipe, deleted ones included. */
    allRecipes: recipes,
    selectedRecipe,
    selectedRecipeId,
    setSelectedRecipeId,
    addRecipe,
    updateRecipe,
    loadVersion,
    deleteRecipe,
    restoreRecipe,
  };
}
