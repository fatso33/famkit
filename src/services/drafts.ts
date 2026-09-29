import { collection, deleteDoc, doc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { RecipeDraft } from '../types/recipe';
import { parseDraft } from '../utils/recipeDrafts';

/**
 * Drafts live in `drafts/{email}/recipes/{draftId}` (the email in lowercase), which only that
 * family member can read or write (firestore.rules). Without Firebase (local dev) they're kept in
 * this device's storage instead.
 */
const DRAFTS_COLLECTION = 'drafts';
const DRAFT_RECIPES = 'recipes';
const LOCAL_DRAFTS_KEY = 'family_kitchen_drafts';

const owner = (email: string) => email.trim().toLowerCase();

// --- Without Firebase: this device's storage --------------------------------------------------

const localListeners = new Set<() => void>();

function readLocal(email: string): RecipeDraft[] {
  try {
    const all: unknown = JSON.parse(localStorage.getItem(LOCAL_DRAFTS_KEY) || '{}');
    const mine = (all as Record<string, unknown>)[owner(email)];
    return Array.isArray(mine)
      ? mine.map(parseDraft).filter((d): d is RecipeDraft => d !== null)
      : [];
  } catch {
    return [];
  }
}

function writeLocal(email: string, change: (drafts: RecipeDraft[]) => RecipeDraft[]) {
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(localStorage.getItem(LOCAL_DRAFTS_KEY) || '{}') as Record<string, unknown>;
  } catch {
    // Unreadable: start again.
  }
  all[owner(email)] = change(readLocal(email));
  // Throws when storage is full, which the caller reports.
  localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(all));
  localListeners.forEach((listener) => listener());
}

// --- Drafts ---------------------------------------------------------------------------------

/** Listens to this family member's drafts. Returns the unsubscribe function. */
export function subscribeToDrafts(
  email: string,
  onUpdate: (drafts: RecipeDraft[]) => void,
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    const emit = () => onUpdate(readLocal(email));
    emit();
    localListeners.add(emit);
    return () => localListeners.delete(emit);
  }
  return onSnapshot(
    collection(db, DRAFTS_COLLECTION, owner(email), DRAFT_RECIPES),
    (snapshot) => {
      const drafts: RecipeDraft[] = [];
      snapshot.forEach((docSnap) => {
        const draft = parseDraft(docSnap.data());
        if (draft) drafts.push(draft);
      });
      onUpdate(drafts);
    },
    (error) => {
      // Drafts are a convenience: the vault works without them.
      console.warn('Drafts subscription error (drafts unavailable for now):', error);
    },
  );
}

/** Saves a draft, replacing any earlier one with the same id. */
export async function saveDraftToCloud(email: string, draft: RecipeDraft): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    writeLocal(email, (drafts) => [...drafts.filter((d) => d.id !== draft.id), draft]);
    return;
  }
  await setDoc(doc(db, DRAFTS_COLLECTION, owner(email), DRAFT_RECIPES, draft.id), draft);
}

/** Removes a draft: discarded, or saved to the vault. */
export async function deleteDraftFromCloud(email: string, id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    writeLocal(email, (drafts) => drafts.filter((d) => d.id !== id));
    return;
  }
  await deleteDoc(doc(db, DRAFTS_COLLECTION, owner(email), DRAFT_RECIPES, id));
}
