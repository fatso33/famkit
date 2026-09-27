import { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useFontScale } from './hooks/useFontScale';
import { useLanguage } from './hooks/useLanguage';
import { useCookMode } from './hooks/useCookMode';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useRecipes, getLocalizedRecipe } from './hooks/useRecipes';
import { useToast } from './hooks/useToast';
import { useCurrentUser } from './hooks/useCurrentUser';
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
import { Plus, Share2 } from 'lucide-react';
import { FloatingMenu, MenuAction } from './components/layout/FloatingMenu';
import { InstallCard } from './components/layout/InstallCard';
import { RecipeGridView } from './components/recipe-grid/RecipeGridView';
import { RecipeDetailView } from './components/recipe-detail/RecipeDetailView';
import { AddRecipeModal } from './components/recipe-form/AddRecipeModal';
import { IOSInstallModal } from './components/layout/IOSInstallModal';
import { MakesView } from './components/makes/MakesView';
import { SettingsView } from './components/settings/SettingsView';
import { Toast } from './components/common/Toast';
import { Recipe, RecipeVersion } from './types/recipe';
import { AppPage } from './types/navigation';

// Animates a view change where supported (a hidden preview pane can stall it; see CLAUDE.md).
function withViewTransition(changeView: () => void) {
  if (document.startViewTransition) {
    document.startViewTransition(changeView);
  } else {
    changeView();
  }
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { percent: fontPercent, increaseScale, decreaseScale } = useFontScale();
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  // An earlier version the author loaded into the editor, to restore on save.
  const [restoredVersion, setRestoredVersion] = useState<RecipeVersion | null>(null);

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
  };

  const handleDelete = (id: string) => {
    deleteRecipe(id);
    closeEditor();
    navigateTo('recipes');
    showToast(t.recipeDeleted, 'info', { label: t.undo, onAction: () => restoreRecipe(id) });
  };

  const handleRestore = (id: string) => {
    restoreRecipe(id);
    showToast(t.recipeRestored);
  };

  const pickVersion = async (id: string): Promise<boolean> => {
    if (!editingRecipe) return false;
    try {
      setRestoredVersion(await loadVersion(editingRecipe, id));
      return true;
    } catch (err) {
      console.warn('Could not load an earlier recipe version:', err);
      showToast(t.versionLoadFailed, 'error');
      return false;
    }
  };

  const handleSelectRecipe = (id: string) => {
    withViewTransition(() => {
      setSelectedRecipeId(id);
      window.scrollTo(0, 0);
    });
  };

  const navigateTo = (target: AppPage) => {
    withViewTransition(() => {
      setPage(target);
      setSelectedRecipeId(null);
      window.scrollTo(0, 0);
    });
  };

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
            t={t}
          />
        ) : selectedRecipe ? (
          <RecipeDetailView
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
            onBack={() => navigateTo('recipes')}
            t={t}
          />
        ) : (
          <RecipeGridView
            recipes={recipes}
            language={language}
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
        onNavigate={navigateTo}
        actions={pageActions}
        language={language}
        onToggleLanguage={toggleLanguage}
        theme={theme}
        onToggleTheme={toggleTheme}
        fontPercent={fontPercent}
        onIncreaseFont={increaseScale}
        onDecreaseFont={decreaseScale}
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
          onKeepCurrent={() => setRestoredVersion(null)}
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
            setEditingRecipe(null);
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
