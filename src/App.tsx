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
import { recipeForEditing, resolveEdit } from './utils/recipeTranslation';
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
import { Recipe } from './types/recipe';
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

  const { toast, visible: isToastVisible, showToast, clearToast } = useToast();
  const currentUser = useCurrentUser();

  const { recipes, selectedRecipe, setSelectedRecipeId, addRecipe, updateRecipe } =
    useRecipes(currentUser);
  const localizedRecipe = getLocalizedRecipe(selectedRecipe, language);

  const [page, setPage] = useState<AppPage>('recipes');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

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
          <SettingsView t={t} />
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
          key={editingRecipe?.id ?? 'new'}
          // Edit in the viewer's language where possible; see resolveEdit for how saves merge.
          initialRecipe={editingRecipe && recipeForEditing(editingRecipe, language)}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingRecipe(null);
          }}
          onSave={(recipeData, existingId, textChanged) => {
            if (existingId && editingRecipe) {
              const edited: Recipe = { ...recipeData, id: existingId };
              updateRecipe(resolveEdit(editingRecipe, edited, language, textChanged));
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
      <Toast toast={toast} visible={isToastVisible} onHidden={clearToast} />
    </div>
  );
}
