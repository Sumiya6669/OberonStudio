/**
 * Посещения сайта: откуда пришёл человек и какой адрес считать страницей.
 *
 * Только чистые функции — без React, без запросов и без window: их зовут и
 * счётчик в браузере (siteVisits.js), и панель (подписи), и проверка из
 * командной строки (node, набор примеров). Те же правила формата повторяет
 * база (миграция 067, public.site_visit_hit) — чтобы мусор не прошёл, даже
 * если функцию позвать мимо сайта.
 *
 * Что уходит в базу: категория источника, а для «других сайтов» — только
 * домен (без пути и параметров), для меток — только значение utm_source.
 * Полный адрес перехода, IP, браузер, номер посетителя не уходят никуда.
 */

/** Категории источника. Порядок — порядок показа в панели. */
export const SOURCES = [
  'direct', 'google', 'yandex', 'bing', 'telegram', 'whatsapp', 'instagram', 'facebook', '2gis', 'site', 'utm',
];

export const SOURCE_LABELS = {
  direct: 'Напрямую',
  google: 'Google',
  yandex: 'Яндекс',
  bing: 'Bing',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  '2gis': '2ГИС',
  site: 'Другие сайты',
  utm: 'По метке utm_source',
};

/** Поисковики, для которых панель показывает «страницы входа из поиска». */
export const SEARCH_SOURCES = ['google', 'yandex', 'bing'];

// Адрес страницы сайта: латиница в нижнем регистре, цифры, одиночные дефисы, сегменты через «/».
// Так устроены все адреса сайта (/, /kz/faq, /1c/<slug>, /stati/<slug>, /products/<id>).
const PATH_RE = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;
export const PATH_MAX = 100;

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const DOMAIN_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`);
export const DOMAIN_MAX = 100;
const UTM_RE = /^[a-z0-9][a-z0-9._-]{0,39}$/;

/**
 * Путь страницы для счёта: без ?query и #hash, в нижнем регистре, без
 * завершающего «/». Чужой формат (кириллица, %-коды, точки, «//») — null:
 * такой адрес не считаем вовсе.
 */
export function normalizePath(raw) {
  if (typeof raw !== 'string') return null;
  let path = raw.split(/[?#]/)[0].trim().toLowerCase();
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (!path) path = '/';
  if (path.length > PATH_MAX || !PATH_RE.test(path)) return null;
  return path;
}

/** Панель и всё под ней не считаем. */
export const isAdminPath = (path) => path === '/admin' || String(path).startsWith('/admin/');

/**
 * Домен «другого сайта»: без www./m., не длиннее трёх последних частей
 * (a.b.blog.example.com → blog.example.com), только допустимые знаки.
 * IP-адрес и мусор — пустая строка («другой сайт, адрес не показан»).
 */
export function cleanDomain(host) {
  let h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  h = h.replace(/^(?:www\d?|m|l|lm|mobile)\./, '');
  const labels = h.split('.');
  if (labels.length > 3) h = labels.slice(-3).join('.');
  if (!h || h.length > DOMAIN_MAX || !DOMAIN_RE.test(h)) return '';
  // Последняя часть — с буквой: «192.168.0.1» доменом не считаем.
  if (!/[a-z]/.test(labels[labels.length - 1])) return '';
  return h;
}

/** Значение utm_source: латиница, цифры, «._-», до 40 знаков. Иначе — пустая строка. */
export function cleanUtm(value) {
  const v = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  return UTM_RE.test(v) ? v : '';
}

/** Домен → категория. Совпадение по окончанию: www.google.kz, l.instagram.com и т. п. */
const HOST_RULES = [
  ['google', /(?:^|\.)google\.(?:[a-z]{2,3}|com?\.[a-z]{2})$/],
  ['yandex', /(?:^|\.)(?:yandex\.(?:[a-z]{2,3}|com\.[a-z]{2})|ya\.ru)$/],
  ['bing', /(?:^|\.)bing\.com$/],
  ['telegram', /(?:^|\.)(?:t\.me|telegram\.(?:org|me|dog))$/],
  ['whatsapp', /(?:^|\.)(?:whatsapp\.(?:com|net)|wa\.me)$/],
  ['instagram', /(?:^|\.)(?:instagram\.com|ig\.me)$/],
  ['facebook', /(?:^|\.)(?:facebook\.com|fb\.com|fb\.me|fb\.watch|messenger\.com)$/],
  ['2gis', /(?:^|\.)2gis\.(?:[a-z]{2,3}|com\.[a-z]{2})$/],
];

/** Переход из приложения на Android: referrer вида android-app://org.telegram.messenger/. */
const APP_RULES = [
  ['google', /^com\.google\.android\.googlequicksearchbox/],
  ['yandex', /^(?:ru\.yandex|com\.yandex)\./],
  ['telegram', /^(?:org\.telegram\.|org\.thunderdog\.challegram)/],
  ['whatsapp', /^com\.whatsapp/],
  ['instagram', /^com\.instagram\./],
  ['facebook', /^com\.facebook\./],
  ['2gis', /^ru\.dublgis\./],
];

const bare = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

/**
 * Откуда пришёл посетитель.
 *
 *   referrer — document.referrer при заходе;
 *   search   — location.search адреса входа (метки);
 *   ownHosts — домены самого сайта: переход с них — «напрямую».
 *
 * Ответ: { source, detail }. detail — домен для 'site', значение
 * utm_source для 'utm', иначе пустая строка.
 *
 * Порядок: метка utm_source важнее перехода (её ставили сами — для того она
 * и есть); метка клика рекламы (yclid, gclid) без utm — тоже «по метке»,
 * чтобы платный клик не попал в поиск; дальше — домен перехода.
 */
export function classifySource({ referrer = '', search = '', ownHosts = [] } = {}) {
  let params;
  try { params = new URLSearchParams(search || ''); } catch { params = new URLSearchParams(); }
  const utm = (params.get('utm_source') || '').trim();
  if (utm) return { source: 'utm', detail: cleanUtm(utm) };
  if (params.get('yclid')) return { source: 'utm', detail: 'yclid' };
  if (params.get('gclid')) return { source: 'utm', detail: 'gclid' };

  if (!referrer) return { source: 'direct', detail: '' };
  let url;
  try { url = new URL(String(referrer)); } catch { return { source: 'direct', detail: '' }; }

  if (url.protocol === 'android-app:') {
    const pkg = String(url.hostname || '').toLowerCase();
    for (const [source, re] of APP_RULES) if (re.test(pkg)) return { source, detail: '' };
    return { source: 'site', detail: '' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { source: 'direct', detail: '' };

  const host = bare(url.hostname);
  if (!host || ownHosts.some((own) => bare(own) === host)) return { source: 'direct', detail: '' };
  for (const [source, re] of HOST_RULES) if (re.test(host)) return { source, detail: '' };
  return { source: 'site', detail: cleanDomain(host) };
}
