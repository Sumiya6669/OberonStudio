/**
 * Карта публичных страниц сайта.
 * Один источник правды для меню, футера и блока разделов на главной.
 * `navKey` — ключ в `t.nav`, чтобы подписи оставались локализованными.
 */
export const SITE_ROUTES = [
  { path: '/', navKey: 'home', icon: 'Home' },
  { path: '/services', navKey: 'services', icon: 'Sparkles' },
  { path: '/projects', navKey: 'works', icon: 'FolderKanban' },
  { path: '/products', navKey: 'products', icon: 'Package' },
  { path: '/process', navKey: 'process', icon: 'Workflow' },
  { path: '/stack', navKey: 'stack', icon: 'Layers' },
  { path: '/reviews', navKey: 'reviews', icon: 'Star' },
  { path: '/faq', navKey: 'faq', icon: 'HelpCircle' },
  { path: '/contact', navKey: 'contact', icon: 'Mail' },
];


/**
 * Разделы каталога для выпадающего меню под пунктом «Продукты».
 *
 * cat — значение из product.categories, по нему страница сразу включает
 * фильтр. Подписи короткие намеренно: это меню, а не заголовки, и
 * «Расширения для 1С:Бухгалтерии» в колонку шириной 248 пикселей не
 * помещается, а перенос в две строки читается как ошибка вёрстки.
 */
export const PRODUCT_GROUPS = [
  { cat: '1С',          label: 'Расширения 1С', hint: 'ЭСФ, СНТ, банк, НДС' },
  { cat: 'Боты',        label: 'Боты и сервисы', hint: 'кадры, Kaspi, iiko, WhatsApp' },
  { cat: 'Сайты',       label: 'Сайты',         hint: 'от лендинга до магазина' },
  { cat: 'Приложения',  label: 'Приложения',    hint: 'мобильные и десктоп' },
  { cat: 'Мобильные',   label: 'Мобильные',     hint: 'iOS и Android' },
  { cat: 'CRM',         label: 'CRM',           hint: 'под ваш процесс' },
];

/** Ширина боковой панели на десктопе — используется и в раскладке страниц. */
export const SIDEBAR_WIDTH = 248;

export const CONTACT_PATH = '/contact';
export const PROJECTS_PATH = '/projects';
