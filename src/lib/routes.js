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

/** Ширина боковой панели на десктопе — используется и в раскладке страниц. */
export const SIDEBAR_WIDTH = 248;

export const CONTACT_PATH = '/contact';
export const PROJECTS_PATH = '/projects';
