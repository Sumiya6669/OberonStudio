/**
 * Что писать в заголовке и описании каждой страницы.
 *
 * Тексты берутся из того, что на странице уже написано, — из словаря
 * переводов. Придумывать отдельные «сеошные» описания, не совпадающие с
 * содержимым страницы, вредно: поисковик их всё равно перепишет, а человек
 * в выдаче увидит одно, а на странице другое.
 *
 * Порядок источников для каждой страницы:
 *   1. CMS: поля «Заголовок для поиска» и «Описание для поиска» — если
 *      страница опубликована и поля заполнены. Правится из панели;
 *   2. описание отсюда — оно построено из текста самой страницы;
 *   3. умолчание сайта.
 *
 * Ключевое отличие от «одного заголовка на весь сайт», как было: девять
 * страниц перестают конкурировать друг с другом.
 */

import { HREFLANG, OG_LOCALE, localeAlternates, localePath } from '@/lib/i18n/locales';

export const SITE_URL = (
  import.meta?.env?.VITE_SITE_URL || 'https://oberon-studio.vercel.app'
).replace(/\/$/, '');

export const SITE_NAME = 'Oberon Studio';

/** Картинка для превью ссылки в мессенджере и соцсети. */
export const OG_IMAGE = `${SITE_URL}/og.png`;
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/** Страницы, которые попадают в карту сайта и получают свои мета-теги. */
export const SEO_ROUTES = [
  '/', '/services', '/projects', '/products',
  '/process', '/stack', '/reviews', '/faq', '/contact',
];

/**
 * Короткое описание страниц, у которых в словаре нет готовой подписи.
 * Всё остальное собирается из t.<раздел>.sub — текста, который человек
 * и так видит на странице.
 */
const FALLBACK_DESC = {
  '/': {
    ru: 'Разработка и сопровождение 1С, AI-агенты и автоматизация бизнес-процессов. Казахстан.',
    kz: '1С әзірлеу және сүйемелдеу, AI-агенттер және бизнес-процестерді автоматтандыру. Қазақстан.',
    en: '1C development and support, AI agents and business process automation. Kazakhstan.',
  },
  '/services': {
    ru: 'Что я разрабатываю: AI-автоматизация, агенты, CRM, интеграции и работа с 1С.',
    kz: 'Не әзірлеймін: AI-автоматтандыру, агенттер, CRM, интеграциялар және 1С жұмысы.',
    en: 'What I build: AI automation, agents, CRM, integrations and 1C work.',
  },
  '/products': {
    ru: 'Готовые решения: CRM с AI-воронкой, агент продаж, AI-поддержка, онлайн-запись, HoReCa.',
    kz: 'Дайын шешімдер: AI-воронкасы бар CRM, сату агенті, AI-қолдау, онлайн-жазылу, HoReCa.',
    en: 'Ready-made solutions: CRM with an AI funnel, sales agent, AI support, online booking, HoReCa.',
  },
  '/reviews': {
    ru: 'Отзывы клиентов о внедрении AI, CRM и автоматизации.',
    kz: 'AI, CRM және автоматтандыруды енгізу туралы клиенттердің пікірлері.',
    en: 'Client reviews of AI, CRM and automation projects.',
  },
  '/contact': {
    ru: 'Связаться: Telegram, WhatsApp, почта. Ответ в течение часа.',
    kz: 'Байланысу: Telegram, WhatsApp, пошта. Бір сағат ішінде жауап.',
    en: 'Get in touch: Telegram, WhatsApp, email. Reply within an hour.',
  },
};

/** Раздел словаря, из которого берётся подпись страницы. */
const SECTION = {
  '/services': 'services',
  '/projects': 'works',
  '/process': 'process',
  '/stack': 'stack',
  '/reviews': 'reviews',
  '/faq': 'faq',
};

