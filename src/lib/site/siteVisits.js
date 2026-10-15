/**
 * Свой учёт посещений сайта — без Яндекс Метрики и без cookie.
 *
 * Зачем: Метрика грузится только после «Принять» в баннере cookie, а с
 * 08.10.2026 у Яндекса ещё и сбои дата-центров. Владельцу нужно видеть хотя
 * бы поток: сколько заходов по дням, откуда, какие страницы смотрят и на
 * какие входят из поиска (Маркетинг → Посещения, миграция 067).
 *
 * ПОЧЕМУ БЕЗ СОГЛАСИЯ НА COOKIE. В базу уходят только счётчики-агрегаты:
 * «день, страница, источник → +1». Ни cookie, ни localStorage, ни номера
 * посетителя, ни отпечатка браузера; IP, браузер и полный адрес перехода
 * база не принимает и не хранит — только категорию источника (Google,
 * Telegram…), для «других сайтов» — домен, для меток — utm_source.
 * Связать два просмотра одного человека по этим данным нельзя. Единственная
 * запись в браузере — tnk:sv в sessionStorage (до закрытия вкладки): какие
 * страницы этой вкладки уже засчитаны, чтобы обновление страницы не
 * накручивало счёт. Она никуда не отправляется. Поэтому учёт работает при
 * любом выборе в баннере и не зависит от Метрики (src/lib/analytics/metrika.js
 * не трогается).
 *
 * Как считается:
 *   * «вход» — первая страница вкладки: с источником (visitSource.js);
 *   * «просмотр» — каждая страница сайта, на которую перешли, раз за сессию
 *     вкладки (повторный заход на ту же страницу и обновление — не новый
 *     просмотр);
 *   * не считаем: роботов по user-agent, автоматизированный браузер
 *     (navigator.webdriver), предзагрузку страницы браузером (считаем, когда
 *     её показали человеку), сборку/пререндер (там нет window и эффекты не
 *     выполняются), локальный запуск, предпросмотры Vercel и панель /admin.
 *
 * Ошибки молча: нет Supabase, нет функции в базе (миграция не применена),
 * упала сеть — после первой же ошибки эта вкладка больше не шлёт ничего.
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SITE_URL } from '@/lib/seo/pages';
import { classifySource, isAdminPath, normalizePath } from './visitSource';

const KEY = 'tnk:sv';
const MAX_PATHS = 200;
const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|prerender|pagespeed|facebookexternalhit|preview|monitor|curl|wget|python|java\//i;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$|\.localhost$|\.local$|\.test$/i;

let canonicalHost = '';
try { canonicalHost = new URL(SITE_URL).hostname.toLowerCase(); } catch { /* нет адреса — не беда */ }

/**
 * Как пришли на сайт — снимается один раз, при загрузке приложения: дальше
 * SPA меняет адрес, и меток в нём уже нет. document.referrer при переходах
 * внутри приложения не меняется, но адрес — меняется.
 */
const landing = typeof window === 'undefined' ? null : (() => {
  try {
    return { referrer: document.referrer || '', search: window.location.search || '' };
  } catch {
    return { referrer: '', search: '' };
  }
})();

/** Состояние вкладки: e — вход засчитан, p — засчитанные страницы, x — была ошибка. */
let memory = { e: false, p: [], x: false };

function load() {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      memory = { e: Boolean(raw.e), p: Array.isArray(raw.p) ? raw.p.slice(-MAX_PATHS) : [], x: Boolean(raw.x) };
    }
  } catch { /* приватный режим — живём в памяти */ }
  return memory;
}

function save(state) {
  memory = state;
  try { window.sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* не беда */ }
}

/** Похоже ли, что страницу смотрит не человек на живом сайте. */
function skipEnvironment() {
  try {
    if (!isSupabaseConfigured || typeof window === 'undefined' || typeof navigator === 'undefined') return true;
    if (navigator.webdriver) return true;
    if (BOTS.test(navigator.userAgent || '')) return true;
    const host = String(window.location.hostname || '').toLowerCase();
    if (!host || LOCAL.test(host)) return true;
    // Предпросмотры Vercel пишут в ту же базу — не считаем всё *.vercel.app, кроме основного адреса.
    if (host.endsWith('.vercel.app') && host !== canonicalHost) return true;
    return false;
  } catch {
    return true;
  }
}

async function send(args) {
  try {
    const { error } = await supabase.rpc('site_visit_hit', args);
    if (error) save({ ...memory, x: true });
  } catch {
    save({ ...memory, x: true });
  }
}

/** Засчитать страницу (и вход, если это первая страница вкладки). */
function track(rawPath) {
  const path = normalizePath(rawPath);
  if (!path || isAdminPath(path) || skipEnvironment()) return;
  const state = load();
  if (state.x) return;
  const entry = !state.e;
  if (!entry && state.p.includes(path)) return;

  // Отмечаем ДО запроса: двойной эффект (StrictMode) и быстрые переходы не засчитают дважды.
  save({ e: true, p: [...state.p.filter((p) => p !== path), path].slice(-MAX_PATHS), x: false });

  const args = { p_path: path, p_entry: entry };
  if (entry) {
    const own = [window.location.hostname, canonicalHost].filter(Boolean);
    const { source, detail } = classifySource({ ...(landing || {}), ownHosts: own });
    args.p_source = source;
    args.p_detail = detail;
  }
  // Не мешаем странице грузиться: запрос — когда браузер освободится.
  const run = () => { send(args); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 3000 });
  else window.setTimeout(run, 1000);
}

/** Страница, предзагруженная браузером, считается, когда её действительно открыли. */
function whenShown(fn) {
  try {
    if (document.prerendering) {
      document.addEventListener('prerenderingchange', fn, { once: true });
      return;
    }
  } catch { /* старый браузер — просто считаем */ }
  fn();
}

/** Подключается в раскладке публичного сайта: одна запись на каждую смену страницы. */
export function useSiteVisits() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    try {
      whenShown(() => track(pathname));
    } catch { /* учёт не должен ронять сайт */ }
  }, [pathname]);
}
