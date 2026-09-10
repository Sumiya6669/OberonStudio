/**
 * Сборка страниц сайта в готовый HTML.
 *
 * Зачем. Сейчас сервер отдаёт пустой <div id="root">, и весь текст рисует
 * браузер. Google это переваривает, Яндекс хуже, а краулеры моделей —
 * GPTBot, ClaudeBot, PerplexityBot — в большинстве своём JavaScript не
 * исполняют вовсе. Для них сайта нет. Не «плохо ранжируется» — нет.
 *
 * Что делает скрипт. Берёт ту же самую сборку приложения, рисует каждую
 * страницу в HTML и кладёт рядом с ней мета-теги и разметку JSON-LD.
 * Браузер человека подхватывает готовую разметку (hydrateRoot) и работает
 * дальше как раньше — ни одна анимация не меняется.
 *
 * Почему поведение для человека не меняется. Разметку собирает ТОТ ЖЕ
 * компонент, что рисует страницу в браузере, и в том же начальном состоянии.
 * Блоки, которые проявляются при прокрутке, в собранном HTML стоят ровно в
 * том виде, в каком браузер рисует их в первый кадр, — то есть прозрачными.
 * Поэтому первый кадр в браузере совпадает с разметкой байт в байт, и
 * подмены, которую видно глазом, не происходит. Текст при этом в HTML есть,
 * и роботы, не исполняющие стили, читают его целиком.
 *
 * Содержимое берётся из CMS на момент сборки. Ничего не опубликовано или
 * база недоступна — собирается то, что зашито в коде, ровно как сейчас.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SSR = path.join(ROOT, 'dist-ssr', 'entry-server.js');

const SITE_URL = (process.env.VITE_SITE_URL || 'https://oberon-studio.vercel.app')
  .replace(/\/$/, '');

const ROUTES = [
  '/', '/services', '/projects', '/products',
  '/process', '/stack', '/reviews', '/faq', '/contact',
];

/** Краулеры моделей. Пускаем осознанно: без них раздела GEO просто нет. */
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-Web', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended',
  'CCBot', 'YandexAdditional', 'Bytespider', 'meta-externalagent',
];

const log = (line) => process.stdout.write(`  ${line}\n`);

/**
 * Опубликованное содержимое сайта на момент сборки.
 * Недоступно — не беда: страницы соберутся на текстах из кода.
 */
async function loadContent(locale = 'ru') {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    log('содержимое CMS: переменные не заданы, собираю на текстах из кода');
    return null;
  }
  try {
    const response = await fetch(`${url}/rest/v1/rpc/site_content`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_locale: locale }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      log(`содержимое CMS: ответ ${response.status}, собираю на текстах из кода`);
      return null;
    }
    const data = await response.json();
    const pages = data?.pages?.length || 0;
    const items = Object.values(data?.collections || {})
      .reduce((sum, list) => sum + (list?.length || 0), 0);
    log(`содержимое CMS: страниц ${pages}, записей в справочниках ${items}`);
    return data;
  } catch (error) {
    log(`содержимое CMS: ${error.message}; собираю на текстах из кода`);
    return null;
  }
}

