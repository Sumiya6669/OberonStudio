/*
 * Тема сайта — до первой отрисовки.
 *
 * Файл подключён в <head> обычным синхронным <script src> раньше стилей:
 * встроенный скрипт запрещён политикой CSP (script-src 'self'), а внешний
 * файл со своего домена она пускает. Пока он не отработал, браузер ничего
 * не рисует, поэтому человек с тёмной темой не видит вспышку светлой.
 *
 * Выбор хранится в localStorage под ключом tk_theme: 'system' | 'light' | 'dark'.
 * Нет значения или мусор — 'system', то есть как в настройках устройства.
 * Панель /admin всегда тёмная: светлой версии у неё нет.
 *
 * Слушатель смены системной темы живёт в приложении (src/lib/theme.js),
 * здесь только первый выбор. Логика продублирована там же — держать в
 * согласии оба места.
 */
(function () {
  var root = document.documentElement;
  var choice = 'system';
  try {
    var stored = window.localStorage.getItem('tk_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') choice = stored;
  } catch (e) { /* хранилище закрыто — остаётся системная */ }

  var theme = choice;
  if (/^\/admin(\/|$)/.test(window.location.pathname)) {
    theme = 'dark';
  } else if (choice === 'system') {
    theme = 'light';
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
    } catch (e) { /* старый браузер — светлая */ }
  }

  root.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#080808' : '#f6f6f8');
})();
