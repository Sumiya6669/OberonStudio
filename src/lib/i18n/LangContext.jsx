import React, { createContext, useContext, useState, useMemo } from 'react';
import { translations, getStoredLang, setStoredLang } from './index';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => getStoredLang());

  const setLang = (code) => {
    setLangState(code);
    setStoredLang(code);
  };

  const t = useMemo(() => translations[lang], [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}