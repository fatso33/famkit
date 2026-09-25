import { useState, useEffect } from 'react';
import { Language } from '../types/recipe';
import { getStoredLanguage, setStoredLanguage } from '../services/storage';
import { UI_TEXT } from '../i18n/translations';

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    setStoredLanguage(language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'en' ? 'pl' : 'en'));
  };

  const t = UI_TEXT[language];

  return { language, setLanguage: setLanguageState, toggleLanguage, t };
}
