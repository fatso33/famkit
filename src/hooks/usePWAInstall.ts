import { useState, useEffect } from 'react';
import { isInstallBannerDismissed, dismissInstallBanner } from '../services/storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Detect standalone PWA mode
const detectStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone === true);

// Detect iOS
const detectIOS = () =>
  /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(isInstallBannerDismissed);
  const [isIOS] = useState(detectIOS);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isStandalone] = useState(detectStandalone);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsDismissed(true);
      dismissInstallBanner();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        dismissBanner();
      }
      setDeferredPrompt(null);
    }
  };

  const dismissBanner = () => {
    setIsDismissed(true);
    dismissInstallBanner();
  };

  const isBannerVisible = !isStandalone && !isDismissed && (Boolean(deferredPrompt) || isIOS);

  return {
    isBannerVisible,
    triggerInstall,
    dismissBanner,
    isIOS,
    showIOSModal,
    setShowIOSModal,
    isStandalone,
  };
}
