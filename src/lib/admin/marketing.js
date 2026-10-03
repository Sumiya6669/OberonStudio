/**
 * Маркетинг: счёт заявок по источникам, сборка ссылок с метками, статусы тем
 * Контентщика. Здесь только чистые функции — без React и без запросов,
 * чтобы правило считалось одинаково на всех трёх вкладках.
 *
 * Что реально лежит в базе (миграции 018 и 027, функция public.submit_lead):
 *   crm.ticket.channel      — канал: site / email / telegram / phone / manual;
 *   crm.ticket.landing_page — страница ВХОДА на сайт (не та, где отправили форму);
 *   crm.ticket.referrer     — откуда пришёл посетитель, если браузер сообщил;
 *   crm.ticket.utm          — utm_source, utm_medium, utm_campaign, utm_content, utm_term.
 * Чего в базе нет:
 *   fbclid и yclid — браузер их снимает (campaign.js), но /api/lead и
 *     submit_lead пропускают только utm_*-ключи;
 *   форма (contact_form, ai_consultant, demo_modal) — отдельной колонки нет,
 *     название формы есть только в служебной строке согласия в тексте заявки
 *     (с 04.10.2026, api/lead.js). Отсюда его и читаем.
 */
import { SEO_ROUTES } from '@/lib/seo/pages';
import { localePath } from '@/lib/i18n/locales';

/* ── Период ─────────────────────────────────────────────────────────────── */

export const PERIODS = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: 'custom', label: 'Свой диапазон' },
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** 'YYYY-MM-DD' в местном времени — для полей type="date". */
export const toDateInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fromDateInput = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/**
 * Границы периода: from включительно, to — начало следующего дня после
 * последнего (полуинтервал, чтобы заявка в 23:59 не потерялась).
 * Возвращает { from, to } или { error }.
 */
export function periodRange(code, custom = {}) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (code !== 'custom') {
    const days = Number(code) || 30;
    const from = new Date(today); from.setDate(today.getDate() - (days - 1));
    return { from, to: tomorrow };
  }
  const from = fromDateInput(custom.from);
  const last = fromDateInput(custom.to);
  if (!from || !last) return { error: 'Укажите обе даты.' };
  if (from > last) return { error: 'Дата «с» позже даты «по».' };
  const to = new Date(last); to.setDate(last.getDate() + 1);
  if ((to - from) / 86400000 > 366) return { error: 'Диапазон не больше года.' };
  return { from, to };
}

/* ── Разбор заявок ──────────────────────────────────────────────────────── */

export const CHANNELS = {
  site: 'сайт', email: 'почта', telegram: 'Telegram',
  phone: 'телефон', manual: 'вручную',
};

export const FORMS = {
  contact_form: 'Форма «Контакты»',
  ai_consultant: 'ИИ-консультант (чат)',
  demo_modal: 'Заявка на демо продукта',
  website: 'Форма сайта (без названия)',
};

export const NO_FORM = '(форма не указана)';
export const NO_PAGE = '(страница не передана)';
export const DIRECT = '(прямой заход или браузер не сообщил)';
export const NO_TAG = '(без метки)';

// Строка, которую дописывает api/lead.js:
// «Согласие на обработку ПД: да · версия X · форма contact_form · 2026-10-04».
const CONSENT_FORM_RE = /Согласие на обработку ПД: да · версия [^·\n]* · форма ([^·\n]+?) · \d{4}-\d{2}-\d{2}/;

/** Название формы из служебной строки согласия; null — строки нет. */
export function formOf(body) {
  const m = CONSENT_FORM_RE.exec(body || '');
  return m ? m[1].trim() : null;
}

/** Домен перехода без www: «https://www.google.com/search?…» → google.com. */
export function hostOf(referrer) {
  const value = String(referrer || '').trim();
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, '') || null;
  } catch {
    return value.replace(/^[a-z]+:\/\//i, '').replace(/^www\./, '').split(/[/?#]/)[0] || null;
  }
}

