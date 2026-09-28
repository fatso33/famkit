import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from './hooks/useTheme';
import { useFontScale } from './hooks/useFontScale';
import { useSeason } from './hooks/useSeason';
import { useLanguage } from './hooks/useLanguage';
import { useCookMode } from './hooks/useCookMode';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useRecipes, getLocalizedRecipe } from './hooks/useRecipes';
import { useToast } from './hooks/useToast';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useBackStep } from './hooks/useBackStep';
import { isFirebaseConfigured } from './services/firebase';
import { canEditRecipe } from './utils/ownership';
import {
  editingLanguage,
  localizeRecipe,
  recipeForEditing,
  resolveEdit,
} from './utils/recipeTranslation';
import { diffRecipes, recipeAtVersion, versionSummaries } from './utils/recipeVersions';
import { restorableRecipes } from './utils/recipeTrash';
import { NO_FILTER } from './utils/vault';
import {
  getStoredVaultSort,
  getStoredVaultView,
  setStoredVaultSort,
  setStoredVaultView,
} from './services/storage';
import {
  isOnScreen,
  transitionTheme,
  transitionView,
  type NavMotion,
} from './utils/viewTransition';
import { SeasonPreference } from './utils/season';
import { Plus, Share2 } from 'lucide-react';
import { FloatingMenu, MenuAction } from './components/layout/FloatingMenu';
import { InstallCard } from './components/layout/InstallCard';
import { RecipeGridView } from './components/recipe-grid/RecipeGridView';
import {
  RecipeDetailView,
  type RecipePageHandle,
} from './components/recipe-detail/RecipeDetailView';
import { AddRecipeModal } from './components/recipe-form/AddRecipeModal';
import { IOSInstallModal } from './components/layout/IOSInstallModal';
import { MakesView } from './components/makes/MakesView';
import { SettingsView } from './components/settings/SettingsView';
import { Toast } from './components/common/Toast';
import { Recipe, RecipeVersion, VaultFilter, VaultSort, VaultView } from './types/recipe';
import { AppPage, MainPage } from './types/navigation';

// Page changes jump straight to their scroll position: html's smooth scrolling would
// otherwise play out in the middle of the page transition.
const jumpTo = (top: number) => window.scrollTo({ top, behavior: 'instant' });

interface NavigateOptions {
  /** False when the browser already animated it (the iOS back swipe). */
  animated?: boolean;
  /** False when the open recipe's card won't be there to morph into. */
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
  const { isCookModeOn, toggleCookMode, isSupported: isWakeLockSupported } = useCookMode();
  const { isBannerVisible, triggerInstall, dismissBanner, showIOSModal, setShowIOSModal } =
    usePWAInstall();

  const { toast, visible: isToastVisible, showToast, hideToast, clearToast } = useToast();
  const currentUser = useCurrentUser();

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
  const localizedRecipe = getLocalizedRecipe(selectedRecipe, language);

