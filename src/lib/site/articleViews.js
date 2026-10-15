/**
 * Просмотры «Статей экспертов»: засчитать и показать.
 *
 * Счётчик живёт в базе (миграция 065): public.article_view_hit засчитывает,
 * public.article_views_get читает. Обе функции открыты публичному ключу и
 * сами держат пределы частоты — здесь только вежливость клиента:
 *
 *   * засчитываем один раз за сессию вкладки (sessionStorage) — обновление
 *     страницы и возврат «Назад» не накручивают число;
 *   * не засчитываем роботов, автоматизированный браузер, предзагрузку
 *     страницы браузером и локальный запуск (localhost) — читать там можно,
 *     писать в живую базу с машины разработчика незачем;
 *   * на сборке (пререндер) сюда не попадаем вовсе: всё зовётся из
 *     useEffect, а его сервер не выполняет. Поэтому в собранном html числа
 *     нет никогда — проверка сайта это и проверяет (data-article-views).
 *
 * Правило показа (уточнение владельца 15.10): база ответила — показываем
 * число, в том числе «0 просмотров». Пока ответа нет, Supabase не настроен,
 * функции ещё нет в базе или сеть упала — не показываем ничего: ни «0», ни
 * «загрузка», ни ошибки. Для посетителя это не событие, статья важнее.
 */
import React from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEEN_KEY = (slug) => `tnk:av:${slug}`;
const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|prerender|pagespeed|facebookexternalhit/i;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$|\.localhost$|\.local$|\.test$/i;

/** Числа, уже известные в этой вкладке: из списка в статью и обратно — без лишних запросов. */
const known = new Map();
/** Засчёт в полёте: двойной вызов эффекта (StrictMode, быстрые переходы) не засчитает дважды. */
const pending = new Map();
/** Функции нет в базе или сеть недоступна — до конца сессии больше не спрашиваем. */
let off = false;

const validSlug = (slug) => typeof slug === 'string' && slug.length <= 100 && SLUG.test(slug);

function storage() {
  try { return window.sessionStorage; } catch { return null; }
}

function seen(slug) {
  try { return storage()?.getItem(SEEN_KEY(slug)) === '1'; } catch { return false; }
}

function markSeen(slug) {
  try { storage()?.setItem(SEEN_KEY(slug), '1'); } catch { /* приватный режим — не беда */ }
}

/** Можно ли вообще ходить в базу из этого окружения. */
function canAsk() {
  return !off && isSupabaseConfigured && typeof window !== 'undefined';
}

/** Похоже ли, что страницу открыл не человек (или не «по-настоящему»). */
function notAPerson() {
  try {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return true;
    if (navigator.webdriver) return true;
    if (BOTS.test(navigator.userAgent || '')) return true;
    // Предзагрузка по speculation rules: человек страницу ещё не открыл.
    if (document.prerendering || document.visibilityState === 'prerender') return true;
    if (LOCAL.test(window.location.hostname || '')) return true;
    return false;
  } catch {
    return true;
  }
}

/** Ответ базы → число или null. Ошибку запоминаем, но не показываем. */
function settle({ data, error } = {}) {
  if (error) {
    // PGRST202 / 404 — функции нет (миграция 065 не применена): больше не спрашиваем.
    const code = String(error.code || '');
    if (code === 'PGRST202' || code === '404' || /fetch|network/i.test(String(error.message || ''))) off = true;
    return undefined;
  }
  return data;
}

async function call(fn, args) {
  try {
    return settle(await supabase.rpc(fn, args));
  } catch {
    off = true;
    return undefined;
  }
}

/** Прочитать счётчики по списку slug. Ответ — Map slug → число (только известные базе). */
async function readViews(slugs) {
  const list = [...new Set(slugs)].filter(validSlug).slice(0, 200);
  if (!list.length || !canAsk()) return known;
  const rows = await call('article_views_get', { p_slugs: list });
  if (Array.isArray(rows)) {
    // База ответила: статьи, которых нет в ответе, ещё никто не открывал — у них честный 0.
    for (const slug of list) if (!known.has(slug)) known.set(slug, 0);
    for (const row of rows) {
      const n = Number(row?.views);
      if (row?.slug && Number.isFinite(n)) known.set(row.slug, n);
    }
  }
  return known;
}

/** Засчитать просмотр (раз за сессию), иначе просто прочитать. Ответ — число или null. */
function countView(slug) {
  if (pending.has(slug)) return pending.get(slug);
  const job = (async () => {
    if (!seen(slug) && !notAPerson()) {
      const n = Number(await call('article_view_hit', { p_slug: slug }));
      if (Number.isFinite(n) && n > 0) {
        markSeen(slug);
        known.set(slug, n);
        return n;
      }
      if (off) return null;
    }
    const map = await readViews([slug]);
    return map.has(slug) ? map.get(slug) : null;
  })();
  pending.set(slug, job);
  // После ответа держать обещание незачем: следующий заход в сессии — уже только чтение.
  job.finally(() => pending.delete(slug));
  return job;
}

/** Число просмотров статьи; на её странице заодно засчитывает просмотр. null — не показывать. */
export function useArticleViews(slug) {
  const [views, setViews] = React.useState(null);
  React.useEffect(() => {
    if (!validSlug(slug) || !canAsk()) return undefined;
    let alive = true;
    setViews(known.has(slug) ? known.get(slug) : null);
    countView(slug).then((n) => { if (alive) setViews(Number.isFinite(n) ? n : null); }, () => {});
    return () => { alive = false; };
  }, [slug]);
  return views;
}

/** Числа просмотров для списка статей: Map slug → число (0 тоже). Нет ключа — не показывать. */
export function useArticlesViews(slugs) {
  const key = (slugs || []).join(',');
  const [views, setViews] = React.useState(() => new Map());
  React.useEffect(() => {
    if (!key || !canAsk()) return undefined;
    let alive = true;
    readViews(key.split(',')).then((map) => { if (alive) setViews(new Map(map)); }, () => {});
    return () => { alive = false; };
  }, [key]);
  return views;
}

/**
 * «1 просмотр», «3 просмотра», «25 просмотров»; «12 қаралым»; «1 view», «7 views».
 * Неразрывный пробел между числом и словом — чтобы подпись не рвалась по строкам.
 */
export function viewsLabel(n, lang = 'ru') {
  const value = Number(n) || 0;
  const locale = lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-GB' : 'ru-RU';
  let number;
  try { number = value.toLocaleString(locale); } catch { number = String(value); }
  if (lang === 'kz') return `${number} қаралым`;
  if (lang === 'en') return `${number} ${value === 1 ? 'view' : 'views'}`;
  const mod10 = value % 10;
  const mod100 = value % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'просмотр'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'просмотра'
      : 'просмотров';
  return `${number} ${word}`;
}
