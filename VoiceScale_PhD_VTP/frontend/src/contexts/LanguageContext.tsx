import { createContext, useContext, useState, type ReactNode } from 'react';
import translations, { type LangKey, type Translations } from './translations';

interface LanguageContextType {
  language: LangKey;
  setLanguage: (lang: LangKey) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'vc_patient_language';

function getSavedLang(): LangKey {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in translations) return saved as LangKey;
  } catch {}
  return 'English';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LangKey>(getSavedLang);

  const setLanguage = (lang: LangKey) => {
    setLanguageState(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
