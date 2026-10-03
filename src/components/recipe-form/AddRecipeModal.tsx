import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Lightbulb, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { AuthorMode, Recipe, RecipeDraft, Language, VersionSummary } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { useInertBehind } from '../../hooks/useInertBehind';
import { useExitAnimation } from '../../hooks/useExitAnimation';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { keepStillBelow } from '../../hooks/useListMotion';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import type { ToastAction, ToastTone } from '../../hooks/useToast';
import { resolveAuthor } from '../../utils/ownership';
import { formatVersionDate, RecipeChanges, RestorableField } from '../../utils/recipeVersions';
import { draftVersion, parseDraft } from '../../utils/recipeDrafts';
import { NEW_RECIPE_KEY, forgetKeptEdit, getKeptEdit, keepEdit } from '../../services/storage';
import {
  FormState,
  LegacyLabels,
  emptyForm,
  formFromDraft,
  formFromRecipe,
  formText,
  formToRecipe,
  hasContent,
  ingredientRowsOnly,
  missingName,
  methodToSteps,
  withPasted,
} from '../../utils/recipeForm';
import { ImportedRecipe } from '../../utils/recipeImport';
import { fnv1a } from '../../utils/translationPieces';
import { fetchRecipePhoto, isRecipeImportAvailable } from '../../services/recipeImport';
import { ImportProblem, importRecipe } from '../../services/importRecipe';
import { estimateRecipeMinutes } from '../../utils/timeEstimator';
import { fitsInCloud } from '../../utils/cloudSize';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { AutoGrowTextarea } from '../common/AutoGrowTextarea';
import { RecipeSourceField } from './RecipeSourceField';
import { ConfirmSheet } from '../common/ConfirmSheet';
import { EditorBar } from './EditorBar';
import { BylinePart, EditorByline } from './EditorByline';
import { EditorJumpPills, JumpPlace } from './EditorJumpPills';
import { HeroPhotoField } from './HeroPhotoField';
import { IngredientEditor } from './IngredientEditor';
import { MethodEditor } from './MethodEditor';
import { PasteSheet, PasteTarget } from './PasteSheet';
import { ChangeNoteSheet } from './ChangeNoteSheet';
import { VersionMenu } from './VersionMenu';

const DRAFT_STORAGE_KEY = NEW_RECIPE_KEY;

function writeDraft(json: string) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, json);
  } catch {
    // localStorage full or restricted
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const legacyLabels = (t: UiTranslations): LegacyLabels => ({
  bakingSection: t.bakingOptions,
  bakingPaths: t.legacyBakingPaths,
});

/**
 * Where the unsaved edits of what's open are kept on this phone: an edit, a draft or a remix by
 * what it edits. A new recipe has its own place (DRAFT_STORAGE_KEY).
 */
function keptScope(
  initialRecipe: Recipe | null | undefined,
  draft: RecipeDraft | null | undefined,
  isRemix: boolean,
): string | null {
  if (draft) return `draft:${draft.id}`;
  if (!initialRecipe) return null;
  return `${isRemix ? 'remix' : 'edit'}:${initialRecipe.id}`;
}

// What the open recipe or draft is, as kept edits are made from it: when it was saved, and a
// fingerprint of its words (photos left out, to keep opening quick). A copy made from anything
// else (saved since, or opened in the other language) is out of date.
const keptStamp = (opened: Recipe, savedAt: number | undefined, base: FormState) =>
  `${savedAt ?? opened.updatedAt ?? opened.createdAt ?? 0}:${fnv1a(formText(base))}`;

interface InitialForm {
  form: FormState;
  /** It holds work brought back from this phone. */
  fromDraft: boolean;
  /** The form as it opened before anything kept was put back: what counts as a change. */
  base: FormState;
  /** What the open recipe or draft is, for the copy kept of its edits (see keptStamp). */
  stamp: string;
  /** The change note kept with the edits brought back. */
  keptNote?: string;
}

// Initial contents: what was written here before and kept on this phone (while it's still up
// to date), else a saved draft, else the recipe being edited, else empty.
function loadInitialForm(
  initialRecipe: Recipe | null | undefined,
  draft: RecipeDraft | null | undefined,
  scope: string | null,
  t: UiTranslations,
): InitialForm {
  const opened = draft?.recipe ?? initialRecipe;
  if (opened) {
    const base = formFromRecipe(opened, legacyLabels(t));
    const stamp = keptStamp(opened, draft?.savedAt, base);
    const stored = scope ? getKeptEdit(scope) : null;
    const kept = stored?.base === stamp ? parseDraft(stored.draft) : null;
    if (kept) {
      const form = formFromRecipe(kept.recipe, legacyLabels(t));
      return { form, fromDraft: true, base, stamp, keptNote: kept.changeNote ?? '' };
    }
    return { form: base, fromDraft: false, base, stamp };
  }
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    const form = saved ? formFromDraft(JSON.parse(saved)) : null;
    if (form) return { form, fromDraft: true, base: emptyForm(), stamp: '' };
  } catch {
    // Ignore draft parse failure
  }
  const form = emptyForm();
  return { form, fromDraft: false, base: form, stamp: '' };
}

// The form as it would be saved, with who it's by and the note: compared to tell a change.
const snapshot = (form: FormState, authorMode: AuthorMode, note: string) =>
  JSON.stringify([formToRecipe(form), authorMode, form.author.trim(), note]);

type FieldError = 'title' | 'author' | 'category' | 'ingredients' | 'steps';
type Sheet =
  'paste' | 'discard' | 'leave' | 'delete' | 'startOver' | 'discardDraft' | 'changeNote' | null;

/** The parts shown only once added: a key until then. */
type Extra = 'notes' | 'tips' | 'source';
const EXTRAS: Extra[] = ['notes', 'tips', 'source'];

/**
 * How a new recipe starts when the start sheet filled it in: pasted text, or a recipe read off a
 * website.
 */
export type EditorStart = { text: Record<PasteTarget, string> } | { page: ImportedRecipe };