  const [page, setPage] = useState<AppPage>('recipes');
  // The last main page (not Settings), where the back gesture returns to.
  const [mainPage, setMainPage] = useState<MainPage>('recipes');
  // The vault's filter and each main page's scroll survive a visit to a sub-page, so going
  // back returns to the same spot (and a recipe's photo can shrink back into its card).
  const [vaultFilter, setVaultFilter] = useState<VaultFilter>(NO_FILTER);
  // How the vault is ordered and laid out is this person's preference, kept on the device.
  const [vaultSort, setVaultSort] = useState<VaultSort>(getStoredVaultSort);
  const [vaultView, setVaultView] = useState<VaultView>(getStoredVaultView);
  // The vault's banner plays its entrance when the vault arrives, not when a recipe or
  // Settings slides back to reveal it.
  const [vaultEntrance, setVaultEntrance] = useState(true);
  const mainScroll = useRef<Record<MainPage, number>>({ recipes: 0, makes: 0 });
  // The recipe last opened from the vault: its card is where the photo morphs to and from.
  const [lastRecipeId, setLastRecipeId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  // An earlier version the author loaded into the editor, to restore on save.
  const [restoredVersion, setRestoredVersion] = useState<RecipeVersion | null>(null);
  // Switching versions remounts the editor, which shouldn't slide in again.
  const [editorReopened, setEditorReopened] = useState(false);
  // The open recipe page, which unrolls out of its photo and rolls back up into it.
  const recipePage = useRef<RecipePageHandle>(null);
  // Set once the recipe has unrolled: a back button grows out of the menu button.
  const [backShown, setBackShown] = useState(false);
  // While the recipe rolls up on its way back to the vault.
  const leavingRecipe = useRef(false);

  // What the editor starts from: the recipe, or an earlier version's content on it.
  const editBase =
    editingRecipe && restoredVersion
      ? recipeAtVersion(editingRecipe, restoredVersion)
      : editingRecipe;
  // Edit in the viewer's language where possible; see resolveEdit for how saves merge.
  const editForm = editBase && recipeForEditing(editBase, language);
  const restore =
    editingRecipe && editBase && editForm && restoredVersion
      ? {
          version: restoredVersion,
          changes: diffRecipes(
            localizeRecipe(editingRecipe, editingLanguage(editBase, language)),
            editForm,
            restoredVersion.hasPhotos,
          ),
        }
      : undefined;

  const closeEditor = () => {
    setIsAddModalOpen(false);
    setEditingRecipe(null);
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
    restoreRecipe(id);
    showToast(t.recipeRestored);
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

  const handleSelectRecipe = (id: string) => {
    mainScroll.current.recipes = window.scrollY;
    // Marks the tapped card before the browser snapshots the vault.
    flushSync(() => setLastRecipeId(id));
    transitionView(
      () => {
        setBackShown(false);
        setSelectedRecipeId(id);
        jumpTo(0);
      },
      { motion: 'forward', morph: 'recipe' },
    );
  };

  const navigateTo = (
    target: AppPage,
    { animated = true, morph = true, motion: motionOverride, alongside }: NavigateOptions = {},
  ) => {
    const fromDepth = onSubPage ? 1 : 0;
    const toDepth = target === 'settings' ? 1 : 0;
    const goingBack = toDepth < fromDepth;
    if (page !== 'settings' && !onSubPage) mainScroll.current[page] = window.scrollY;
    // The recipe's photo shrinks back into its card, when it's in view to be seen doing so.
    const morphsBack =
      morph &&
      target === 'recipes' &&
      !!selectedRecipe &&
      isOnScreen(document.querySelector('.detail-hero-img'));
    const motion: NavMotion = morphsBack
      ? 'back'
      : (motionOverride ?? (toDepth > fromDepth ? 'forward' : goingBack ? 'back' : 'fade'));

    transitionView(
      () => {
        alongside?.();
        setBackShown(false);
        setVaultEntrance(!goingBack && !morphsBack);
        setPage(target);
        if (target !== 'settings') setMainPage(target);
        setSelectedRecipeId(null);
        jumpTo(goingBack && target !== 'settings' ? mainScroll.current[target] : 0);
      },
      { motion, morph: morphsBack ? 'recipe' : undefined, animated },
    );
  };

  const changeVaultSort = (sort: VaultSort) => {
    setVaultSort(sort);
    setStoredVaultSort(sort);
  };
  const changeVaultView = (view: VaultView) => {
    setVaultView(view);
    setStoredVaultView(view);
  };
  // The photo morph reads the layout from here (index.css): a list row's photo has its own
  // corners, and the recipe's photo flies back into it after the vault has been unmounted.
  useEffect(() => {
    document.documentElement.dataset.vaultView = vaultView;
  }, [vaultView]);

  const latestNavigateTo = useRef(navigateTo);
  const onRecipePage = useRef(false);
  useEffect(() => {
    latestNavigateTo.current = navigateTo;
    onRecipePage.current = page === 'recipes' && !!selectedRecipe;
  });

  // Back from a recipe: it rolls up into its photo (as the back button tucks into the menu
  // button), then the photo flies home to its card as the vault fades in.
  const leaveRecipe = (animated = true) => {
    if (leavingRecipe.current) return;
    setBackShown(false);
    const rolling = animated ? recipePage.current?.rollUp() : null;
    if (!rolling) {
      navigateTo('recipes', { animated });
      return;
    }
    leavingRecipe.current = true;
    void rolling.then(() => {
      leavingRecipe.current = false;
      // Something else already left the recipe while it rolled up.
      if (!onRecipePage.current) return;
      // Where the photo can't fly home (scrolled off screen), the vault simply fades in.
      latestNavigateTo.current('recipes', { motion: 'fade' });
    });
  };

  // From a recipe or Settings, the phone's back gesture returns to the last main page.
  useBackStep(onSubPage, (animated) =>
    selectedRecipe && page === 'recipes'
      ? leaveRecipe(animated)
      : navigateTo(mainPage, { animated }),
  );

  const openAddRecipe = () => {
    setEditingRecipe(null);
    setIsAddModalOpen(true);
  };

  const handleShare = async () => {
    if (localizedRecipe && navigator.share) {
      try {
        await navigator.share({
          title: localizedRecipe.name,
          text: t.shareText(localizedRecipe.name, localizedRecipe.author),
          url: window.location.href,
        });
      } catch {
        // User dismissed share dialog
      }
    } else {
      // navigator.clipboard is undefined outside secure contexts (e.g. http on the LAN).
      const copied =
        navigator.clipboard?.writeText(window.location.href) ??
        Promise.reject(new Error('Clipboard unavailable'));
      copied.then(
        () => showToast(t.shareSuccess),
        () => showToast(t.shareFailed, 'error'),
      );
    }
  };

  // Page-dependent entries at the bottom of the floating menu.
  let pageActions: MenuAction[] = [];
  switch (page) {
    case 'recipes':
      pageActions = selectedRecipe
        ? [
            {
              id: 'share',
              label: t.shareRecipe,
              icon: Share2,
              onSelect: () => void handleShare(),
            },
          ]
        : [{ id: 'add-recipe', label: t.addRecipe, icon: Plus, onSelect: openAddRecipe }];
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
            isWakeLocked={isCookModeOn}
            onToggleWakeLock={() => void toggleCookMode()}
            isWakeLockSupported={isWakeLockSupported}
            onEditRecipe={
              canEditRecipe(selectedRecipe, currentUser, isFirebaseConfigured)
                ? (rec) => {
                    setEditingRecipe(rec);
                    setIsAddModalOpen(true);
                  }
                : undefined
            }
            ref={recipePage}
            onUnrolled={() => setBackShown(true)}
            t={t}
          />
        ) : (
          <RecipeGridView
            recipes={recipes}
            language={language}
            filter={vaultFilter}
            onFilterChange={setVaultFilter}
            sort={vaultSort}
            onSortChange={changeVaultSort}
            view={vaultView}
            onViewChange={changeVaultView}
            animateIn={vaultEntrance}
            morphRecipeId={lastRecipeId}
            onSelectRecipe={handleSelectRecipe}
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
        onNavigate={(target) => navigateTo(target)}
        actions={pageActions}
        language={language}
        onToggleLanguage={toggleLanguage}
        theme={theme}
        onToggleTheme={toggleTheme}
        fontPercent={fontPercent}
        onIncreaseFont={increaseScale}
        onDecreaseFont={decreaseScale}
        showBack={backShown && page === 'recipes' && !!selectedRecipe}
        onBack={() => leaveRecipe()}
        t={t}
      />

      {/* Add / Edit Recipe Modal */}
      {isAddModalOpen && (
        <AddRecipeModal
          // A restored version reopens the form on its content.
          key={`${editingRecipe?.id ?? 'new'}:${restoredVersion?.id ?? 'current'}`}
          initialRecipe={editForm}
          versions={editingRecipe ? versionSummaries(editingRecipe) : []}
          restore={restore}
          onPickVersion={pickVersion}
          onKeepCurrent={() => {
            setRestoredVersion(null);
            setEditorReopened(true);
          }}
          animateIn={!editorReopened}
          onDelete={editingRecipe ? () => handleDelete(editingRecipe.id) : undefined}
          language={language}
          onClose={closeEditor}
          onSave={(recipeData, existingId, textChanged, changeNote) => {
            if (existingId && editBase) {
              const edited: Recipe = { ...recipeData, id: existingId };
              updateRecipe(resolveEdit(editBase, edited, language, textChanged), changeNote);
            } else {
              // Provisional: translation detects the real language and corrects this.
              addRecipe({ ...recipeData, sourceLanguage: language });
            }
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