/** Счёт по признаку: [{ name, count, share }] по убыванию. */
export function countBy(rows, pick) {
  const map = new Map();
  for (const row of rows) {
    const key = pick(row);
    map.set(key, (map.get(key) || 0) + 1);
  }
  const total = rows.length;
  return [...map.entries()]
    .map(([name, count]) => ({ name, count, share: total ? (100 * count) / total : 0 }))
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name), 'ru'));
}

export const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

const tagOf = (row, key) => {
  const value = row?.utm?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

/** Сводка по заявкам периода. Все доли — от числа заявок за период. */
export function summarizeLeads(rows) {
  const list = rows || [];
  const site = list.filter((r) => r.channel === 'site');
  const withUtm = list.filter((r) => UTM_FIELDS.some((k) => tagOf(r, k)));
  const withRef = list.filter((r) => hostOf(r.referrer));
  const withForm = list.filter((r) => r.form || formOf(r.body));

  const utm = {};
  for (const key of UTM_FIELDS) utm[key] = countBy(list, (r) => tagOf(r, key) || NO_TAG);

  return {
    total: list.length,
    site: site.length,
    withUtm: withUtm.length,
    withRef: withRef.length,
    withForm: withForm.length,
    byChannel: countBy(list, (r) => CHANNELS[r.channel] || r.channel || '—'),
    byForm: countBy(list, (r) => {
      const code = r.form || formOf(r.body);   // колонка form — с миграции 055, раньше — из строки согласия
      return code ? FORMS[code] || code : NO_FORM;
    }),
    byLanding: countBy(list, (r) => (r.landing_page || '').trim() || NO_PAGE),
    byReferrer: countBy(list, (r) => hostOf(r.referrer) || DIRECT),
    utm,
  };
}

/* ── Ссылки с метками ───────────────────────────────────────────────────── */

const PAGE_LABELS = {
  '/': 'Главная',
  '/services': 'Услуги',
  '/projects': 'Работы',
  '/products': 'Продукты',
  '/process': 'Процесс',
  '/stack': 'Стек',
  '/reviews': 'Отзывы',
  '/faq': 'FAQ',
  '/contact': 'Контакты',
  '/privacy': 'Политика ПД',
};

/**
 * Страницы для ссылок. Разделы из SEO_ROUTES есть на трёх языках; разборы
 * 1С, услуги с ценами и кейсы — только по-русски (см. маршруты в App.jsx).
 */
export const LINK_PAGES = [
  ...SEO_ROUTES.map((path) => ({ path, label: PAGE_LABELS[path] || path, localised: true })),
  { path: '/uslugi', label: 'Услуги и цены', localised: false },
  { path: '/keysy', label: 'Кейсы', localised: false },
  { path: '/1c', label: 'Разборы 1С', localised: false },
];

export const LANGS = [
  { value: 'ru', label: 'Русский' },
  { value: 'kz', label: 'Қазақша' },
  { value: 'en', label: 'English' },
];

/**
 * Готовые сценарии: куда ставится ссылка → source и medium. Значения
 * латиницей и в нижнем регистре: метки чувствительны к регистру, и «Telegram»
 * с «telegram» в отчёте стали бы двумя источниками.
 */
export const LINK_PRESETS = [
  { code: 'tg_channel', label: 'Telegram-канал', utm_source: 'telegram', utm_medium: 'channel' },
  { code: 'buh_chat', label: 'Чат бухгалтеров', utm_source: 'buh_chat', utm_medium: 'chat' },
  { code: '2gis', label: '2ГИС', utm_source: '2gis', utm_medium: 'listing' },
  { code: 'partner', label: 'Партнёр-бухфирма', utm_source: 'partner', utm_medium: 'referral' },
  { code: 'newsletter', label: 'Рассылка', utm_source: 'newsletter', utm_medium: 'email' },
  { code: 'dm', label: 'Личное сообщение', utm_source: 'personal', utm_medium: 'dm' },
];

/** Подсказки к полям: нажатие подставляет значение. */
export const UTM_HINTS = {
  utm_source: ['telegram', 'whatsapp', 'instagram', '2gis', 'partner', 'newsletter', 'personal'],
  utm_medium: ['channel', 'chat', 'listing', 'referral', 'email', 'dm', 'post'],
  utm_campaign: ['esf_snt', 'kaspi', 'ip_tax', 'products_1c'],
  utm_content: ['post', 'pinned', 'bio', 'button', 'story', 'signature'],
};

/** Чистка значения метки: без пробелов по краям, пробелы внутри → «_», нижний регистр. */
export const cleanTag = (value) =>
  String(value || '').trim().replace(/\s+/g, '_').toLowerCase().slice(0, 200);

/** Чистка «своего адреса»: только путь сайта, без домена, запроса и якоря. */
export function cleanPath(value) {
  let path = String(value || '').trim();
  if (!path) return '';
  path = path.replace(/^[a-z]+:\/\/[^/]+/i, '');
  path = path.split(/[?#]/)[0];
  if (!path.startsWith('/')) path = `/${path}`;
  return path.replace(/\/{2,}/g, '/');
}

/** Собирает ссылку: адрес сайта + страница на нужном языке + непустые метки. */
export function buildCampaignUrl({ base, lang, path, tags }) {
  const root = String(base || '').replace(/\/$/, '');
  const params = new URLSearchParams();
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = cleanTag(tags?.[key]);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `${root}${localePath(lang, path || '/')}${query ? `?${query}` : ''}`;
}

/* ── Последние ссылки (только в этом браузере) ─────────────────────────── */

const HISTORY_KEY = 'tinker_admin_utm_links';
export const HISTORY_LIMIT = 20;

export function loadLinkHistory() {
  try {
    if (typeof window === 'undefined') return [];
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((x) => x && typeof x.url === 'string').slice(0, HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

/** Добавляет ссылку наверх списка (повтор поднимается, а не дублируется). */
export function pushLinkHistory(list, entry) {
  const next = [entry, ...(list || []).filter((x) => x.url !== entry.url)].slice(0, HISTORY_LIMIT);
  saveLinkHistory(next);
  return next;
}

export function saveLinkHistory(list) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list || []));
  } catch {
    // Приватный режим или запрет хранилища: список просто не запомнится.
  }
}

/* ── Темы Контентщика (миграция 047) ───────────────────────────────────── */

export const TOPIC_STATUS = {
  next: { label: 'следующая', tone: 'new' },
  queued: { label: 'в очереди', tone: 'queued' },
  returned: { label: 'в очереди: текст отклонён', tone: 'failed' },
  taken: { label: 'взята в работу', tone: 'leased' },
  draft: { label: 'черновик', tone: 'triaged' },
  proposed: { label: 'на согласовании', tone: 'awaiting' },
  approved: { label: 'одобрена, ждёт публикации', tone: 'approved' },
  published: { label: 'опубликована', tone: 'done' },
  off: { label: 'выключена', tone: 'cancelled' },
};

/**
 * Статус темы — из самой темы и её последнего поста. Правила те же, что в
 * базе: cms.post_next_topic берёт активную тему без used_at по position;
 * отказ в посте снимает used_at и возвращает тему в очередь.
 */
export function topicRows(topics, posts) {
  const lastPost = new Map();
  for (const post of posts || []) {
    if (post.topic_id == null) continue;
    const cur = lastPost.get(post.topic_id);
    if (!cur || new Date(post.created_at) > new Date(cur.created_at)) lastPost.set(post.topic_id, post);
  }

  const ordered = [...(topics || [])].sort((a, b) => (a.position - b.position) || (a.id - b.id));
  let nextGiven = false;
  return ordered.map((topic) => {
    const post = lastPost.get(topic.id) || null;
    let status;
    if (!topic.is_active) status = 'off';
    else if (!topic.used_at) {
      status = nextGiven ? (post?.status === 'rejected' ? 'returned' : 'queued') : 'next';
      nextGiven = true;
    } else if (!post || post.status === 'rejected') status = 'taken';
    else status = post.status;
    return { ...topic, post, status };
  });
}
