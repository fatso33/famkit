import { useEffect, useRef, useState } from 'react';
import { Language } from '../types/recipe';
import {
  clearTranslationBusy,
  getTranslationFailures,
  getTranslationPause,
  noteTranslationBusy,
  recordTranslationFailure,
  setTranslationPause,
} from '../services/storage';
import { isTranslationAvailable, translateDocuments } from '../services/gemini';
import {
  PieceTranslation,
  TranslationBusyError,
  TranslationQuotaError,
  TranslationRejectedError,
  busyPauseMs,
  retryDelayMs,
} from '../utils/recipeTranslation';
import { pickBatch } from '../utils/translationQueue';
import { DocReply, ReviewedReply, TranslationDoc, reviewReply } from '../utils/translationRequest';
import { Piece, fnv1a, pieceHash } from '../utils/translationPieces';

/**
 * One document waiting for translation (a recipe or a make), as its owner (useRecipes, useMakes)
 * describes it. The queue decides when, and bundles every due document into one request.
 */
export interface TranslationJob {
  /** Unique across kinds (a recipe's id; "make:" and a make's id). */
  id: string;
  /** Its words' fingerprint when asked: a reply for older words is dropped. */
  hash: string;
  /** The pieces to ask for (none: every piece is translated, only the stamp is rebuilt). */
  pieces: Piece[];
  dueAt: number;
  /** May go early, with a request that's going anyway. */
  rideAlong: boolean;
  /** Its language, for a rebuild that asks for nothing. */
  language: Language;
  /** Its entry in a request, for these pieces (on a second try, with what came back so far). */
  doc: (pieces: Piece[], sofar?: PieceTranslation) => TranslationDoc;
  /** Whether a reply's language label suits its words (a document whose language isn't settled). */
  fits: (result: PieceTranslation) => boolean;
  /**
   * Keeps a finished translation. Returns the pieces still untranslated after it, or null when its
   * words changed meanwhile (the new words get their own translation).
   */
  store: (result: PieceTranslation) => Piece[] | null;
}

/** What was tried: the document, its words and its pending pieces, for the retry rules. */
const jobKey = (job: Pick<TranslationJob, 'id' | 'hash'>, pieces: Piece[]) =>
  `${job.id}@${job.hash}@${fnv1a(pieces.map(pieceHash).join())}`;

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

/** Failures that pause every request on this device: a used-up allowance, an overloaded Gemini. */
type TranslationPause = TranslationQuotaError | TranslationBusyError;

const isPause = (err: unknown): err is TranslationPause =>
  err instanceof TranslationQuotaError || err instanceof TranslationBusyError;

/**
 * Pauses every request: until the allowance is back, or, when Gemini is overloaded, for longer
 * each time in a row (busyPauseMs). An overloaded request costs several of the day's allowance.
 */
function pauseRequests(err: TranslationPause) {
  const now = Date.now();
  setTranslationPause(
    err instanceof TranslationQuotaError
      ? err.retryAt
      : now + busyPauseMs(noteTranslationBusy(now)),
  );
}

/** A reply's language, when it's one the document can have (a new document's is checked). */
function replyLanguage(job: TranslationJob, doc: TranslationDoc, reply: DocReply) {
  const language = reply.detectedLanguage;
  if (!language) return undefined;
  const fits =
    doc.language !== undefined || job.fits({ detectedLanguage: language, values: reply.values });
  return fits ? language : undefined;
}

/**
 * Translates the jobs in one request, checking every piece (reviewReply). Whatever didn't pass
 * (left out, amounts changed, still in the original language, or a new document whose language
 * the reply got wrong) is asked for once more, together, in one more request. Resolves to each
 * job's translation (by id; missing when nothing usable came back), and to a pause when the
 * second request found the allowance used up or Gemini overloaded.
 */
async function requestTranslations(jobs: TranslationJob[]): Promise<{
  results: Map<string, PieceTranslation>;
  stopped?: TranslationPause;
}> {
  const docs = jobs.map((job) => job.doc(job.pieces));
  const first = await askOnceMore(docs);
  const rounds = jobs.map((job, i): ReviewedReply & { language?: Language } => {
    const language = replyLanguage(job, docs[i], first[i]);
    if (!language) return { values: new Map(), retry: job.pieces, gaveUp: [] };
    return { language, ...reviewReply(docs[i], first[i], false) };
  });

  const again = jobs.flatMap((job, i) => {
    const { language, values, retry } = rounds[i];
    if (retry.length === 0) return [];
    // Asked with what came back so far as its current translation, in its language.
    const sofar = language ? { detectedLanguage: language, values } : undefined;
    return [{ i, doc: job.doc(retry, sofar) }];
  });
  let stopped: TranslationPause | undefined;
  if (again.length > 0) {
    try {
      const second = await translateDocuments(again.map((a) => a.doc));
      again.forEach(({ i, doc }, j) => {
        const round = rounds[i];
        const language = round.language ?? replyLanguage(jobs[i], doc, second[j]);
        if (!language || (round.language && second[j].detectedLanguage !== language)) return;
        const last = reviewReply(doc, second[j], true);
        round.language = language;
        for (const [hash, value] of last.values) round.values.set(hash, value);
        round.gaveUp.push(...last.gaveUp);
      });
    } catch (err) {
      // What passed the first time is kept; the rest waits for a later request.
      if (isPause(err)) stopped = err;
      else console.warn('Second translation request failed (keeping the first):', err);
    }
  }

  const results = new Map<string, PieceTranslation>();
  jobs.forEach((job, i) => {
    const { language, values, gaveUp } = rounds[i];
    if (language && (values.size > 0 || gaveUp.length > 0)) {
      results.set(job.id, { detectedLanguage: language, values, gaveUp });
    }
  });
  return { results, stopped };
}

