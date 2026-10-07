/**
 * Общие защиты серверных функций: IP посетителя, его хэш с солью, предел
 * частоты, подпись реплик консультанта, экранирование под Telegram.
 *
 * Файл с подчёркиванием в начале имени Vercel функцией не считает — это
 * просто модуль, который импортируют /api/chat, /api/lead и /api/review.
 *
 * Переменные окружения (Vercel → Settings → Environment Variables):
 *   IP_HASH_SALT              — случайная строка ≥ 32 знаков (openssl rand -hex 32).
 *                               Без неё хэш IP не считается вовсе: IPv4 всего
 *                               4 млрд, хэш без соли перебирается за минуты, то
 *                               есть это тот же IP. Тогда предел по адресу
 *                               держится только в памяти функции, и строже.
 *   CHAT_HISTORY_KEY          — случайная строка ≥ 32 знаков: ключ подписи реплик
 *                               консультанта (HMAC). Без него история из браузера
 *                               принимается только из реплик посетителя.
 *   SUPABASE_URL              — адрес проекта (тот же, что у /api/lead).
 *   SUPABASE_SERVICE_ROLE_KEY — ключ service_role (или новый secret-ключ sb_secret_…).
 *                               Только на сервере. Нужен для счётчиков частоты
 *                               (public.site_rate_take, миграция 061) и записи
 *                               заявки от имени сервера (миграция 062).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** IP посетителя. На Vercel оба заголовка ставит сама платформа, подделать их снаружи нельзя. */
export function clientIp(request) {
  const real = String(request.headers['x-real-ip'] || '').trim();
  if (real) return real.slice(0, 64);
  return String(request.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 64);
}

function secret(name) {
  const value = process.env[name] || '';
  return value.length >= 16 ? value : '';
}

/**
 * Хэш IP с солью из окружения. `scope` разводит хэши по назначению: хэш
 * из чата не совпадает с хэшем из отзывов, и их нельзя сопоставить.
 * Пустая строка — соли нет или IP неизвестен.
 */
export function ipHash(ip, scope) {
  const salt = secret('IP_HASH_SALT');
  if (!ip || !salt) return '';
  return createHmac('sha256', salt).update(`${scope}|${ip}`).digest('hex');
}

/* ── Подпись реплик консультанта ─────────────────────────────────────────── */

/** Подпись ответа модели: браузер вернёт её вместе с репликой, и сервер узнает свою. */
export function signTurn(session, text) {
  const key = secret('CHAT_HISTORY_KEY');
  if (!key || !session || typeof text !== 'string') return null;
  return createHmac('sha256', key).update(`chat-v1|${session}|${text}`).digest('base64url');
}

export function verifyTurn(session, text, sig) {
  if (typeof sig !== 'string' || sig.length < 40 || sig.length > 64) return false;
  const expected = signTurn(session, text);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ── Экранирование ───────────────────────────────────────────────────────── */

/** Аналог html.escape для parse_mode: HTML в Telegram (и для любого HTML). */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Запросы к базе от имени сервера ─────────────────────────────────────── */

/**
 * Заголовки для ключа service_role. Старый ключ — JWT (eyJ…), его шлют и в
 * apikey, и в Authorization. Новый secret-ключ (sb_secret_…) — только в apikey.
 */
export function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!process.env.SUPABASE_URL || !key) return null;
  const headers = { 'Content-Type': 'application/json', apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

/** Счётчики в базе. null — хранилище не настроено или недоступно. */
async function dbRateTake(checks) {
  const headers = serviceHeaders();
  if (!headers) return null;
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/site_rate_take`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_checks: checks }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      console.error('site_rate_take:', response.status, (await response.text()).slice(0, 200));
      return null;
    }
    const data = await response.json();
    return data && typeof data.allowed === 'boolean' ? data : null;
  } catch (error) {
    console.error('site_rate_take недоступна:', error?.name || error);
    return null;
  }
}

/* ── Запасной предел в памяти ────────────────────────────────────────────── */
//
// Живёт, пока жив экземпляр функции, и у каждого экземпляра свой. Это не
// замена счётчику в базе, а нижняя граница на время, пока базы нет: пределы
// здесь вдвое-вчетверо строже.

const memory = new Map();

function memTake(key, limit, windowMs) {
  const now = Date.now();
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.reset <= now) memory.delete(k);
  }
  const slot = memory.get(key);
  if (!slot || slot.reset <= now) {
    memory.set(key, { used: 1, reset: now + windowMs });
    return { allowed: limit >= 1, retry_after: Math.ceil(windowMs / 1000) };
  }
  if (slot.used + 1 > limit) return { allowed: false, retry_after: Math.ceil((slot.reset - now) / 1000) };
  slot.used += 1;
  return { allowed: true };
}

/**
 * Предел частоты для публичной функции.
 *
 *   name     — имя счётчика ('chat');
 *   ip       — IP посетителя (в базу не уходит, только хэш с солью);
 *   perHour, perDay — на один адрес;
 *   dailyCap — на всех вместе за сутки (потолок расходов).
 *
 * Возвращает { allowed, retry_after?, via: 'db' | 'memory' }.
 */
export async function takeQuota(name, { ip, perHour, perDay, dailyCap }) {
  const hash = ipHash(ip, name);
  const checks = [];
  if (hash) {
    const bucket = `${name}:ip:${hash.slice(0, 32)}`;
    checks.push({ bucket, kind: 'hour', limit: perHour }, { bucket, kind: 'day', limit: perDay });
  }
  checks.push({ bucket: `${name}:all`, kind: 'day', limit: dailyCap });

  const db = await dbRateTake(checks);
  if (db) {
    if (!db.allowed) return { allowed: false, retry_after: db.retry_after, via: 'db' };
    if (!hash) {
      // Соли нет — по адресу считаем только в памяти, вдвое строже.
      const byIp = memTake(`${name}:ip:${ip || 'unknown'}`, Math.max(1, Math.floor(perHour / 2)), HOUR);
      if (!byIp.allowed) return { ...byIp, via: 'memory' };
    }
    return { allowed: true, via: 'db' };
  }

  const byIp = memTake(`${name}:ip:${ip || 'unknown'}`, Math.max(1, Math.floor(perHour / 2)), HOUR);
  if (!byIp.allowed) return { ...byIp, via: 'memory' };
  const all = memTake(`${name}:all`, Math.max(1, Math.floor(dailyCap / 4)), DAY);
  return { ...all, via: 'memory' };
}

/** Целое из окружения с запасным значением. */
export function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
