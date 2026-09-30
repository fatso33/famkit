import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from './hooks/useTheme';
import { useFontScale } from './hooks/useFontScale';
import { useSeason } from './hooks/useSeason';
import { useLanguage } from './hooks/useLanguage';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useRecipes, getLocalizedRecipe } from './hooks/useRecipes';
import { useToast } from './hooks/useToast';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useBackStep } from './hooks/useBackStep';
import { useSeenRecipes } from './hooks/useSeenRecipes';
import { useDrafts } from './hooks/useDrafts';
import { isFirebaseConfigured } from './services/firebase';
import { canEditRecipe, isOwnRecipe } from './utils/ownership';
import { hasLeftOutPhotos } from './utils/deviceCopy';
import {
  editingLanguage,
  localizeRecipe,
  recipeForEditing,
  resolveEdit,
} from './utils/recipeTranslation';
import { diffRecipes, recipeAtVersion, versionSummaries } from './utils/recipeVersions';
import { restorableRecipes } from './utils/recipeTrash';
import {
  draftFor,
  draftVersion,
  editDraftId,
  newDraftId,
  newRecipeDrafts,
} from './utils/recipeDrafts';
import { NO_FILTER } from './utils/vault';
import {
  getStoredVaultSort,
  getStoredVaultView,
  setStoredVaultSort,
  setStoredVaultView,
} from './services/storage';
import {
  isOnScreen,
  prefersReducedMotion,
  setFlipAxis,
  transitionTheme,
  transitionView,
  type NavMotion,
} from './utils/viewTransition';
import { SeasonPreference } from './utils/season';
import {
  remixLanguage,
  remixOriginal,
  remixOriginalId,
  remixStart,
  remixesOf,
} from './utils/recipeRemix';
import { PencilLine, Plus, Shuffle } from 'lucide-react';
import { FloatingMenu, MenuAction } from './components/layout/FloatingMenu';
import { InstallCard } from './components/layout/InstallCard';
import { RecipeGridView } from './components/recipe-grid/RecipeGridView';
import {
  RecipeDetailView,
  type RecipePageHandle,
} from './components/recipe-detail/RecipeDetailView';
import { AddRecipeModal, type DraftContent } from './components/recipe-form/AddRecipeModal';
import { IOSInstallModal } from './components/layout/IOSInstallModal';
import { MakesView } from './components/makes/MakesView';
import { SettingsView } from './components/settings/SettingsView';
import { Toast } from './components/common/Toast';
import {
  Language,
  Recipe,
  RecipeDraft,
  RecipeVersion,
  VaultFilter,
  VaultSort,
  VaultView,
} from './types/recipe';
import { AppPage, MainPage } from './types/navigation';

// Page changes jump straight to their scroll position: html's smooth scrolling would
// otherwise play out in the middle of the page transition.
const jumpTo = (top: number) => window.scrollTo({ top, behavior: 'instant' });

/** The centre of an element on screen, where a page can open out of it. */
const centreOf = (el: Element | null) => {
  if (!el) return undefined;
  const { left, top, width, height } = el.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2 };
};

// How long a tapped card takes to lift out of the box before it flips (index.css, data-lifted).
const CARD_LIFT_MS = 200;

/** Whether a recipe card can flip open and shut (a view transition, and motion welcome). */
const canFlip = () => !!document.startViewTransition && !prefersReducedMotion();

interface NavigateOptions {
  /** False when the browser already animated it (the iOS back swipe). */
  animated?: boolean;
  /** False when the open recipe's card won't be there to flip back into. */
  morph?: boolean;
  /** How the page moves, when not the usual for where it's going. */
  motion?: NavMotion;
  /** Other state changes that belong to the same transition. */
  alongside?: () => void;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { percent: fontPercent, increaseScale, decreaseScale } = useFontScale();
  const {
    preference: seasonPreference,
    season,
    calendarSeason,
    setPreference: setSeasonPreference,
    seasonFor,
  } = useSeason();
  const { language, toggleLanguage, t } = useLanguage();
  const { isBannerVisible, triggerInstall, dismissBanner, showIOSModal, setShowIOSModal } =
    usePWAInstall();

  const { toast, visible: isToastVisible, showToast, hideToast, clearToast } = useToast();
  const currentUser = useCurrentUser();
  const { seen, markSeen } = useSeenRecipes(currentUser?.email ?? '');