const clip = (text, limit) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).replace(/[\s,.;:—-]+$/, '')}…`;
};

/**
 * Название страницы там, где пункт меню не годится в заголовок выдачи.
 * «Главная» и «Продукты» не отвечают ни на один запрос — а заголовок в
 * выдаче читают раньше всего остального.
 */
const TITLE_OVERRIDE = {
  '/': {
    ru: '1С, AI-агенты и автоматизация бизнеса в Казахстане',
    kz: 'Қазақстанда 1С, AI-агенттер және бизнесті автоматтандыру',
    en: '1C, AI agents and business automation in Kazakhstan',
  },
  '/products': {
    ru: 'Готовые решения: CRM, AI-агенты, онлайн-запись',
    kz: 'Дайын шешімдер: CRM, AI-агенттер, онлайн-жазылу',
    en: 'Ready-made solutions: CRM, AI agents, online booking',
  },
  '/contact': {
    ru: 'Контакты и связь',
    kz: 'Байланыс',
    en: 'Contacts',
  },
};

/** Заголовок вкладки: название страницы плюс название студии. */
function pageTitle(path, t, lang) {
  const override = TITLE_OVERRIDE[path]?.[lang] || TITLE_OVERRIDE[path]?.ru;
  if (override) return override;

  const navKeyByPath = {
    '/': 'home', '/services': 'services', '/projects': 'works',
    '/products': 'products', '/process': 'process', '/stack': 'stack',
    '/reviews': 'reviews', '/faq': 'faq', '/contact': 'contact',
  };
  const section = SECTION[path];
  const fromSection = section && t?.[section]
    ? [t[section].title, t[section].title2].filter(Boolean).join(' ')
    : null;
  const fromNav = t?.nav?.[navKeyByPath[path]] || null;
  return fromSection || fromNav || SITE_NAME;
}

function pageDescription(path, t, lang) {
  const section = SECTION[path];
  const fromSection = section ? t?.[section]?.sub : null;
  const fallback = FALLBACK_DESC[path]?.[lang] || FALLBACK_DESC[path]?.ru;
  const aiSub = path === '/' ? t?.home?.aiSub : null;
  return clip(fromSection || fallback || aiSub || FALLBACK_DESC['/'][lang], 300);
}

/**
 * Итоговые мета-данные страницы.
 * cmsText — тексты страницы из CMS (если опубликована), они главнее.
 */
export function resolvePageSeo({ path, t, lang, cmsText, localised = true }) {
  const clean = path === '/' ? '/' : path.replace(/\/$/, '');
  const canonical = `${SITE_URL}${localePath(localised ? lang : 'ru', clean)}`;

  // hreflang: три языковые версии этой же страницы плюс x-default.
  // x-default — русская: запросы про 1С в Казахстане идут на русском,
  // и отправлять человека «в никуда» ради симметрии незачем.
  //
  // localised = false — страница существует только по-русски (разборы по 1С).
  // Тогда hreflang не ставится вовсе: указать перевод, которого нет, хуже,
  // чем не указывать ничего.
  const alternates = localised ? [
    ...localeAlternates(clean).map((alt) => ({
      hreflang: alt.hreflang,
      href: `${SITE_URL}${alt.path}`,
    })),
    { hreflang: 'x-default', href: `${SITE_URL}${localePath('ru', clean)}` },
  ] : [];

  const cmsTitle = cmsText?.seo_title || cmsText?.title || null;
  const cmsDesc = cmsText?.seo_desc || cmsText?.subtitle || null;

  const base = cmsTitle || pageTitle(clean, t, lang);
  const title = clean === '/'
    ? `${SITE_NAME} — ${clip(base, 70)}`
    : `${clip(base, 60)} — ${SITE_NAME}`;

  return {
    /** Короткое имя страницы: для хлебных крошек, где хвост со студией лишний. */
    pageName: clip(cmsTitle || pageTitle(clean, t, lang), 70),
    title: clip(title, 90),
    description: clip(cmsDesc || pageDescription(clean, t, lang), 300),
    canonical,
    alternates,
    image: OG_IMAGE,
    imageWidth: OG_IMAGE_SIZE.width,
    imageHeight: OG_IMAGE_SIZE.height,
    siteName: SITE_NAME,
    ogLocale: OG_LOCALE[lang] || OG_LOCALE.ru,
    lang: HREFLANG[lang] || lang,
    type: clean === '/' ? 'website' : 'article',
  };
}
