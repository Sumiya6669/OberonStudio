/**
 * Карта публичных страниц сайта — плоским списком, для подвала.
 * Меню собрано из тех же адресов, но с подменю — см. NAV_MENU ниже.
 * `navKey` — ключ в `t.nav`, чтобы подписи оставались локализованными.
 */
export const SITE_ROUTES = [
  { path: '/', navKey: 'home', icon: 'Home' },
  { path: '/services', navKey: 'services', icon: 'Sparkles' },
  { path: '/projects', navKey: 'works', icon: 'FolderKanban' },
  { path: '/products', navKey: 'products', icon: 'Package' },
  { path: '/proverka', navKey: 'proverka', icon: 'ScanSearch' },
  { path: '/bezopasnost', navKey: 'security', icon: 'ShieldCheck' },
  { path: '/process', navKey: 'process', icon: 'Workflow' },
  { path: '/stack', navKey: 'stack', icon: 'Layers' },
  { path: '/reviews', navKey: 'reviews', icon: 'Star' },
  { path: '/faq', navKey: 'faq', icon: 'HelpCircle' },
  { path: '/contact', navKey: 'contact', icon: 'Mail' },
];


/**
 * Меню сайта: шесть пунктов, у трёх — подменю.
 *
 * SITE_ROUTES выше — плоский список страниц для подвала, здесь — то, как
 * их видит человек в меню. Адреса страниц от меню не зависят: перестроить
 * меню можно, не трогая ни одной ссылки, карты сайта и поисковой выдачи.
 *
 * У пункта с подменю `path` — куда ведёт сам пункт, `children` — подпункты.
 * Подпункт активен, если адрес совпадает с `to` (или начинается с `to/`);
 * у подпунктов каталога (`cat`) дополнительно должен совпасть фильтр
 * `?cat=`. Пункт активен, если активен любой его подпункт, совпал `path`
 * или адрес попал в `also` — страницы, которых нет в меню, но которые
 * по смыслу лежат в этом разделе.
 *
 * `ruOnly` — страница есть только по-русски (/1c), ссылка на неё не
 * получает языковую приставку: /kz/1c не существует.
 *
 * Подписи короткие намеренно: колонка подменю узкая, а перенос в две
 * строки читается как ошибка вёрстки.
 */
export const NAV_MENU = [
  { path: '/', navKey: 'home', icon: 'Home' },
  {
    path: '/products', navKey: 'products', icon: 'Package',
    children: [
      { to: '/products', cat: '1С', navKey: 'ext1c', icon: 'Puzzle' },
      { to: '/products', cat: 'Боты', navKey: 'bots', icon: 'Bot' },
      { to: '/proverka', navKey: 'proverkaFree', icon: 'ScanSearch' },
      { to: '/bezopasnost', navKey: 'security', icon: 'ShieldCheck' },
    ],
  },
  {
    path: '/services', navKey: 'services', icon: 'Briefcase',
    also: ['/uslugi', '/keysy'],
    children: [
      { to: '/services', navKey: 'whatIDo', icon: 'Sparkles' },
      { to: '/projects', navKey: 'works', icon: 'FolderKanban' },
      { to: '/process', navKey: 'howIWork', icon: 'Workflow' },
      { to: '/stack', navKey: 'tech', icon: 'Layers' },
    ],
  },
  {
    path: '/1c', navKey: 'answers', icon: 'BookOpen', ruOnly: true,
    children: [
      { to: '/1c', navKey: 'answers1c', icon: 'Wrench', ruOnly: true },
      { to: '/faq', navKey: 'faqFull', icon: 'HelpCircle' },
    ],
  },
  { path: '/reviews', navKey: 'reviews', icon: 'Star' },
  { path: '/contact', navKey: 'contact', icon: 'Mail' },
];

/** Полный адрес подпункта: у разделов каталога — с фильтром `?cat=`. */
export const menuHref = (item) => (item.cat ? `${item.to}?cat=${encodeURIComponent(item.cat)}` : item.to);

const podPutem = (path, base) => base !== '/' && (path === base || path.startsWith(`${base}/`));

/** Активен ли подпункт на странице `path` (без языковой приставки) с фильтром `cat`. */
export function isMenuChildActive(item, path, cat) {
  if (item.cat) return path === item.to && cat === item.cat;
  return podPutem(path, item.to);
}

/** Активен ли пункт меню: сам адрес, любой подпункт или страница из `also`. */
export function isMenuItemActive(item, path, cat) {
  if (item.path === '/') return path === '/';
  if (podPutem(path, item.path)) return true;
  if ((item.also || []).some((p) => podPutem(path, p))) return true;
  return (item.children || []).some((c) => isMenuChildActive(c, path, cat));
}

/** Ширина боковой панели на десктопе — используется и в раскладке страниц. */
export const SIDEBAR_WIDTH = 248;

export const CONTACT_PATH = '/contact';
export const PROJECTS_PATH = '/projects';