function outFile(route) {
  return route === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, route.replace(/^\//, ''), 'index.html');
}

function buildSitemap(routes, content) {
  const lastmod = content?.updated_at
    ? new Date(content.updated_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Главная важнее внутренних, контакты — реже остальных. Числа тут не
  // магические: это подсказка обходчику, а не обещание.
  const weight = (route) => (route === '/' ? '1.0' : route === '/contact' ? '0.6' : '0.8');

  const urls = routes.map((route) => [
    '  <url>',
    `    <loc>${SITE_URL}${route === '/' ? '/' : route}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <priority>${weight(route)}</priority>`,
    '  </url>',
  ].join('\n')).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildRobots() {
  const allowAi = AI_CRAWLERS.map(
    (bot) => `User-agent: ${bot}\nAllow: /\nDisallow: /admin\nDisallow: /app.html\n`,
  ).join('\n');

  return `# Панель управления в поиске не нужна.
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /app.html

# Краулеры моделей пускаем осознанно: именно они решают, попадёт ли студия
# в ответ, когда человек спрашивает про 1С в Казахстане. Запрет по умолчанию
# был бы решением против этого, принятым молча.
${allowAi}
Sitemap: ${SITE_URL}/sitemap.xml
`;
}

/** Короткая карта сайта для агентов: складывающаяся, но дешёвая договорённость. */
function buildLlmsTxt(content) {
  const settings = content?.settings || {};
  const contacts = [
    settings.telegram_url && `- Telegram: ${settings.telegram_url}`,
    settings.whatsapp_url && `- WhatsApp: ${settings.whatsapp_url}`,
    settings.email && `- Почта: ${settings.email}`,
  ].filter(Boolean).join('\n');

  return `# Oberon Studio

> Разработка и сопровождение 1С, AI-агенты и автоматизация бизнес-процессов.
> Казахстан.

## Страницы

- [Главная](${SITE_URL}/): о студии и подходе
- [Услуги](${SITE_URL}/services): что разрабатывается
- [Проекты](${SITE_URL}/projects): реализованные работы
- [Готовые решения](${SITE_URL}/products): CRM, агенты, онлайн-запись
- [Процесс](${SITE_URL}/process): как проходит работа
- [Стек](${SITE_URL}/stack): технологии
- [Отзывы](${SITE_URL}/reviews): отзывы клиентов
- [Вопросы](${SITE_URL}/faq): частые вопросы и ответы
- [Контакты](${SITE_URL}/contact): связаться

${contacts ? `## Связаться\n\n${contacts}\n` : ''}`;
}

/**
 * Пустой шаблон страницы.
 *
 * Тонкость: скрипт пишет результат в тот же dist/index.html, из которого
 * читает шаблон. При повторном запуске без пересборки шаблон оказался бы
 * уже собранной главной, и подстановка молча не сработала бы. Поэтому
 * чистый шаблон сохраняется рядом со серверной сборкой — она в deploy
 * не попадает.
 */
async function loadTemplate() {
  const spare = path.join(ROOT, 'dist-ssr', 'template.html');
  const built = await readFile(path.join(DIST, 'index.html'), 'utf8');

  if (built.includes('<div id="root"></div>')) {
    await writeFile(spare, built, 'utf8');
    return built;
  }
  log('главная уже собрана: беру чистый шаблон, сохранённый при прошлой сборке');
  return readFile(spare, 'utf8');
}

async function main() {
  const template = await loadTemplate();
  if (!template.includes('<!--seo-->')) {
    throw new Error('в index.html нет метки <!--seo-->: подставлять теги некуда');
  }

  const { render } = await import(SSR);
  const content = await loadContent('ru');

  let done = 0;
  for (const route of ROUTES) {
    const { html, head } = render(route, { content, lang: 'ru' });

    const page = template
      .replace(
        /<!--seo-->[\s\S]*?<!--\/seo-->/,
        `<!--seo-->\n    ${head}\n    <!--/seo-->`,
      )
      // Пометка для браузера: разметка пришла собранной. По ней LangProvider
      // понимает, что первый кадр обязан совпасть с русской версией.
      .replace('<html lang="ru">', '<html lang="ru" data-prerendered="1">')
      .replace('<div id="root"></div>', `<div id="root">${html}</div>`);

    const file = outFile(route);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, page, 'utf8');
    done += 1;
    log(`${route.padEnd(12)} → ${path.relative(ROOT, file)}  (${Math.round(page.length / 1024)} КБ)`);
  }

  // Пустая оболочка для маршрутов, которые заранее не собираются: панель
  // /admin и всё неизвестное.
  //
  // Отдельным файлом, а не через dist/index.html: index.html — это теперь
  // СОБРАННАЯ ГЛАВНАЯ. Отдать её на /admin значит попросить браузер подхватить
  // разметку главной страницы на маршруте панели: расхождение гидратации,
  // мелькнувшая главная и ошибки в консоли. Пустая оболочка отрисуется
  // обычным образом, как панель и работала всегда.
  await writeFile(path.join(DIST, 'app.html'), template, 'utf8');

  // Та же оболочка вторым файлом — как настоящая страница /admin.
  //
  // Зачем дубль. Переписывание адреса (rewrites) — это правило, которое
  // выполняется ПОСЛЕ поиска файла. Пока /admin существует файлом, вход в
  // панель не зависит от правил вообще: сколько бы раз ни менялась
  // маршрутизация, эта дверь открыта. Вложенные адреса панели
  // (/admin/money и прочие) по-прежнему приходят через правило.
  await mkdir(path.join(DIST, 'admin'), { recursive: true });
  await writeFile(path.join(DIST, 'admin', 'index.html'), template, 'utf8');

  await writeFile(path.join(DIST, 'sitemap.xml'), buildSitemap(ROUTES, content), 'utf8');
  await writeFile(path.join(DIST, 'robots.txt'), buildRobots(), 'utf8');
  await writeFile(path.join(DIST, 'llms.txt'), buildLlmsTxt(content), 'utf8');

  log(`собрано страниц: ${done}; app.html, admin/index.html, sitemap.xml, robots.txt, llms.txt на месте`);
}

main().catch((error) => {
  // Падать громко: молча собранный сайт без страниц выглядит как рабочий.
  console.error('\nСборка страниц не удалась:\n', error);
  process.exit(1);
});
