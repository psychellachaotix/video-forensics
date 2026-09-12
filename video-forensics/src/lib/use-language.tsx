import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Language, strings } from './i18n';

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof strings.en;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app-lang');
    return saved === 'en' ? 'en' : 'cs';
  });

  useEffect(() => {
    localStorage.setItem('app-lang', lang);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: strings[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
