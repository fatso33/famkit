import { useState, useCallback } from 'react';
import { useTheme } from './hooks/useTheme';
import { useFontScale } from './hooks/useFontScale';
import { useLanguage } from './hooks/useLanguage';
import { useCookMode } from './hooks/useCookMode';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useRecipes } from './hooks/useRecipes';
import { Header } from './components/layout/Header';
import { RecipeGridView } from './components/recipe-grid/RecipeGridView';
import { RecipeDetailView } from './components/recipe-detail/RecipeDetailView';
import { AddRecipeModal } from './components/recipe-form/AddRecipeModal';
import { IOSInstallModal } from './components/layout/IOSInstallModal';
import { Toast } from './components/common/Toast';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { percent: fontPercent, increaseScale, decreaseScale } = useFontScale();
  const { language, toggleLanguage, t } = useLanguage();
  const { isWakeLocked, toggleCookMode, isSupported: isWakeLockSupported } = useCookMode();
  const {
    isBannerVisible,
    triggerInstall,
    dismissBanner,
    showIOSModal,
    setShowIOSModal,
  } = usePWAInstall();

  const {
    recipes,
    selectedRecipe,
    setSelectedRecipeId,
    addRecipe,
    translateSelectedRecipe,
  } = useRecipes();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState('✓');

  const showToast = useCallback((msg: string, icon: string = '✓') => {
    setToastMessage(msg);
    setToastIcon(icon);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  const handleSelectRecipe = (id: string) => {
    const changeView = () => {
      setSelectedRecipeId(id);
      window.scrollTo(0, 0);
    };

    if (document.startViewTransition) {
      document.startViewTransition(changeView);
    } else {
      changeView();
    }
  };

  const handleNavigateHome = () => {
    const changeView = () => {
      setSelectedRecipeId(null);
      window.scrollTo(0, 0);
    };

    if (document.startViewTransition) {
      document.startViewTransition(changeView);
    } else {
      changeView();
    }
  };

  const handleLanguageToggle = async () => {
    toggleLanguage();
    const nextLang = language === 'en' ? 'pl' : 'en';
    showToast(nextLang === 'pl' ? t.switchPlToast : t.switchEnToast, nextLang === 'pl' ? '🇵🇱' : '🌾');

    // If currently viewing a custom recipe that lacks Polish translation, translate on demand
    if (nextLang === 'pl' && selectedRecipe && !selectedRecipe.translations?.pl) {
      showToast(t.translatingToast, '🌐');
      try {
        await translateSelectedRecipe(selectedRecipe);
        showToast(t.translatedToast, '🇵🇱');
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        showToast(`${t.translationError}${errorMsg}`, '⚠️');
      }
    }
  };

  const handleShare = async () => {
    if (selectedRecipe && navigator.share) {
      try {
        await navigator.share({
          title: selectedRecipe.name,
          text: `${selectedRecipe.name} by ${selectedRecipe.author} - Heirloom Family Recipe`,
          url: window.location.href,
        });
      } catch {
        // User dismissed share dialog
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast(t.shareSuccess, '🔗');
    }
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      {/* Header */}
      <Header
        selectedRecipeName={selectedRecipe?.name}
        onNavigateHome={handleNavigateHome}
        fontPercent={fontPercent}
        onIncreaseFont={increaseScale}
        onDecreaseFont={decreaseScale}
        language={language}
        onToggleLanguage={handleLanguageToggle}
        theme={theme}
        onToggleTheme={toggleTheme}
        onShare={handleShare}
        isInstallBannerVisible={isBannerVisible}
        onInstall={triggerInstall}
        onDismissInstall={dismissBanner}
        t={t}
        onToast={showToast}
      />

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-5 py-6 sm:py-8 flex-1">
        {selectedRecipe ? (
          <RecipeDetailView
            recipe={selectedRecipe}
            language={language}
            isWakeLocked={isWakeLocked}
            onToggleWakeLock={toggleCookMode}
            isWakeLockSupported={isWakeLockSupported}
            t={t}
          />
        ) : (
          <RecipeGridView
            recipes={recipes}
            language={language}
            onSelectRecipe={handleSelectRecipe}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            t={t}
          />
        )}
      </main>

      {/* Add Recipe Modal */}
      <AddRecipeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={(newRecipe) => {
          const created = addRecipe(newRecipe);
          showToast(`Saved ${created.name} to vault!`, '🍞');
        }}
        t={t}
      />

      {/* iOS Install Guide Modal */}
      <IOSInstallModal
        isOpen={showIOSModal}
        onClose={() => setShowIOSModal(false)}
        t={t}
      />

      {/* Toast Feedback */}
      <Toast message={toastMessage} icon={toastIcon} />
    </div>
  );
}
