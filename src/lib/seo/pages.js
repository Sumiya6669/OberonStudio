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
  import.meta?.env?.VITE_SITE_URL || 'https://tinker-kz.vercel.app'
).replace(/\/$/, '');

export const SITE_NAME = 'Tinker';

/** Картинка для превью ссылки в мессенджере и соцсети. */
export const OG_IMAGE = `${SITE_URL}/og.png`;
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/** Страницы, которые попадают в карту сайта и получают свои мета-теги. */
export const SEO_ROUTES = [
  '/', '/services', '/projects', '/products', '/proverka', '/bezopasnost',
  '/process', '/stack', '/reviews', '/faq', '/contact', '/privacy',
];

/**
 * Короткое описание страниц, у которых в словаре нет готовой подписи.
 * Всё остальное собирается из t.<раздел>.sub — текста, который человек
 * и так видит на странице.
 */
const FALLBACK_DESC = {
  '/': {
    ru: 'Расширения для 1С:Бухгалтерии для Казахстана 3.0 и КА 2.4, ИИ-агенты, CRM и интеграции с Kaspi и банками. Бесплатная экспресс-проверка базы 1С.',
    kz: 'Қазақстанға арналған 1С:Бухгалтерия 3.0 және КА 2.4 кеңейтулері, AI-агенттер, CRM, Kaspi және банктермен интеграциялар. 1С базасын тегін жедел тексеру.',
    en: 'Extensions for 1C:Accounting for Kazakhstan 3.0 and Complex Automation 2.4, AI agents, CRM and integrations with Kaspi and banks. Free express check of your 1C database.',
  },
  '/services': {
    ru: 'Что я разрабатываю: AI-автоматизация, агенты, CRM, интеграции и работа с 1С.',
    kz: 'Не әзірлеймін: AI-автоматтандыру, агенттер, CRM, интеграциялар және 1С жұмысы.',
    en: 'What I build: AI automation, agents, CRM, integrations and 1C work.',
  },
  '/products': {
    ru: '12 расширений 1С для БухКз и КА: ЭСФ, разноска банка, СНТ, акты сверки, дебиторка. Боты для Kaspi, WhatsApp и iiko. Цены на сайте.',
    kz: 'БухКз және КА үшін 12 1С кеңейтімі: ЭШФ, банк, ТІЖ, салыстыру актілері, дебиторлық берешек. Kaspi, WhatsApp және iiko боттары. Бағалар сайтта.',
    en: '12 1C extensions for Accounting KZ and Complex Automation: e-invoices, bank posting, waybills, reconciliations, receivables. Bots for Kaspi, WhatsApp and iiko. Prices on the site.',
  },
  '/proverka': {
    ru: 'Внешняя обработка .epf для Бухгалтерии для Казахстана 3.0 и КА 2.4: за пару минут находит ЭСФ без выписки, просроченную дебиторку, ошибки СНТ и ВС, неразнесённый банк, неверные ИИН/БИН и встречные долги. Только чтение.',
    kz: 'Қазақстанға арналған Бухгалтерия 3.0 және КА 2.4 үшін .epf сыртқы өңдеуі: бірнеше минутта жазылмаған ЭШФ, мерзімі өткен дебиторлық берешек, ТІЖ мен виртуалды қойма қателері, банк түсімдері, қате ЖСН/БСН және қарсы қарыздарды табады. Тек оқу.',
    en: 'An external .epf processor for 1C:Accounting for Kazakhstan 3.0 and Complex Automation 2.4: in a couple of minutes it finds missing e-invoices, overdue receivables, SNT and virtual-warehouse errors, unposted bank receipts, invalid IIN/BIN and mutual debts. Read-only.',
  },
  '/bezopasnost': {
    ru: 'Что расширения Tinker делают с базой 1С: типовую конфигурацию не меняют, какие документы создают и как, что и куда уходит наружу, подписанные обновления Ed25519, роли, HTTPS и хранение ключей.',
    kz: 'Tinker кеңейтулері 1С базасымен не істейді: типтік конфигурацияны өзгертпейді, қандай құжаттарды қалай жасайды, сыртқа не және қайда кетеді, Ed25519 қолтаңбалы жаңартулар, рөлдер, HTTPS және кілттерді сақтау.',
    en: 'What Tinker 1C extensions do with your database: no changes to the standard configuration, which documents they create and how, what leaves the database, Ed25519-signed updates, roles, HTTPS and key storage.',
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
  '/privacy': {
    ru: 'Какие персональные данные собирает Tinker, зачем, где хранит и кому передаёт; текст согласия, cookie и ваши права.',
    kz: 'Tinker қандай дербес деректерді жинайды, не үшін, қайда сақтайды және кімге береді; келісім мәтіні, cookie және құқықтарыңыз. Құжат орыс тілінде.',
    en: 'What personal data Tinker collects, why, where it is stored and who receives it; consent terms, cookies and your rights. The document is in Russian.',
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
    ru: 'Автоматизация бизнеса и 1С через ИИ в Казахстане',
    kz: 'Қазақстанда бизнес пен 1С-ті AI арқылы автоматтандыру',
    en: 'Business and 1C automation with AI in Kazakhstan',
  },
  '/products': {
    ru: 'Продукты для 1С и бизнеса: расширения, боты, цены',
    kz: '1С және бизнес өнімдері: кеңейтімдер, боттар, бағалар',
    en: 'Products for 1C and business: extensions, bots, prices',
  },
  '/proverka': {
    ru: 'Бесплатная экспресс-проверка базы 1С',
    kz: '1С базасын тегін жедел тексеру',
    en: 'Free express check of your 1C database',
  },
  '/bezopasnost': {
    ru: 'Безопасность: что продукты Tinker делают с базой 1С',
    kz: 'Қауіпсіздік: Tinker өнімдері 1С базасымен не істейді',
    en: 'Security: what Tinker products do with your 1C database',
  },
  '/contact': {
    ru: 'Контакты и связь',
    kz: 'Байланыс',
    en: 'Contacts',
  },
  '/privacy': {
    ru: 'Политика обработки персональных данных',
    kz: 'Дербес деректерді өңдеу саясаты',
    en: 'Personal data policy',
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
