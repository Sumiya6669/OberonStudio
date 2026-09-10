/**
 * Язык живёт в адресе страницы.
 *
 * Было: один адрес на три языка, переключатель менял текст на месте.
 * Для человека это удобно, для поиска — беда: у казахской и английской
 * версии просто нет адреса, поэтому их нечего показывать в выдаче и не на
 * что ссылаться. Три языка сводились к одной странице на русском.
 *
 * Стало: `/services` — русская, `/kz/services` — казахская,
 * `/en/services` — английская. Русская остаётся главной (x-default):
 * запросы про 1С в Казахстане идут на русском, и делать вид, что это не так,
 * значит терять заявки ради симметрии.
 *
 * Правило простое и без исключений: АДРЕС ОПРЕДЕЛЯЕТ ЯЗЫК. Не запомненный
 * выбор, не язык браузера. Иначе один и тот же адрес показывал бы разным
 * людям разный текст — и hreflang, и кэш, и предрендер начали бы врать.
 */

export const DEFAULT_LANG = 'ru';

/** Приставка в адресе. У русского её нет: он и есть корень сайта. */
export const LOCALE_PREFIX = { ru: '', kz: '/kz', en: '/en' };

/** Код для hreflang и атрибута lang: у казахского это kk, не kz. */
export const HREFLANG = { ru: 'ru', kz: 'kk', en: 'en' };

export const OG_LOCALE = { ru: 'ru_RU', kz: 'kk_KZ', en: 'en_US' };

export const LANG_CODES = ['ru', 'kz', 'en'];

const PREFIX_RE = /^\/(kz|en)(?=\/|$)/;

/** Разбирает адрес на язык и путь без приставки: `/kz/faq` → kz, `/faq`. */
export function splitLocale(pathname) {
  const value = pathname || '/';
  const match = PREFIX_RE.exec(value);
  if (!match) return { lang: DEFAULT_LANG, path: value || '/' };
  return { lang: match[1], path: value.slice(match[0].length) || '/' };
}

/** Собирает адрес обратно: (kz, '/faq') → `/kz/faq`, (ru, '/') → `/`. */
export function localePath(lang, path) {
  const clean = !path || path === '/' ? '' : path.replace(/\/$/, '');
  const prefix = LOCALE_PREFIX[lang] ?? '';
  return `${prefix}${clean}` || '/';
}

/** Адрес этой же страницы на всех языках — для hreflang и карты сайта. */
export function localeAlternates(path) {
  return LANG_CODES.map((lang) => ({
    lang,
    hreflang: HREFLANG[lang],
    path: localePath(lang, path),
  }));
}
