import { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from './hooks/useTheme';
import { useFontScale } from './hooks/useFontScale';
import { useLanguage } from './hooks/useLanguage';
import { useCookMode } from './hooks/useCookMode';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useRecipes, getLocalizedRecipe } from './hooks/useRecipes';
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

  const {
    recipes,
    selectedRecipe,
    setSelectedRecipeId,
    addRecipe,
    updateRecipe,
    translateSelectedRecipe,
    isTranslating,
  } = useRecipes();
  const localizedRecipe = getLocalizedRecipe(selectedRecipe, language);

  const [page, setPage] = useState<AppPage>('recipes');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState('✓');

  const showToast = useCallback((msg: string, icon: string = '✓') => {
    setToastMessage(msg);
    setToastIcon(icon);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Recipe revision we last auto-translated, so a failure isn't retried when isTranslating flips back.
  // Cleared on language switch / recipe selection, which act as explicit retries.
  const lastTranslateAttempt = useRef<string | null>(null);

  // Automatically translate custom recipes if viewed while in Polish mode
  useEffect(() => {
    if (language !== 'pl' || !selectedRecipe || selectedRecipe.translations?.pl || isTranslating) {
      return;
    }
    const attemptKey = `${selectedRecipe.id}@${selectedRecipe.updatedAt ?? selectedRecipe.version ?? 0}`;
    if (lastTranslateAttempt.current === attemptKey) return;
    lastTranslateAttempt.current = attemptKey;

    showToast(t.translatingToast, '🌐');
    translateSelectedRecipe(selectedRecipe)
      .then(() => {
        showToast(t.translatedToast, '🇵🇱');
      })
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        showToast(`${t.translationError}${errorMsg}`, '⚠️');
      });
  }, [language, selectedRecipe, isTranslating, t, translateSelectedRecipe, showToast]);

  const handleSelectRecipe = (id: string) => {
    lastTranslateAttempt.current = null;
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

  const handleLanguageToggle = () => {
    toggleLanguage();
    const nextLang = language === 'en' ? 'pl' : 'en';
    showToast(
      nextLang === 'pl' ? t.switchPlToast : t.switchEnToast,
      nextLang === 'pl' ? '🇵🇱' : '🌾',
    );
    // Switching to Polish (re)triggers auto-translation of the open recipe via the effect above.
    lastTranslateAttempt.current = null;
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
        () => showToast(t.shareSuccess, '🔗'),
        () => showToast(t.shareFailed, '⚠️'),
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
          onSelect: () => showToast(t.comingSoonToast, '🥐'),
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
          <SettingsView t={t} onToast={showToast} />
        ) : selectedRecipe ? (
          <RecipeDetailView
            recipe={selectedRecipe}
            language={language}
            isWakeLocked={isCookModeOn}
            onToggleWakeLock={() => void toggleCookMode()}
            isWakeLockSupported={isWakeLockSupported}
            onEditRecipe={(rec) => {
              setEditingRecipe(rec);
              setIsAddModalOpen(true);
            }}
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
        onToggleLanguage={handleLanguageToggle}
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
          initialRecipe={editingRecipe}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingRecipe(null);
          }}
          onSave={(recipeData, existingId) => {
            if (existingId) {
              const fullRecipe: Recipe = {
                ...recipeData,
                id: existingId,
              };
              const updated = updateRecipe(fullRecipe);
              showToast(`Updated ${updated.name} (v${updated.version})!`, '✨');
            } else {
              const created = addRecipe(recipeData);
              showToast(`Saved ${created.name} to vault!`, '🍞');
            }
            setEditingRecipe(null);
          }}
          t={t}
        />
      )}

      {/* iOS Install Guide Modal */}
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} t={t} />}

      {/* Toast Feedback */}
      <Toast message={toastMessage} icon={toastIcon} />
    </div>
  );
}