/** A recipe as written so far, which a draft keeps: unchecked, so it may lack a title. */
export type DraftContent = Omit<Recipe, 'id' | 'createdAt'>;

interface AddRecipeModalProps {
  onClose: () => void;
  /** False when it reopens on another version, which swaps the form in place. */
  animateIn?: boolean;
  /** Where the page opens out of and closes back into (the button that opened it). */
  origin?: { x: number; y: number };
  /**
   * `textChanged` is false when an edit touched only photos, author, category or time.
   * `changeNote` is the author's optional "what changed" (edits only).
   */
  onSave: (
    recipeData: Omit<Recipe, 'id' | 'createdAt'>,
    existingId: string | undefined,
    textChanged: boolean,
    changeNote: string,
  ) => void;
  initialRecipe?: Recipe | null;
  /**
   * Set for a remix: the name of the recipe it's a remix of ('' when that's gone). The form
   * opens on `initialRecipe` (or the remix's draft) and saves a new recipe.
   */
  remixFrom?: string;
  /** A saved draft to carry on with, in place of the recipe as it is (or an empty form). */
  draft?: RecipeDraft | null;
  /** A new recipe filled in from the start sheet (pasted, or from a website). */
  start?: EditorStart;
  /** Keeps what's written as a draft. Missing when there's nobody signed in to keep it for. */
  onSaveDraft?: (content: DraftContent, changeNote: string) => void;
  /** Deletes the open draft (asked to confirm first). */
  onDiscardDraft?: () => void;
  /** Earlier versions the author can restore (edit mode). */
  versions?: VersionSummary[];
  /** Set when the form holds an earlier version: which one, and what differs from the current. */
  restore?: { version: VersionSummary; changes: RecipeChanges };
  /** Loads an earlier version into the form; resolves false if it couldn't be loaded. */
  onPickVersion?: (id: string) => Promise<boolean>;
  /** Goes back to the current version. */
  onKeepCurrent?: () => void;
  /** Deletes the recipe being edited (its owner only); asked to confirm first. */
  onDelete?: () => void;
  /** Shows a message, e.g. "Step removed" with Undo, or a problem (`tone` 'error'). */
  onToast?: (message: string, action?: ToastAction, tone?: ToastTone) => void;
  language?: Language;
  t: UiTranslations;
}

/**
 * The recipe editor: a page that opens out of the button that asked for it, laid out like the
 * recipe page it makes. Mount only while open, keyed by recipe (and restored version), so each
 * opening starts from loadInitialForm().
 */
