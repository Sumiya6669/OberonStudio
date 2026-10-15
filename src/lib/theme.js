/**
 * Тема сайта: «Системная», «Светлая», «Тёмная».
 *
 * Первый выбор делает public/theme-init.js ещё до стилей — без вспышки.
 * Здесь — всё, что после: переключатель, запоминание, смена системной темы
 * на лету и тёмная панель /admin. Правила выбора те же, что в theme-init.js.
 *
 * Собранная разметка от темы не зависит: пререндер рисует светлую, а
 * переключатель до монтирования считает выбором «Системную». Настоящий
 * выбор читается после гидратации — иначе React увидел бы расхождение
 * с готовым html (ошибка #418) и перерисовал страницу.
 */
import { useEffect, useState } from 'react';

export const THEME_KEY = 'tk_theme';
export const THEME_CHOICES = ['system', 'light', 'dark'];

const META_COLOR = { light: '#f6f6f8', dark: '#080808' };
const listeners = new Set();
let forcedDark = false;

const isChoice = (v) => THEME_CHOICES.includes(v);

export function readThemeChoice() {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (isChoice(stored)) return stored;
  } catch { /* хранилище закрыто */ }
  return 'system';
}

function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Выбор → тема, которую надо показать сейчас. */
export function resolveTheme(choice) {
  if (forcedDark) return 'dark';
  return choice === 'system' ? systemTheme() : choice;
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META_COLOR[theme] || META_COLOR.light);
}

export function setThemeChoice(choice) {
  if (!isChoice(choice)) return;
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch { /* не запомнится, но переключится */ }
  applyTheme(resolveTheme(choice));
  listeners.forEach((fn) => fn(choice));
}

/** Текущий выбор для переключателя. До монтирования — 'system' (как в сборке). */
export function useThemeChoice() {
  const [choice, setChoice] = useState('system');
  useEffect(() => {
    setChoice(readThemeChoice());
    listeners.add(setChoice);
    return () => { listeners.delete(setChoice); };
  }, []);
  return [choice, setThemeChoice];
}

/**
 * Держит тему в согласии с выбором: смена системной темы при «Системной»,
 * переходы между сайтом и панелью /admin (панель всегда тёмная).
 * Ставится один раз на всё приложение.
 */
export function useThemeSync(pathname) {
  const admin = /^\/admin(\/|$)/.test(pathname || '');

  useEffect(() => {
    forcedDark = admin;
    applyTheme(resolveTheme(readThemeChoice()));
  }, [admin]);

  useEffect(() => {
    let media;
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return undefined;
    }
    const onChange = () => {
      if (readThemeChoice() === 'system') applyTheme(resolveTheme('system'));
    };
    // Выбор, сделанный в соседней вкладке, — сразу и здесь.
    const onStorage = (e) => {
      if (e.key !== THEME_KEY) return;
      const choice = readThemeChoice();
      applyTheme(resolveTheme(choice));
      listeners.forEach((fn) => fn(choice));
    };
    // Safari до 14 знает только addListener.
    if (media.addEventListener) media.addEventListener('change', onChange);
    else media.addListener(onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange);
      else media.removeListener(onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