/**
 * Translates new and edited documents into their other language, only the pieces that have no
 * translation yet, when they're due (utils/translationQueue), every due document in one request.
 * `collectors` list each kind's waiting documents (memoize it: a new list rescans). Each request
 * is tried once per session; coming back online or reopening the app retries lost connections;
 * an unusable answer is asked for once more at once, then waits longer; a used-up allowance
 * pauses every request until it resets, and an overloaded Gemini for half an hour, then longer.
 */
export function useTranslationQueue(collectors: readonly ((now: number) => TranslationJob[])[]) {
  const triedKeys = useRef(new Set<string>());
  const inFlight = useRef(false);
  const [scan, setScan] = useState(0);

  useEffect(() => {
    if (!isTranslationAvailable || inFlight.current) return;

    const now = Date.now();
    const pausedUntil = getTranslationPause();
    const failures = getTranslationFailures();
    const queue = [];
    // Every piece already translated (e.g. steps only moved): rebuilt here, with no request.
    const rebuilt: TranslationJob[] = [];
    const keys = new Map<TranslationJob, string>();
    for (const job of collectors.flatMap((collect) => collect(now))) {
      const key = jobKey(job, job.pieces);
      if (triedKeys.current.has(key)) continue;
      const failure = failures[key];
      if (failure && now - failure.at < retryDelayMs(failure.count)) continue;
      keys.set(job, key);
      if (job.pieces.length === 0) {
        rebuilt.push(job);
        continue;
      }
      queue.push({
        item: job,
        dueAt: job.dueAt,
        rideAlong: job.rideAlong,
        pieces: job.pieces.length,
        chars: JSON.stringify(job.doc(job.pieces)).length,
      });
    }

    const paused = pausedUntil > now;
    const batch = [...rebuilt, ...(paused ? [] : pickBatch(queue, now))];
    if (batch.length === 0) {
      // Nothing due yet (a head start, an edit settling, or a pause): look again when it is.
      const next = paused ? pausedUntil : Math.min(...queue.map((q) => q.dueAt));
      if (!Number.isFinite(next)) return;
      const timer = window.setTimeout(() => setScan((n) => n + 1), Math.max(1000, next - now));
      return () => window.clearTimeout(timer);
    }

    for (const job of batch) triedKeys.current.add(keys.get(job)!);
    inFlight.current = true;
    const asking = batch.filter((job) => job.pieces.length > 0);

    const store = (job: TranslationJob, result: PieceTranslation) => {
      const left = job.store(result);
      // Pieces still missing after both tries wait: not again this session, then longer.
      if (left && left.length > 0) {
        const leftKey = jobKey(job, left);
        triedKeys.current.add(leftKey);
        recordTranslationFailure(leftKey, Date.now());
      }
    };
    const stamp = (job: TranslationJob) =>
      store(job, { detectedLanguage: job.language, values: new Map() });

    const work = asking.length > 0 ? requestTranslations(asking) : Promise.resolve(null);
    work
      .then((answer) => {
        if (answer) clearTranslationBusy();
        if (answer?.stopped) pauseRequests(answer.stopped);
        for (const job of batch) {
          if (job.pieces.length === 0) {
            stamp(job);
            continue;
          }
          const result = answer?.results.get(job.id);
          if (result) store(job, result);
          // Its second try found the allowance used up or Gemini overloaded: asked for again
          // once the pause is over.
          else if (answer?.stopped) triedKeys.current.delete(keys.get(job)!);
          else recordTranslationFailure(keys.get(job)!, Date.now());
        }
      })
      .catch((err: unknown) => {
        for (const job of rebuilt) stamp(job);
        if (isPause(err)) {
          // Asked for again once the pause is over, even in this session.
          pauseRequests(err);
          for (const job of asking) triedKeys.current.delete(keys.get(job)!);
        } else if (err instanceof TranslationRejectedError) {
          for (const job of asking) recordTranslationFailure(keys.get(job)!, Date.now());
        }
        console.warn('Translation failed (showing the original):', err);
      })
      .finally(() => {
        inFlight.current = false;
        setScan((n) => n + 1);
      });
  }, [collectors, scan]);

  // Back online: retry translations that failed while offline.
  useEffect(() => {
    const handleOnline = () => {
      triedKeys.current.clear();
      setScan((n) => n + 1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
}
