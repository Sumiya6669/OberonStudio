import React, {
  createContext, useContext, useState, useMemo, useLayoutEffect, useEffect,
} from 'react';
import { translations, getStoredLang, setStoredLang } from './index';

const LangContext = createContext(null);

/**
 * Страница отдана уже собранной на сборке. Тогда в разметке русский язык,
 * и первый кадр в браузере обязан совпасть с ней — иначе гидратация
 * разойдётся с разметкой, а человек увидит подмену текста.
 */
const PRERENDERED =
  typeof document !== 'undefined' &&
  document.documentElement.getAttribute('data-prerendered') === '1';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function LangProvider({ children, initialLang }) {
  const [lang, setLangState] = useState(
    () => initialLang || (PRERENDERED ? 'ru' : getStoredLang()),
  );

  // Сохранённый язык подставляется ДО первой отрисовки: смена состояния
  // в layout-эффекте успевает пройти до кадра, поэтому мигания нет.
  useIsoLayoutEffect(() => {
    if (!PRERENDERED) return;
    const stored = getStoredLang();
    if (stored !== lang) setLangState(stored);
    // Только один раз, на монтировании.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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