import React, { createContext, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { translations, setStoredLang } from './index';
import { DEFAULT_LANG, localePath, splitLocale } from './locales';

const LangContext = createContext(null);

/**
 * Язык берётся из адреса страницы и больше ниоткуда.
 *
 * Раньше он брался из localStorage, и это приходилось примирять с
 * предрендером: разметка приезжала русской, а браузер тут же переключал
 * язык. Теперь примирять нечего — `/kz/faq` по-казахски и на сборке, и в
 * браузере, и у робота. Заодно исчез весь код про «первый кадр обязан
 * совпасть»: совпадать нечему, состояние выводится из одного и того же
 * адреса.
 *
 * Переключатель языка не меняет состояние, а ПЕРЕХОДИТ на другой адрес.
 */
export function LangProvider({ children }) {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const { lang, path } = splitLocale(pathname);

  const value = useMemo(() => ({
    lang,
    t: translations[lang] || translations[DEFAULT_LANG],
    setLang: (code) => {
      if (!translations[code] || code === lang) return;
      // Выбор запоминаем — но только чтобы подсветить его в переключателе
      // на других устройствах человека; на то, что показывает страница,
      // он не влияет.
      setStoredLang(code);
      navigate(`${localePath(code, path)}${search || ''}${hash || ''}`);
    },
  }), [lang, path, search, hash, navigate]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