export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  onClose,
  animateIn = true,
  origin,
  onSave,
  initialRecipe,
  remixFrom,
  draft,
  start,
  onSaveDraft,
  onDiscardDraft,
  versions = [],
  restore,
  onPickVersion,
  onKeepCurrent,
  onDelete,
  onToast = () => {},
  language = 'en',
  t,
}) => {
  // A remix opens on another recipe's content, but saves as a new recipe.
  const isRemix = remixFrom !== undefined;
  const isEditMode = Boolean(initialRecipe) && !isRemix;
  // Closing folds the page back into the button it came from; saving lets it sink away.
  const [exit, setExit] = useState<'cancel' | 'save'>('cancel');
  const { ref: layerRef, isClosing, requestClose } = useExitAnimation<HTMLDivElement>(onClose);
  // A page over the app: what's under it can't be reached (aria-modal alone doesn't stop Tab).
  useInertBehind(layerRef);
  const currentUser = useCurrentUser();

  // A version restored from the history fills the form itself: nothing kept goes over it.
  const [scope] = useState(() => (restore ? null : keptScope(initialRecipe, draft, isRemix)));
  const [initial] = useState(() => {
    const loaded = loadInitialForm(initialRecipe, draft, scope, t);
    if (!start) return loaded;
    // A website's recipe replaces anything kept here; pasted text joins it.
    if ('page' in start) return { ...loaded, form: start.page.form, fromDraft: false };
    return { ...loaded, form: withPasted(loaded.form, start.text).form };
  });
  // What a save to the vault is compared against to tell a text edit: the recipe as the family
  // sees it, even when the form opened on a draft of it.
  const [publishedText] = useState(() =>
    draft && initialRecipe ? formText(formFromRecipe(initialRecipe, legacyLabels(t))) : null,
  );
  const [form, setForm] = useState<FormState>(initial.form);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(initial.fromDraft);
  // With nobody signed in there is no "me" to credit, so the author is always typed.
  const authorMode = currentUser ? form.authorMode : 'custom';
  const initialNote = restore ? t.restoredNote(restore.version.version) : (draft?.changeNote ?? '');
  const [changeNote, setChangeNote] = useState(initial.keptNote ?? initialNote);
  // How it opened, to tell a change: the recipe or draft, not edits kept from before.
  const [baseSnapshot] = useState(() =>
    snapshot(initial.base, currentUser ? initial.base.authorMode : 'custom', initialNote),
  );
  // The version a draft of it becomes (the next, or 1 for a new recipe).
  const nextVersion = draftVersion(isEditMode ? initialRecipe : null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [bylineOpen, setBylineOpen] = useState<BylinePart | null>(null);
  // The note, tip and source opened from their keys (kept open while written in).
  const [openedExtras, setOpenedExtras] = useState<ReadonlySet<Extra>>(
    () => new Set(EXTRAS.filter((key) => initial.form[key].trim() !== '')),
  );
  const [barHeight, setBarHeight] = useState(0);
  // How far the bar slides up when tucked: its banner, less the status-bar inset.
  const [barTuck, setBarTuck] = useState(0);
  const [scroll, setScroll] = useState({ tucked: false, scrolled: false });
  const lastScrollTop = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const nextChangeIndex = useRef(0);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const changes = restore?.changes;
  const restoredClass = (field: RestorableField) =>
    changes?.fields.has(field) ? ' is-restored' : '';
  const restoredChip = (field: RestorableField) =>
    changes?.fields.has(field) && <span className="restored-chip">{t.restoredChip}</span>;

  // --- Kept on this phone ----------------------------------------------------------------

  // What's written is kept on this phone as it's typed, so closing the app by accident loses
  // nothing: a new recipe in its own place; an edit, a draft or a remix by what it edits.
  const keptOnPhone = !initialRecipe && !draft;

  // The content as written, for a draft or the copy kept here: unchecked, so it may lack a title.
  const draftContent = (): DraftContent => ({
    ...formToRecipe(form),
    author: resolveAuthor(authorMode, form.author, currentUser),
    authorMode,
    // So the draft's card shows the author as the saved recipe will.
    ownerNameAsTyped: currentUser?.nameAsTyped || undefined,
    baseYield: initialRecipe?.baseYield ?? 1,
  });

  // Keeping waits for a pause in typing (400ms); closing does it at once, so the last
  // keystrokes aren't lost. What's saved, discarded or emptied stops being kept.
  const pendingKeep = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      pendingKeep.current?.();
    },
    [],
  );
  const draftWorthy = keptOnPhone && hasContent({ ...form, authorMode });
  const latestContent = useRef(draftContent);
  useLayoutEffect(() => {
    latestContent.current = draftContent;
  });
  useEffect(() => {
    const keep = () => {
      pendingKeep.current = null;
      if (keptOnPhone) {
        if (draftWorthy) writeDraft(JSON.stringify({ ...form, authorMode }));
        else clearDraft();
      } else if (scope) {
        if (snapshot(form, authorMode, changeNote) === baseSnapshot) {
          forgetKeptEdit(scope);
          return;
        }
        keepEdit(scope, {
          base: initial.stamp,
          draft: {
            id: scope,
            recipe: latestContent.current(),
            language,
            savedAt: Date.now(),
            changeNote,
          },
        });
      }
    };
    pendingKeep.current = keep;
    const timeout = window.setTimeout(keep, 400);
    return () => window.clearTimeout(timeout);
  }, [
    keptOnPhone,
    draftWorthy,
    form,
    authorMode,
    changeNote,
    scope,
    initial,
    baseSnapshot,
    language,
  ]);

  // --- Checking and saving ----------------------------------------------------------------

  const errorsOf = (): Partial<Record<FieldError, string>> => {
    const errors: Partial<Record<FieldError, string>> = {};
    if (!form.title.trim()) errors.title = t.titleRequired;
    if (authorMode === 'custom' && !form.author.trim()) errors.author = t.authorRequired;
    // An older recipe saved before categories can still be edited; it stays under Other.
    if (!isEditMode && !form.category) errors.category = t.categoryRequired;
    if (!ingredientRowsOnly(form.ingredientRows).some((r) => r.name.trim() || r.amount.trim())) {
      errors.ingredients = t.ingredientsRequired;
    } else if (form.ingredientRows.some(missingName)) {
      errors.ingredients = t.ingredientNameRequired;
    }
    // Photos between the steps don't count as steps.
    if (!methodToSteps(form.sections, form.numberFrom).some((step) => step.text)) {
      errors.steps = t.stepsRequired;
    }
    return errors;
  };
  const errors = showErrors ? errorsOf() : {};

  // The recipe as it would be saved now.
  const recipeFromForm = (): Omit<Recipe, 'id' | 'createdAt'> => {
    const content = formToRecipe(form);
    return {
      ...content,
      author: resolveAuthor(authorMode, form.author, currentUser),
      authorMode,
      // The form requires a pick; an older record keeps what it had until one is made.
      category: content.category || initialRecipe?.category || 'other',
      baseYield: initialRecipe?.baseYield ?? 1,
    };
  };

  const close = (how: 'cancel' | 'save') => {
    setExit(how);
    requestClose();
  };

  const save = () => {
    if (Object.keys(errorsOf()).length > 0) {
      liftFirstMissing();
      return;
    }
    const recipe = recipeFromForm();
    if (!fitsWithTranslations(recipe)) return;
    const textChanged = (publishedText ?? formText(initial.base)) !== formText(form);
    onSave(recipe, isEditMode ? initialRecipe?.id : undefined, textChanged, changeNote);
    forgetKeptCopy();
    // Not reset: the form keeps its content while it sinks away, then unmounts.
    close('save');
  };

  // Too many photos for the cloud to take (it would refuse the save, and the family would never
  // see it): says so, and the editor stays open to take one or two out.
  const fitsWithTranslations = (recipe: DraftContent) => {
    if (fitsInCloud({ ...recipe, translations: initialRecipe?.translations })) return true;
    onToast(t.recipeTooBig, undefined, 'error');
    return false;
  };

  // A draft keeps the form as it is, finished or not: no checks.
  const saveDraft = () => {
    if (!onSaveDraft) return;
    const content = draftContent();
    if (!fitsWithTranslations(content)) return;
    onSaveDraft(content, changeNote);
    forgetKeptCopy();
    close('save');
  };

  // Saved somewhere for real (or let go), so the copy kept on this phone goes.
  const forgetKeptCopy = () => {
    pendingKeep.current = null;
    if (keptOnPhone) clearDraft();
    else if (scope) forgetKeptEdit(scope);
  };

  // What Save still needs, in the page's order: it counts them down on the key, and those fields
  // are dashed in the accent while empty.
  const needed = errorsOf();
  const missing = Object.keys(needed).length;

  // Save with something missing lifts the first of it: into view, with the cursor in it or its
  // popover open. Its message shows under it.
  const liftFirstMissing = () => {
    setShowErrors(true);
    const first = (['title', 'author', 'category', 'ingredients', 'steps'] as const).find(
      (field) => errorsOf()[field],
    );
    if (first === 'author' || first === 'category') setBylineOpen(first);
    requestAnimationFrame(() => {
      const where = first === 'author' || first === 'category' ? 'byline' : first;
      const block = bodyRef.current?.querySelector<HTMLElement>(`[data-field="${where}"]`);
      block?.scrollIntoView?.({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
      if (first === 'title') titleRef.current?.focus({ preventScroll: true });
      else if (first === 'ingredients' || first === 'steps') {
        block
          ?.querySelector<HTMLElement>('[aria-invalid="true"], input, textarea')
          ?.focus({ preventScroll: true });
      }
    });
  };

  // An edit asks what changed (optional) as it saves; a new recipe saves at once.
  const requestSave = () => {
    if (missing > 0) liftFirstMissing();
    else if (isEditMode) setSheet('changeNote');
    else save();
  };

  // --- The note, tip and source: keys until added ------------------------------------------

  const isShown = (key: Extra) =>
    openedExtras.has(key) || form[key].trim() !== '' || Boolean(changes?.fields.has(key));
  const openExtra = (key: Extra, fieldId: string) => {
    setOpenedExtras((open) => new Set(open).add(key));
    // Through the page itself, so an editor closed meanwhile focuses nothing.
    requestAnimationFrame(() =>
      bodyRef.current?.querySelector<HTMLElement>(`[id="${fieldId}"]`)?.focus(),
    );
  };
  // Left empty, it goes back to being a key.
  const putAwayIfEmpty = (key: Extra) => {
    if (form[key].trim()) return;
    setOpenedExtras((open) => {
      const next = new Set(open);
      next.delete(key);
      return next;
    });
  };

  // Changed since it opened: an edit, a remix or a draft from how it was, a new recipe from empty.
  const isDirty = () =>
    initialRecipe || draft
      ? snapshot(form, authorMode, changeNote) !== baseSnapshot
      : hasContent({ ...form, authorMode });
  // Closing with changes offers to keep them as a draft. Without drafts, an edit asks before
  // its changes go, and a new recipe stays kept on this phone.
  const requestCancel = () => {
    if (!isDirty()) close('cancel');
    else if (onSaveDraft) setSheet('leave');
    else if (isEditMode || isRemix) setSheet('discard');
    else close('cancel');
  };
  // Escape and the phone's back gesture close it like the ✕ (asking first when there are
  // changes); sheets and menus opened over it take them for themselves. Without drafts a remix,
  // like an edit, asks before its changes go: nothing else keeps them.
  useDialogDismiss(requestCancel);
  useBackStep(true, () => requestCancel());

  // --- Pasting ----------------------------------------------------------------------------

  // What came in, said once it's on the page.
  const pastedMessage = (ingredients: number, steps: number) =>
    ingredients > 0 && steps > 0
      ? t.pastedBoth(ingredients, steps)
      : steps > 0
        ? t.pastedSteps(steps)
        : t.pastedIngredients(ingredients);
  const importedMessage = (imported: ImportedRecipe) =>
    imported.amountsMissing
      ? t.importDoneNoAmounts
      : imported.guessed
        ? t.importDoneGuessed
        : t.importDone;

  // Pasted text: the ingredient list, the steps, or both at once.
  const addPasted = (text: Record<PasteTarget, string>) => {
    const pasted = withPasted(form, text);
    if (pasted.ingredients === 0 && pasted.steps === 0) return;
    setForm((f) => withPasted(f, text).form);
    onToast(pastedMessage(pasted.ingredients, pasted.steps));
  };

  // A recipe page's address: the form is filled in from the page, and its picture follows. Each
  // import is numbered, so one that's closed or overtaken fills in nothing when it lands.
  const importRun = useRef(0);
  const [photoLoading, setPhotoLoading] = useState(() =>
    Boolean(start && 'page' in start && start.page.imageUrl),
  );
  const pagePending = useRef(false);
  const latestPhoto = useRef(0);

  // The page's picture, fetched once its words are in the form.
  const fetchPagePhoto = (imported: ImportedRecipe) => {
    // The photo answers to the recipe now in the form, not to later attempts that fill nothing.
    const photoRun = ++latestPhoto.current;
    if (!imported.imageUrl) return;
    void fetchRecipePhoto(imported.imageUrl).then((photo) => {
      if (photoRun !== latestPhoto.current) return;
      setPhotoLoading(false);
      if (!photo) {
        onToast(t.importPhotoFailed);
        return;
      }
      // Only into the recipe it belongs to, and never over a photo picked meanwhile.
      setForm((f) =>
        f.source === imported.form.source ? { ...f, heroImage: f.heroImage || photo } : f,
      );
    });
  };

  const importFromWebsite = async (url: string): Promise<ImportProblem | null> => {
    const run = ++importRun.current;
    pagePending.current = true;
    const result = await importRecipe(url, t);
    if (run !== importRun.current) return null;
    pagePending.current = false;
    if ('problem' in result) return result.problem;
    setForm(result.recipe.form);
    setShowErrors(false);
    bodyRef.current?.scrollTo?.({ top: 0 });
    onToast(importedMessage(result.recipe));
    setPhotoLoading(Boolean(result.recipe.imageUrl));
    fetchPagePhoto(result.recipe);
    return null;
  };

  // Opened from the start sheet already filled in (the form's initial state): once it's up, it
  // says what came in, and a website's picture follows. Kept from the first render, as it opened.
  const [announceStart] = useState(() => () => {
    if (!start) return;
    if ('page' in start) {
      onToast(importedMessage(start.page));
      fetchPagePhoto(start.page);
    } else {
      const pasted = withPasted(emptyForm(), start.text);
      onToast(pastedMessage(pasted.ingredients, pasted.steps));
    }
  });
  useEffect(() => announceStart(), [announceStart]);

  // Closing the editor lets go of an import still on its way.
  useEffect(
    () => () => {
      importRun.current = -1;
      latestPhoto.current = -1;
    },
    [],
  );

  // --- Version restore --------------------------------------------------------------------

  // Brings the next highlighted field into view, cycling through them.
  const showNextChange = () => {
    const highlighted = bodyRef.current?.querySelectorAll<HTMLElement>('.is-restored');
    if (!highlighted?.length) return;
    const target = highlighted[nextChangeIndex.current % highlighted.length];
    nextChangeIndex.current += 1;
    target.scrollIntoView?.({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  // --- The page -------------------------------------------------------------------------

  // The item under a tap or focus: its tools open, and any other's close. Only a finished tap or
  // focus counts, never a touch alone, so a scroll that starts on a step leaves it be.
  const activate = (target: EventTarget) => {
    const item = (target as Element).closest?.<HTMLElement>('[data-item-id]') ?? null;
    const id = item?.dataset.itemId ?? null;
    if (id === activeId) return;
    const scroller = bodyRef.current;
    const open = [...(scroller?.querySelectorAll<HTMLElement>('[data-item-id]') ?? [])].find(
      (el) => el.dataset.itemId === activeId,
    );
    // The open item's tools fold away above what was tapped: keep that under the finger.
    if (scroller && open && open.compareDocumentPosition(target as Node) & 4) {
      keepStillBelow(scroller, open);
    }
    setActiveId(id);
  };

  // --- The jump pills ----------------------------------------------------------------------

  // Under the bar once the ingredients have scrolled up to it, and kept there through a glide
  // from a pill and through scrolling about: only a long run down the page (a screen and a half) puts
  // them away, and any scroll up brings them back. The lit one is the place being read.
  const [jump, setJump] = useState<{ shown: boolean; current: JumpPlace }>({
    shown: false,
    current: 'ingredients',
  });
  // How far the page has run down since it last went up (or glided).
  const runDown = useRef(0);
  // Gliding to a pill's place: the scrolling it does moves neither the bar nor the pills.
  const glide = useRef<{ to: JumpPlace; idle: number; cap: number } | null>(null);
  const jumpRef = useRef<HTMLElement | null>(null);

  const placeEl = (place: JumpPlace) =>
    bodyRef.current?.querySelector<HTMLElement>(`[data-jump="${place}"]`) ?? null;

  // The place being read: the last whose top is above a line a third of the way down what the
  // bar leaves in view, or the last of all once the page can't scroll further.
  const placeAt = (scroller: HTMLElement, top: number, visibleTop: number): JumpPlace => {
    if (top + scroller.clientHeight >= scroller.scrollHeight - 2) {
      const last = jumpPlaces[jumpPlaces.length - 1];
      return last ?? 'ingredients';
    }
    const line = visibleTop + (scroller.clientHeight - visibleTop) / 3;
    const box = scroller.getBoundingClientRect().top;
    let current: JumpPlace = 'ingredients';
    for (const place of jumpPlaces) {
      const el = placeEl(place);
      if (el && el.getBoundingClientRect().top - box <= line) current = place;
    }
    return current;
  };

  const endGlide = () => {
    const g = glide.current;
    if (!g) return;
    window.clearTimeout(g.idle);
    window.clearTimeout(g.cap);
    glide.current = null;
    runDown.current = 0;
  };
  useEffect(() => endGlide, []);

  const jumpTo = (place: JumpPlace) => {
    const scroller = bodyRef.current;
    const el = placeEl(place);
    if (!scroller || !el) return;
    // Clear of the bar and the pills under it, with a little air.
    const under = jumpRef.current?.getBoundingClientRect().bottom ?? barHeight;
    const target = Math.max(
      0,
      Math.min(
        scroller.scrollHeight - scroller.clientHeight,
        scroller.scrollTop + el.getBoundingClientRect().top - under - 12,
      ),
    );
    endGlide();
    setJump({ shown: true, current: place });
    if (Math.abs(target - scroller.scrollTop) < 1) return;
    // Over when the scrolling stops (a quiet moment), or after a second whatever happens.
    glide.current = {
      to: place,
      idle: window.setTimeout(endGlide, 400),
      cap: window.setTimeout(endGlide, 1200),
    };
    scroller.scrollTo({ top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scroller = e.currentTarget;
    const top = scroller.scrollTop;
    const delta = top - lastScrollTop.current;
    lastScrollTop.current = top;
    const scrolled = top > 2;
    const g = glide.current;
    if (g) {
      window.clearTimeout(g.idle);
      g.idle = window.setTimeout(endGlide, 140);
      if (scrolled !== scroll.scrolled) setScroll({ ...scroll, scrolled });
      return;
    }
    // Down past the bar tucks the tools away; any scroll up brings them back.
    const tucked = delta > 4 && top > barHeight ? true : delta < -4 ? false : scroll.tucked;
    if (tucked !== scroll.tucked || scrolled !== scroll.scrolled) setScroll({ tucked, scrolled });

    const visibleTop = barHeight - (tucked ? barTuck : 0);
    const ingredients = placeEl('ingredients');
    const box = scroller.getBoundingClientRect().top;
    const into = ingredients ? ingredients.getBoundingClientRect().top - box <= visibleTop : false;
    if (delta < -4) runDown.current = 0;
    else if (delta > 0 && jump.shown) runDown.current += delta;
    const shown = into && runDown.current < scroller.clientHeight * 1.5;
    if (!into) runDown.current = 0;
    const current = placeAt(scroller, top, visibleTop);
    if (shown !== jump.shown || current !== jump.current) setJump({ shown, current });
  };

  // --- Reading -------------------------------------------------------------------------------

  // Read shows the page as the family will see it: prompts, add keys, tools and empty parts put
  // away, and the fields' edges gone. They fade out first, and fade back in after they return.
  // Whatever is being read at the top stays where it is as the page closes up or opens out.
  // Tapping any part while reading goes back to writing, there.
  const [read, setRead] = useState<'write' | 'to-read' | 'read' | 'to-write'>('write');
  const reading = read === 'read';
  const readTimer = useRef(0);
  const readHold = useRef<{ el: Element; top: number } | null>(null);
  useEffect(() => () => window.clearTimeout(readTimer.current), []);

  const holdPlace = (prefer?: Element | null) => {
    const scroller = bodyRef.current;
    if (!scroller) return;
    const line = scroller.getBoundingClientRect().top + barHeight - (scroll.tucked ? barTuck : 0);
    const el =
      prefer ??
      [
        ...scroller.querySelectorAll(
          // Parts small enough to hold still: rows and steps, not whole sections.
          '.editor-page-name, .editor-page-byline, .ingredient-table-head, .method-section-head, [data-item-id]:not(.is-blank), .editor-extra:has(.form-group)',
        ),
      ].find((part) => part.getBoundingClientRect().bottom > line);
    readHold.current = el ? { el, top: el.getBoundingClientRect().top } : null;
  };

  useLayoutEffect(() => {
    const hold = readHold.current;
    const scroller = bodyRef.current;
    readHold.current = null;
    if (!hold || !scroller || !hold.el.isConnected) return;
    const moved = hold.el.getBoundingClientRect().top - hold.top;
    if (Math.abs(moved) < 1) return;
    scroller.scrollTop += moved;
    // Not a scroll by the reader: the bar and the pills stay as they are.
    lastScrollTop.current = scroller.scrollTop;
  }, [reading]);

  const startReading = () => {
    window.clearTimeout(readTimer.current);
    setActiveId(null);
    setBylineOpen(null);
    // The keyboard goes down: nothing is being written in.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && layerRef.current?.contains(focused)) {
      if (focused.matches('input, textarea')) focused.blur();
    }
    if (prefersReducedMotion()) {
      holdPlace();
      setRead('read');
      return;
    }
    setRead('to-read');
    readTimer.current = window.setTimeout(() => {
      holdPlace();
      setRead('read');
    }, 170);
  };

  const stopReading = (at?: Element | null) => {
    window.clearTimeout(readTimer.current);
    if (!reading) {
      // Still fading out: it comes straight back.
      setRead('write');
      return;
    }
    holdPlace(at);
    if (prefersReducedMotion()) {
      setRead('write');
      return;
    }
    // Back in place, fading in.
    setRead('to-write');
    readTimer.current = window.setTimeout(() => setRead('write'), 260);
  };

  // Pressed from the tap that starts it until the one that ends it.
  const readPressed = read === 'to-read' || read === 'read';
  const toggleRead = () => (readPressed ? stopReading() : startReading());

  // The places the pills jump to: in Read, the tip and source only once one is written.
  const jumpPlaces: JumpPlace[] =
    reading && !form.tips.trim() && !form.source.trim()
      ? ['ingredients', 'steps']
      : ['ingredients', 'steps', 'extras'];

  // A sheet over the page: the page under it is out of reach (Tab included).
  const covered = sheet !== null;

  const estimate = estimateRecipeMinutes({ steps: methodToSteps(form.sections, form.numberFrom) });
  // How far the opening circle must grow to cover the screen: to the corner farthest from it.
  const reach = origin
    ? Math.ceil(
        Math.hypot(
          Math.max(origin.x, window.innerWidth - origin.x),
          Math.max(origin.y, window.innerHeight - origin.y),
        ),
      )
    : null;
  let rise = 0;
  const riseStyle = () => ({ '--i': rise++ }) as React.CSSProperties;

  return (
    <div
      ref={layerRef}
      className={`editor-layer${animateIn ? '' : ' is-instant'}${isClosing ? ' is-closing' : ''}${scroll.tucked ? ' is-tucked' : ''}${reading ? ' is-reading' : ''}${read === 'to-read' ? ' is-reading-soon' : read === 'to-write' ? ' is-read-ending' : ''}`}
      data-exit={exit}
      id="addRecipeModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editorTitle"
      style={
        {
          '--editor-origin-x': origin ? `${origin.x}px` : '50%',
          '--editor-origin-y': origin ? `${origin.y}px` : '100%',
          '--editor-reach': reach ? `${reach}px` : '150vmax',
          '--editor-bar-height': `${barHeight}px`,
          '--editor-banner-height': `${barTuck}px`,
        } as React.CSSProperties
      }
    >
      <EditorBar
        isEditMode={isEditMode}
        isRemix={isRemix}
        version={initialRecipe?.version ?? 1}
        draftLabel={draft ? t.draftLabel(nextVersion) : undefined}
        hasVersions={Boolean(onPickVersion) && versions.length > 0}
        versionsOpen={versionsOpen}
        onToggleVersions={() => setVersionsOpen(!versionsOpen)}
        status={
          isEditMode
            ? hasRestoredDraft
              ? t.draftRestored
              : null
            : draft
              ? t.draftLabel(nextVersion)
              : remixFrom
                ? t.remixingFrom(remixFrom)
                : hasRestoredDraft
                  ? t.draftRestored
                  : draftWorthy
                    ? t.draftSaved
                    : null
        }
        tucked={scroll.tucked}
        scrolled={scroll.scrolled}
        onClose={requestCancel}
        onSave={requestSave}
        missing={missing}
        onSaveDraft={onSaveDraft ? saveDraft : undefined}
        draftName={t.saveDraft(nextVersion)}
        // Pasting is for starting a recipe; an edit changes what's there.
        onPaste={isEditMode ? undefined : () => setSheet('paste')}
        reading={readPressed}
        onToggleRead={toggleRead}
        jump={
          <EditorJumpPills
            ref={jumpRef}
            shown={jump.shown}
            current={jump.current}
            places={jumpPlaces}
            onJump={jumpTo}
            t={t}
          />
        }
        onStartOver={hasRestoredDraft ? () => setSheet('startOver') : undefined}
        onDiscardDraft={draft && onDiscardDraft ? () => setSheet('discardDraft') : undefined}
        onHeight={(height, tuck) => {
          setBarHeight(height);
          setBarTuck(tuck);
        }}
        inert={covered}
        t={t}
      >
        {versionsOpen && onPickVersion && (
          <VersionMenu
            current={{
              version: initialRecipe?.version ?? 1,
              savedAt: initialRecipe?.updatedAt ?? initialRecipe?.createdAt ?? 0,
              note: initialRecipe?.changeNote,
            }}
            versions={versions}
            shownId={restore?.version.id}
            language={language}
            onPick={onPickVersion}
            onClose={() => setVersionsOpen(false)}
            t={t}
          />
        )}
      </EditorBar>

      <div
        className="editor-scroll"
        ref={bodyRef}
        inert={covered}
        onScroll={handleScroll}
        onFocus={(e) => {
          if (readPressed) stopReading((e.target as Element).closest('[data-item-id]') ?? e.target);
          activate(e.target);
        }}
        // A touch that turns into a scroll ends in pointercancel, never pointerup.
        onPointerUp={(e) => activate(e.target)}
      >
        <div className="editor-body">
          {restore && (
            <div className="restore-banner" role="status">
              <RotateCcw size="1.1em" strokeWidth={2} aria-hidden="true" />
              <div className="restore-banner-text">
                <strong>
                  {t.restoredFrom(
                    restore.version.version,
                    formatVersionDate(restore.version.savedAt, language),
                  )}
                </strong>
                <span>
                  {restore.changes.count > 0 ? t.changesCount(restore.changes.count) : t.noChanges}
                </span>
              </div>
              <div className="restore-banner-actions">
                {restore.changes.count > 0 && (
                  <button type="button" className="btn btn-meta-pill" onClick={showNextChange}>
                    {t.nextChange}
                    <ChevronDown size="1em" aria-hidden="true" />
                  </button>
                )}
                <button type="button" className="btn btn-meta-pill" onClick={onKeepCurrent}>
                  {t.keepCurrent}
                </button>
              </div>
            </div>
          )}

          {/* The photo, as the recipe page opens with it */}
          <div
            className={`editor-page-hero editor-rise${restoredClass('heroImage')}${!form.heroImage && !photoLoading ? ' is-blank' : ''}`}
            style={riseStyle()}
          >
            {restoredChip('heroImage')}
            <span className="sr-only" id="heroPhotoLabel">
              {t.heroPhoto}
            </span>
            <HeroPhotoField
              photo={form.heroImage}
              onChange={(photo) => set('heroImage', photo)}
              loading={photoLoading}
              labelId="heroPhotoLabel"
              t={t}
            />
          </div>

          {/* The name, as the page's title */}
          <div
            className={`editor-page-name editor-rise${restoredClass('name')}${needed.title ? ' is-needed' : ''}${errors.title ? ' has-error' : ''}`}
            data-field="title"
            style={riseStyle()}
          >
            {restoredChip('name')}
            <label className="sr-only" htmlFor="recipeTitleInput">
              {t.recipeTitle}
            </label>
            <div className="prompt-field editor-page-title">
              <AutoGrowTextarea
                ref={titleRef}
                id="recipeTitleInput"
                className="editor-page-title-input"
                required
                autoComplete="off"
                enterKeyHint="next"
                aria-invalid={Boolean(errors.title) || undefined}
                aria-describedby={errors.title ? 'recipeTitleError' : undefined}
                value={form.title}
                // A name is one line: Enter doesn't break it, and a pasted break becomes a space.
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.preventDefault();
                }}
                onChange={(e) => set('title', e.target.value.replace(/\s*\n\s*/g, ' '))}
              />
              {!form.title && (
                <span className="field-prompt" aria-hidden="true">
                  {t.titlePrompt}
                </span>
              )}
            </div>
            {errors.title && (
              <p className="field-error" id="recipeTitleError" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* The byline: whose it is, its category and its times, each opening its own popover */}
          <div
            className={`editor-page-byline editor-rise${errors.author || errors.category ? ' has-error' : ''}`}
            data-field="byline"
            style={riseStyle()}
          >
            <EditorByline
              open={bylineOpen}
              onOpen={setBylineOpen}
              currentUser={currentUser}
              authorMode={authorMode}
              onAuthorMode={(mode) => set('authorMode', mode)}
              author={form.author}
              onAuthor={(name) => set('author', name)}
              category={form.category}
              onCategory={(category) => set('category', category)}
              times={form.times}
              manualMinutes={form.manualMinutes}
              estimate={estimate}
              onTime={(kind, text) =>
                setForm((f) => ({ ...f, times: { ...f.times, [kind]: text } }))
              }
              errors={{ author: errors.author, category: errors.category }}
              restored={{
                author: changes?.fields.has('author'),
                time: changes?.fields.has('time'),
              }}
              t={t}
            />
          </div>

          {/* The card's line, quiet under the byline */}
          <div
            className={`editor-page-desc editor-rise${restoredClass('cardDescription')}${form.cardDescription.trim() ? '' : ' is-blank'}`}
            style={riseStyle()}
          >
            {restoredChip('cardDescription')}
            <label className="sr-only" htmlFor="recipeDescInput">
              {t.descriptionLabel}
            </label>
            <div className="prompt-field editor-page-desc-text">
              <AutoGrowTextarea
                id="recipeDescInput"
                className="editor-page-desc-input"
                value={form.cardDescription}
                onChange={(e) => set('cardDescription', e.target.value)}
              />
              {!form.cardDescription && (
                <span className="field-prompt" aria-hidden="true">
                  {t.descriptionPrompt}
                </span>
              )}
            </div>
          </div>

          {/* Crucial note, above the ingredients as the recipe page shows it */}
          <div className={`editor-extra editor-rise${restoredClass('notes')}`} style={riseStyle()}>
            {isShown('notes') ? (
              <div className="form-group editor-callout is-warn">
                {restoredChip('notes')}
                <label className="callout-label" htmlFor="recipeNotesInput">
                  <TriangleAlert size="1.15em" aria-hidden="true" />
                  {t.crucialNote}
                </label>
                <AutoGrowTextarea
                  id="recipeNotesInput"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  onBlur={() => putAwayIfEmpty('notes')}
                />
              </div>
            ) : (
              <button
                type="button"
                className="editor-add-key is-warn"
                onClick={() => openExtra('notes', 'recipeNotesInput')}
              >
                <TriangleAlert size="1.15em" aria-hidden="true" />
                {t.addCrucialNote}
              </button>
            )}
          </div>

          <div
            className={`editor-rise${needed.ingredients === t.ingredientsRequired ? ' is-needed' : ''}${errors.ingredients ? ' has-error' : ''}`}
            data-field="ingredients"
            data-jump="ingredients"
            style={riseStyle()}
          >
            <IngredientEditor
              rows={form.ingredientRows}
              onChange={(change) =>
                setForm((f) => ({ ...f, ingredientRows: change(f.ingredientRows) }))
              }
              yieldHeader={form.yieldHeader}
              onYieldChange={(value) => set('yieldHeader', value)}
              activeId={activeId}
              restoredRows={changes?.ingredients}
              restoredYield={changes?.fields.has('yieldHeader')}
              error={errors.ingredients}
              nameless={
                showErrors
                  ? new Set(form.ingredientRows.filter(missingName).map((row) => row.id))
                  : undefined
              }
              onToast={onToast}
              t={t}
            />
          </div>

          <div
            className={`editor-rise${needed.steps ? ' is-needed' : ''}${errors.steps ? ' has-error' : ''}`}
            data-field="steps"
            data-jump="steps"
            style={riseStyle()}
          >
            <MethodEditor
              sections={form.sections}
              onChange={(change) => setForm((f) => ({ ...f, sections: change(f.sections) }))}
              numberFrom={form.numberFrom}
              activeId={activeId}
              restoredSteps={changes?.steps}
              error={errors.steps}
              onToast={onToast}
              t={t}
            />
          </div>

          {/* Kitchen tip, after the method as the recipe page shows it */}
          <div
            className={`editor-extra editor-rise${restoredClass('tips')}`}
            data-jump="extras"
            style={riseStyle()}
          >
            {isShown('tips') ? (
              <div className="form-group editor-callout is-tip">
                {restoredChip('tips')}
                <label className="callout-label" htmlFor="recipeTipsInput">
                  <Lightbulb size="1.15em" aria-hidden="true" />
                  {t.kitchenTip}
                </label>
                <AutoGrowTextarea
                  id="recipeTipsInput"
                  value={form.tips}
                  onChange={(e) => set('tips', e.target.value)}
                  onBlur={() => putAwayIfEmpty('tips')}
                />
              </div>
            ) : (
              <button
                type="button"
                className="editor-add-key is-tip"
                onClick={() => openExtra('tips', 'recipeTipsInput')}
              >
                <Lightbulb size="1.15em" aria-hidden="true" />
                {t.addKitchenTip}
              </button>
            )}
          </div>

          {/* Where it's from: shown as "Adapted from" at the recipe's foot */}
          <div className={`editor-extra editor-rise${restoredClass('source')}`} style={riseStyle()}>
            {isShown('source') ? (
              <div
                className="form-group"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) putAwayIfEmpty('source');
                }}
              >
                {restoredChip('source')}
                <RecipeSourceField value={form.source} onChange={(v) => set('source', v)} t={t} />
              </div>
            ) : (
              <button
                type="button"
                className="editor-add-key"
                onClick={() => openExtra('source', 'recipeSourceInput')}
              >
                <BookOpen size="1.1em" aria-hidden="true" />
                {t.sourceLabel}
              </button>
            )}
          </div>

          {isEditMode && onDelete && (
            <div className="delete-recipe-zone">
              <button
                type="button"
                className="btn btn-danger-quiet"
                onClick={() => setSheet('delete')}
              >
                <Trash2 size="1em" aria-hidden="true" />
                {t.deleteRecipe}
              </button>
            </div>
          )}
        </div>
      </div>

      {sheet === 'paste' && (
        <PasteSheet
          onAdd={addPasted}
          onImport={isRecipeImportAvailable ? importFromWebsite : undefined}
          replaces={hasContent({ ...form, authorMode })}
          onClose={() => {
            // Closed while a page was still being read: that page fills in nothing.
            if (pagePending.current) {
              pagePending.current = false;
              importRun.current += 1;
            }
            setSheet(null);
          }}
          t={t}
        />
      )}
      {sheet === 'changeNote' && (
        <ChangeNoteSheet
          title={t.savingVersion(nextVersion)}
          label={t.changeNoteLabel(initialRecipe?.version ?? 1)}
          note={changeNote}
          onNote={setChangeNote}
          onSave={save}
          onClose={() => setSheet(null)}
          t={t}
        />
      )}
      {sheet === 'discard' && (
        <ConfirmSheet
          title={t.discardTitle}
          message={t.discardBody}
          confirmLabel={t.discard}
          cancelLabel={t.keepEditing}
          danger
          onConfirm={() => {
            forgetKeptCopy();
            close('cancel');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'leave' && (
        <ConfirmSheet
          title={t.leaveTitle}
          message={t.leaveBody}
          alternative={{ label: t.saveDraft(nextVersion), onSelect: saveDraft }}
          confirmLabel={t.discard}
          cancelLabel={t.keepEditing}
          danger
          onConfirm={() => {
            forgetKeptCopy();
            close('cancel');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'discardDraft' && onDiscardDraft && (
        <ConfirmSheet
          title={t.discardDraft}
          message={t.discardDraftBody}
          confirmLabel={t.discardDraft}
          cancelLabel={t.keepEditing}
          danger
          onConfirm={() => {
            onDiscardDraft();
            forgetKeptCopy();
            close('cancel');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'delete' && onDelete && (
        <ConfirmSheet
          title={t.deleteRecipe}
          message={t.confirmDeleteRecipe(initialRecipe?.name ?? '')}
          confirmLabel={t.deleteRecipe}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            forgetKeptCopy();
            onDelete();
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'startOver' && (
        <ConfirmSheet
          title={t.startOver}
          message={keptOnPhone ? t.confirmClearDraft : t.confirmRevertEdit}
          confirmLabel={t.startOver}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            forgetKeptCopy();
            // A new recipe starts empty again; an edit goes back to how it opened.
            setForm(keptOnPhone ? emptyForm() : initial.base);
            setChangeNote(initialNote);
            setHasRestoredDraft(false);
            setShowErrors(false);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
};
