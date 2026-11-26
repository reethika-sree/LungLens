import { createContext, useContext, type ReactNode } from 'react';
import translations, { type LangKey, type Translations } from './translations';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setLanguage as setLanguageAction } from '../store/slices/languageSlice';

interface LanguageContextType {
  language: LangKey;
  setLanguage: (lang: LangKey) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const language = useAppSelector(state => state.language.language);

  const setLanguage = (lang: LangKey) => {
    dispatch(setLanguageAction(lang));
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
