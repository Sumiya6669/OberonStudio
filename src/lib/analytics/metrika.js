/**
 * Яндекс Метрика — только с согласия посетителя.
 *
 * Пока человек не нажал «Принять» в баннере, счётчик не загружается вовсе:
 * ни скрипта, ни cookie, ни запросов к Яндексу. «Отклонить» запоминается,
 * и баннер больше не появляется. Номер счётчика — VITE_YM_ID в Vercel; пока
 * его нет, всё здесь ничего не делает и баннер не показывается.
 *
 * Вебвизор выключен: запись экрана посетителя для наших задач не нужна, а
 * персональных данных в ней было бы больше, чем в статистике переходов.
 *
 * Сайт — одностраничное приложение, поэтому просмотры отправляются вручную
 * при каждой смене адреса (`hit`), а не самим счётчиком при загрузке.
 */
const ID = Number(import.meta.env.VITE_YM_ID || 0);
const KEY = 'tk_cookie_consent';

export const metrikaEnabled = ID > 0;

/** 'yes' | 'no' | '' — выбор посетителя в этом браузере. */
export function readConsent() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function saveConsent(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // приватный режим: выбор не запомнится, баннер покажется в следующий раз
  }
  if (value === 'yes') loadMetrika();
}

let loaded = false;

/** Подключает счётчик. Вызывать только после согласия. */
export function loadMetrika() {
  if (!metrikaEnabled || loaded || typeof window === 'undefined' || readConsent() !== 'yes') return;
  loaded = true;
  // Стандартная заглушка Метрики: вызовы до загрузки скрипта копятся в очереди.
  window.ym = window.ym || function ym(...args) { (window.ym.a = window.ym.a || []).push(args); };
  window.ym.l = Date.now();
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(script);
  window.ym(ID, 'init', {
    defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false,
  });
  hit(window.location.pathname + window.location.search, document.referrer);
}

/** Просмотр страницы (смена адреса в приложении). */
export function hit(url, referer) {
  if (!loaded || typeof window.ym !== 'function') return;
  window.ym(ID, 'hit', url, referer ? { referer } : undefined);
}

/** Цель в браузере — когда сервер не смог отправить её сам (нет токена). */
export function reachGoal(name) {
  if (!loaded || typeof window.ym !== 'function') return;
  window.ym(ID, 'reachGoal', name);
}

/**
 * ClientID посетителя в Метрике — для цели «лид» с сервера. Пустая строка,
 * если согласия нет или счётчик не успел ответить: тогда сервер цель не шлёт,
 * и её отправит браузер.
 */
export function clientId(timeoutMs = 800) {
  if (!loaded || typeof window.ym !== 'function') return Promise.resolve('');
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(''), timeoutMs);
    try {
      window.ym(ID, 'getClientID', (id) => {
        clearTimeout(timer);
        resolve(/^\d{6,30}$/.test(String(id)) ? String(id) : '');
      });
    } catch {
      clearTimeout(timer);
      resolve('');
    }
  });
}