  const {
    recipes,
    allRecipes,
    selectedRecipe,
    setSelectedRecipeId,
    addRecipe,
    updateRecipe,
    loadVersion,
    deleteRecipe,
    restoreRecipe,
  } = useRecipes(currentUser);
  // The signed-in family member's unfinished recipes and edits, seen only by them.
  const {
    drafts,
    loaded: draftsLoaded,
    saveDraft,
    discardDraft,
    canDraft,
  } = useDrafts(currentUser);

  const [page, setPage] = useState<AppPage>('recipes');
  // The last main page (not Settings), where the back gesture returns to.
  const [mainPage, setMainPage] = useState<MainPage>('recipes');
  // The vault's filter and each main page's scroll survive a visit to a sub-page, so going
  // back returns to the same spot (and a recipe's photo can shrink back into its card).
  const [vaultFilter, setVaultFilter] = useState<VaultFilter>(NO_FILTER);
  // What the Unseen filter goes by: the recipes opened as of its last change, so one opened
  // from the unseen list is still there to come back to (and its photo still has its card).
  const [seenForFilter, setSeenForFilter] = useState(seen);
  // How the vault is ordered and laid out is this person's preference, kept on the device.
  const [vaultSort, setVaultSort] = useState<VaultSort>(getStoredVaultSort);
  const [vaultView, setVaultView] = useState<VaultView>(getStoredVaultView);
  // The vault's banner plays its entrance when the vault arrives, not when a recipe or
  // Settings slides back to reveal it.
  const [vaultEntrance, setVaultEntrance] = useState(true);
  const mainScroll = useRef<Record<MainPage, number>>({ recipes: 0, makes: 0 });
  // The recipe last opened from the vault: its card is the one that flips open and shut.
  const [lastRecipeId, setLastRecipeId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  // The draft the editor carried on with, if any: saving it again replaces it.
  const [editingDraft, setEditingDraft] = useState<RecipeDraft | null>(null);
  // A remix the editor holds: the recipe it's a remix of, what the form starts from (none when
  // it carries on with the remix's draft), and the language it's written in.
  const [remixing, setRemixing] = useState<{
    from: string;
    start: Recipe | null;
    language: Language;
  } | null>(null);
  // Whether the drafts were known when the editor opened. An edit opened before then can't tell
  // if its recipe already has a draft, which saving one would replace unseen.
  const [draftsKnownAtOpen, setDraftsKnownAtOpen] = useState(false);
  // Where the editor opens out of: the button that asked for it.
  const [editorOrigin, setEditorOrigin] = useState<{ x: number; y: number } | undefined>();
  // An earlier version the author loaded into the editor, to restore on save.
  const [restoredVersion, setRestoredVersion] = useState<RecipeVersion | null>(null);
  // Switching versions remounts the editor, which shouldn't slide in again.
  const [editorReopened, setEditorReopened] = useState(false);
  // The open recipe page (its step photo viewer).
  const recipePage = useRef<RecipePageHandle>(null);
  // Set once the recipe has opened: a back button grows out of the menu button.
  const [backShown, setBackShown] = useState(false);
  // The recipe whose step photo is open full screen, if any: the back button takes the menu
  // button's place and closes it. Kept by id, so it can't outlive that recipe's page.
  const [photoOpenFor, setPhotoOpenFor] = useState<string | null>(null);
  // A card lifting out of the box before it flips open: a second tap waits for it.
  const liftingCard = useRef(false);

  // What the editor starts from: the recipe, or an earlier version's content on it.
  const editBase =
    editingRecipe && restoredVersion
      ? recipeAtVersion(editingRecipe, restoredVersion)
      : editingRecipe;
  // Edit in the viewer's language where possible (a draft, in the one it was written in); see
  // resolveEdit for how saves merge.
  const editLanguage = editingDraft?.language ?? remixing?.language ?? language;
  const editForm = editBase && recipeForEditing(editBase, editLanguage);
  const restore =
    editingRecipe && editBase && editForm && restoredVersion
      ? {
          version: restoredVersion,
          changes: diffRecipes(
            localizeRecipe(editingRecipe, editingLanguage(editBase, editLanguage)),
            editForm,
            restoredVersion.hasPhotos,
          ),
        }
      : undefined;

  // The name of the recipe a remix is of, as the editor shows it; none when that's gone.
  const remixSource = remixing && recipes.find((r) => r.id === remixing.from);
  const remixFromName = remixSource
    ? (getLocalizedRecipe(remixSource, language) ?? remixSource).name
    : undefined;

  const closeEditor = () => {
    setIsAddModalOpen(false);
    setEditingRecipe(null);
    setEditingDraft(null);
    setRemixing(null);
    setRestoredVersion(null);
    setEditorReopened(false);
  };

  const handleDelete = (id: string) => {
    // Inside the transition, so it animates from the recipe rather than an already-empty page.
    navigateTo('recipes', {
      morph: false,
      alongside: () => {
        deleteRecipe(id);
        closeEditor();
      },
    });
    showToast(t.recipeDeleted, 'info', { label: t.undo, onAction: () => restoreRecipe(id) });
  };

  // A new season's colours spread out in a circle from the option that was tapped.
  const changeSeason = (next: SeasonPreference, origin: { x: number; y: number }) => {
    if (seasonFor(next) === season) setSeasonPreference(next);
    else transitionTheme(() => setSeasonPreference(next), origin);
  };

  const handleRestore = (id: string) => {
    if (restoreRecipe(id)) showToast(t.recipeRestored);
    else showToast(t.photosStillLoading, 'error');
  };

  const pickVersion = async (id: string): Promise<boolean> => {
    if (!editingRecipe) return false;
    try {
      setRestoredVersion(await loadVersion(editingRecipe, id));
      setEditorReopened(true);
      return true;
    } catch (err) {
      console.warn('Could not load an earlier recipe version:', err);
      showToast(t.versionLoadFailed, 'error');
      return false;
    }
  };

  // Sub-pages (a recipe, Settings) sit one level above the main pages.
  const onSubPage = page === 'settings' || (page === 'recipes' && !!selectedRecipe);

  // Opening a recipe: its card lifts out of the box, flips over on its middle, and the recipe
  // unfolds from the card's back (the flip motions in index.css). Then the back button springs
  // out of the menu button.
  const handleSelectRecipe = (id: string, card?: HTMLElement) => {
    if (liftingCard.current) return;
    // A card left lifted by a return cut short (another page change took over) drops back first.
    dropFlippedCard();
    mainScroll.current.recipes = window.scrollY;
    markSeen(id);
    // Marks the tapped card before the browser snapshots the vault.
    flushSync(() => setLastRecipeId(id));
    const open = (motion: NavMotion) =>
      transitionView(
        () => {
          setBackShown(false);
          setSelectedRecipeId(id);
          jumpTo(0);
        },
        { motion, onFinished: () => setBackShown(true) },
      );
    if (!card || !canFlip() || !isOnScreen(card)) {
      open('forward');
      return;
    }
    liftingCard.current = true;
    card.dataset.lifted = '';
    window.setTimeout(() => {
      liftingCard.current = false;
      // The vault has gone meanwhile (the menu took the page elsewhere).
      if (!card.isConnected) return;
      open(setFlipAxis(card) ? 'flip-open' : 'forward');
    }, CARD_LIFT_MS);
  };

  // Closing a recipe, its card is shown lifted, as it left, while the recipe folds onto it; it
  // then flips back and drops into its place in the box. False where it isn't on screen.
  const landFlippedCard = (): boolean => {
    const card = document.querySelector<HTMLElement>('.vault-item.is-flip-target');
    if (!card) return false;
    card.dataset.lifted = 'landing';
    if (setFlipAxis(card)) return true;
    delete card.dataset.lifted;
    return false;
  };
  // At once where another card is about to lift; otherwise it settles back ('dropping', as long
  // as the lift), tucking behind the card in front of it again.
  const dropFlippedCard = (settle = false) => {
    const card = document.querySelector<HTMLElement>('.vault-item[data-lifted]');
    if (!card) return;
    if (!settle) {
      delete card.dataset.lifted;
      return;
    }
    card.dataset.lifted = 'dropping';
    // A little past the drop, so it has fully settled when the card goes back behind.
    window.setTimeout(() => {
      if (card.dataset.lifted === 'dropping') delete card.dataset.lifted;
    }, CARD_LIFT_MS + 100);
  };

  const navigateTo = (
    target: AppPage,
    { animated = true, morph = true, motion: motionOverride, alongside }: NavigateOptions = {},
  ) => {
    const fromDepth = onSubPage ? 1 : 0;
    const toDepth = target === 'settings' ? 1 : 0;
    const goingBack = toDepth < fromDepth;
    if (page !== 'settings' && !onSubPage) mainScroll.current[page] = window.scrollY;
    // The recipe folds away onto its card, which flips back into the box (landFlippedCard).
    const flipsBack =
      morph && animated && target === 'recipes' && page === 'recipes' && !!selectedRecipe;
    const motion: NavMotion =
      flipsBack && canFlip()
        ? 'flip-close'
        : (motionOverride ?? (toDepth > fromDepth ? 'forward' : goingBack ? 'back' : 'fade'));

    transitionView(
      () => {
        flushSync(() => {
          alongside?.();
          setBackShown(false);
          setVaultEntrance(!goingBack && !flipsBack);
          setPage(target);
          if (target !== 'settings') setMainPage(target);
          setSelectedRecipeId(null);
        });
        // Only once the page is there: a shorter page it replaces (a recipe) can't scroll as
        // far, and the jump would land short of the spot.
        jumpTo(goingBack && target !== 'settings' ? mainScroll.current[target] : 0);
        // Only now is the card there to measure. Out of sight, the vault simply fades in.
        if (motion === 'flip-close' && !landFlippedCard())
          document.documentElement.dataset.nav = 'fade';
      },
      {
        motion,
        animated,
        onFinished: motion === 'flip-close' ? () => dropFlippedCard(true) : undefined,
      },
    );
  };

  const changeVaultFilter = (filter: VaultFilter) => {
    setVaultFilter(filter);
    setSeenForFilter(seen);
  };
  const vaultSeen = vaultFilter.unseen ? seenForFilter : seen;

  const changeVaultSort = (sort: VaultSort) => {
    setVaultSort(sort);
    setStoredVaultSort(sort);
  };
  const changeVaultView = (view: VaultView) => {
    setVaultView(view);
    setStoredVaultView(view);
  };
  // Back from a recipe: it folds away onto its card, as the back button tucks into the menu
  // button, and the card flips back into its place in the box.
  const leaveRecipe = (animated = true) => {
    setBackShown(false);
    navigateTo('recipes', { animated });
  };

  // From a recipe or Settings, the phone's back gesture returns to the last main page.
  useBackStep(onSubPage, (animated) =>
    selectedRecipe && page === 'recipes'
      ? leaveRecipe(animated)
      : navigateTo(mainPage, { animated }),
  );

  // The editor opens out of the button that asked for it: the menu button, where "Add recipe"
  // or "Edit recipe" was chosen, unless a draft's card or chip was tapped.
  const openEditor = (
    recipe: Recipe | null,
    draft: RecipeDraft | null,
    from?: Element | null,
    remix: typeof remixing = null,
  ) => {
    // A remix's draft carries on as a remix.
    const draftOf = draft && !draft.recipeId ? remixOriginalId(draft.recipe) : null;
    setRemixing(
      remix ?? (draft && draftOf ? { from: draftOf, start: null, language: draft.language } : null),
    );
    setEditingRecipe(recipe);
    setEditingDraft(draft);
    setDraftsKnownAtOpen(draftsLoaded);
    setEditorOrigin(centreOf(from ?? document.getElementById('fabMenuBtn')));
    setIsAddModalOpen(true);
  };

  const openAddRecipe = () => openEditor(null, null);

  // Editing a recipe carries on with its draft, if its owner left one.
  const editRecipe = (recipe: Recipe, from?: Element | null) => {
    // Editing a copy without its photos would save the recipe without them.
    if (hasLeftOutPhotos(recipe)) {
      showToast(t.photosStillLoading, 'info');
      return;
    }
    openEditor(recipe, draftFor(drafts, recipe.id), from);
  };

  // A remix starts as a new recipe holding a copy of this one, for whoever remixes it to make
  // their own (theirs to own, at version 1). The original stays as it is.
  const remixRecipe = (original: Recipe) => {
    // A copy without its photos would leave them out of the remix.
    if (hasLeftOutPhotos(original)) {
      showToast(t.photosStillLoading, 'info');
      return;
    }
    openEditor(null, null, null, {
      from: original.id,
      start: remixStart(original, language),
      language: remixLanguage(original, language),
    });
  };

  // Keeps what the editor holds as a draft: the open one again, else the recipe's, else a new one.
  const keepDraft = (content: DraftContent, changeNote: string) => {
    const recipeId = editingRecipe?.id;
    const id = editingDraft?.id ?? (recipeId ? editDraftId(recipeId) : newDraftId());
    const draft: RecipeDraft = {
      id,
      recipe: { ...content, id: recipeId ?? id, ...(remixing && { remixOf: remixing.from }) },
      language: editLanguage,
      savedAt: Date.now(),
    };
    if (editingRecipe && recipeId) {
      draft.recipeId = recipeId;
      draft.baseVersion = editingRecipe.version ?? 1;
    }
    if (changeNote.trim()) draft.changeNote = changeNote.trim();
    showToast(t.draftSavedToast(draftVersion(editingRecipe)));
    saveDraft(draft).catch((err: unknown) => {
      console.warn('Failed to save a recipe draft:', err);
      showToast(t.draftSaveFailed, 'error');
    });
  };

  // A draft goes once it's discarded, or saved to the vault.
  const dropDraft = (draft: RecipeDraft) =>
    discardDraft(draft.id).catch((err: unknown) => {
      console.warn('Failed to remove a recipe draft:', err);
    });

  // From a recipe's remix popover to another recipe: the name tapped there flies up into the new
  // page's title as that page fades up over this one (index.css, the 'hop' motion and 'title'
  // morph). Only the two names and the page are snapshotted, so it stays light. Back still
  // returns to the Recipe Box, where this recipe's card is the one that takes it back.
  const openLinkedRecipe = (id: string, name: HTMLElement) => {
    markSeen(id);
    const title = () => document.getElementById('detailTitle');
    // A hop cut short by another page change never cleared this page's title: two elements
    // sharing the name would cancel this one.
    title()?.style.removeProperty('view-transition-name');
    // With less motion asked for, the pages only cross-fade.
    const morph = !prefersReducedMotion();
    if (morph) name.style.setProperty('view-transition-name', 'recipe-title');
    transitionView(
      () => {
        flushSync(() => {
          setLastRecipeId(id);
          setPhotoOpenFor(null);
          setSelectedRecipeId(id);
        });
        jumpTo(0);
        if (morph) title()?.style.setProperty('view-transition-name', 'recipe-title');
      },
      {
        motion: 'hop',
        morph: morph ? 'title' : undefined,
        onFinished: () => title()?.style.removeProperty('view-transition-name'),
      },
    );
  };

  const onRecipe = page === 'recipes' && !!selectedRecipe;
  const photoOpen = onRecipe && photoOpenFor === selectedRecipe.id;

  // Page-dependent entries at the bottom of the floating menu.
  let pageActions: MenuAction[] = [];
  switch (page) {
    case 'recipes':
      if (!selectedRecipe) {
        pageActions = [
          { id: 'add-recipe', label: t.addRecipe, icon: Plus, onSelect: openAddRecipe },
        ];
        break;
      }
      // Only the family member who added a recipe can edit it.
      if (canEditRecipe(selectedRecipe, currentUser, isFirebaseConfigured)) {
        pageActions.push({
          id: 'edit-recipe',
          label: t.editRecipe,
          icon: PencilLine,
          onSelect: () => editRecipe(selectedRecipe),
        });
      }
      // Anyone can remix any recipe, their own too.
      pageActions.push({
        id: 'remix-recipe',
        label: t.remixRecipe,
        icon: Shuffle,
        onSelect: () => remixRecipe(selectedRecipe),
      });
      break;
    case 'makes':
      pageActions = [
        {
          id: 'add-make',
          label: t.addMake,
          icon: Plus,
          onSelect: () => showToast(t.comingSoonToast, 'info'),
        },
      ];
      break;
    case 'settings':
      break;
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      {/* Main Container */}
      <main className="app-container">
        {page === 'makes' ? (
          <MakesView t={t} />
        ) : page === 'settings' ? (
          <SettingsView
            deletedRecipes={restorableRecipes(allRecipes, currentUser, isFirebaseConfigured)}
            language={language}
            onRestore={handleRestore}
            seasonPreference={seasonPreference}
            season={season}
            calendarSeason={calendarSeason}
            onSeasonChange={changeSeason}
            t={t}
          />
        ) : selectedRecipe ? (
          <RecipeDetailView
            key={selectedRecipe.id}
            recipe={selectedRecipe}
            language={language}
            ref={recipePage}
            unroll={false}
            onPhotoOpenChange={(open) => setPhotoOpenFor(open ? selectedRecipe.id : null)}
            draftVersion={
              draftFor(drafts, selectedRecipe.id) ? draftVersion(selectedRecipe) : undefined
            }
            onContinueDraft={(from) => editRecipe(selectedRecipe, from)}
            remixOriginal={remixOriginal(recipes, selectedRecipe)}
            remixes={remixesOf(recipes, selectedRecipe.id)}
            onOpenRecipe={openLinkedRecipe}
            t={t}
          />
        ) : (
          <RecipeGridView
            recipes={recipes}
            language={language}
            filter={vaultFilter}
            onFilterChange={changeVaultFilter}
            sort={vaultSort}
            onSortChange={changeVaultSort}
            view={vaultView}
            onViewChange={changeVaultView}
            isSeen={(recipe) => vaultSeen.has(recipe.id) || isOwnRecipe(recipe, currentUser)}
            animateIn={vaultEntrance}
            flipRecipeId={lastRecipeId}
            onSelectRecipe={handleSelectRecipe}
            drafts={newRecipeDrafts(drafts)}
            onOpenDraft={(draft, from) => openEditor(null, draft, from)}
            banner={
              isBannerVisible && (
                <InstallCard
                  onInstall={() => void triggerInstall()}
                  onDismiss={dismissBanner}
                  t={t}
                />
              )
            }
            t={t}
          />
        )}
      </main>

      <FloatingMenu
        page={page}
        // Under the menu's blurring scrim, the page cross-fades as the scrim clears. Never the
        // card flip back from a recipe: the scrim and menu would fold away with the recipe.
        onNavigate={(target) => navigateTo(target, { motion: 'menu', morph: false })}
        actions={pageActions}
        language={language}
        onToggleLanguage={toggleLanguage}
        theme={theme}
        onToggleTheme={(origin) => transitionTheme(toggleTheme, origin)}
        fontPercent={fontPercent}
        onIncreaseFont={increaseScale}
        onDecreaseFont={decreaseScale}
        showBack={(backShown || photoOpen) && onRecipe}
        photoOpen={photoOpen}
        onBack={() => (photoOpen ? recipePage.current?.closePhoto() : leaveRecipe())}
        t={t}
      />

      {/* Add / Edit Recipe Modal */}
      {isAddModalOpen && (
        <AddRecipeModal
          // A restored version reopens the form on its content.
          key={`${editingRecipe?.id ?? editingDraft?.id ?? 'new'}:${restoredVersion?.id ?? 'current'}`}
          initialRecipe={editForm ?? remixing?.start}
          remixFrom={remixing ? (remixFromName ?? '') : undefined}
          // An earlier version picked from the list replaces the draft's content in the form.
          draft={restoredVersion ? null : editingDraft}
          onSaveDraft={
            canDraft && (!editingRecipe || editingDraft || draftsKnownAtOpen)
              ? keepDraft
              : undefined
          }
          onDiscardDraft={
            editingDraft
              ? () => {
                  void dropDraft(editingDraft);
                  showToast(t.draftDiscarded);
                }
              : undefined
          }
          versions={editingRecipe ? versionSummaries(editingRecipe) : []}
          restore={restore}
          onPickVersion={pickVersion}
          onKeepCurrent={() => {
            setRestoredVersion(null);
            setEditorReopened(true);
          }}
          animateIn={!editorReopened}
          origin={editorOrigin}
          onToast={(message, action) => showToast(message, action ? 'info' : 'success', action)}
          onDelete={editingRecipe ? () => handleDelete(editingRecipe.id) : undefined}
          language={language}
          onClose={closeEditor}
          onSave={(recipeData, existingId, textChanged, changeNote) => {
            if (existingId && editBase) {
              const edited: Recipe = { ...recipeData, id: existingId };
              const saved = hasLeftOutPhotos(editBase)
                ? null
                : updateRecipe(
                    resolveEdit(editBase, edited, editLanguage, textChanged),
                    changeNote,
                  );
              if (!saved) {
                showToast(t.photosStillLoading, 'error');
                return;
              }
            } else {
              // Provisional: translation detects the real language and corrects this.
              const added = addRecipe({
                ...recipeData,
                sourceLanguage: editLanguage,
                ...(remixing && { remixOf: remixing.from }),
              });
              // Its page opens under the closing editor; its card is the one back takes it to.
              setLastRecipeId(added.id);
            }
            // In the vault now, so its draft is done with.
            if (editingDraft) void dropDraft(editingDraft);
            // The editor then closes itself, and closeEditor clears it once it has slid away.
          }}
          t={t}
        />
      )}

      {/* iOS Install Guide Modal */}
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} t={t} />}

      {/* Toast Feedback */}
      <Toast toast={toast} visible={isToastVisible} onHidden={clearToast} onDismiss={hideToast} />
    </div>
  );
}
