import ru from './ru';
import kz from './kz';
import en from './en';

export const LANGUAGES = [
  { code: 'ru', label: 'RU', name: 'Русский' },
  { code: 'kz', label: 'KZ', name: 'Қазақша' },
  { code: 'en', label: 'EN', name: 'English' },
];

export const translations = { ru, kz, en };

export function getStoredLang() {
  try {
    const stored = localStorage.getItem('ag_lang');
    if (stored && translations[stored]) return stored;
  } catch {}
  return 'ru';
}

export function setStoredLang(code) {
  try {
    localStorage.setItem('ag_lang', code);
  } catch {}
}