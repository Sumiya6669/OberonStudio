#!/usr/bin/env node
/**
 * Проверки собранного сайта.
 *
 * Зачем файл в репозитории, а не «посмотрю в браузере»: посмотреть можно
 * три страницы из сорока шести, и ломается всегда четвёртая. Здесь
 * проверяется то, что видит поисковик и человек с выключенным JavaScript —
 * то есть СОБРАННЫЙ html, а не то, что дорисует браузер.
 *
 * Браузер и сеть не нужны намеренно: проверка должна запускаться в одну
 * команду сразу после сборки, иначе её не будут запускать.
 *
 *   npm run build && node scripts/check-site.mjs
 *   node scripts/check-site.mjs --url https://tinker-kz.vercel.app
 *
 * С `--url` проверяется живой сайт: те же правила, но по сети. Полезно
 * после пересборки из панели — она собирает не из этой папки.
 *
 * Возвращает 1, если хоть одна проверка не прошла: тогда это можно
 * поставить в раннер и в поставку.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const BASE = urlIndex >= 0 ? args[urlIndex + 1].replace(/\/$/, '') : null;
const DIST = resolve(args.find((a) => !a.startsWith('--') && a !== BASE) || 'dist');

const LOCALES = ['ru', 'kk', 'en'];
/** Разделы только на русском: у них не должно быть языковых альтернатив. */
// Статья эксперта — на языке оригинала, без перевода; сам список /stati — на трёх языках.
// Страница расширения 1С /products/<id> — тоже только по-русски; сам каталог /products — на трёх.
const RU_ONLY = [/^\/1c(\/|$)/, /^\/uslugi(\/|$)/, /^\/keysy(\/|$)/, /^\/stati\/.+/, /^\/products\/.+/];
/**
 * Двенадцать расширений 1С, у каждого — своя страница /products/<id>
 * (src/lib/content/productPages.js). Список здесь, а не из сборки, намеренно:
 * пропавший из сборки продукт должен ронять проверку, а не тихо исчезать из неё.
 */
const PRODUCT_PAGE_IDS = [
  'bank-robot', 'esf', 'vs-snt', 'antikameralka', 'eaes-import', 'kaspi',
  'pervichka', 'akty-sverki', 'pult', 'counterparty', 'marking', 'receivables',
];
/** Разборы из каталога сайта (ключи ANSWER_PRODUCTS) — для проверки ссылок, когда сборка без базы. */
const KNOWN_ANSWERS = new Set(
  [...readFileSync(resolve('src/lib/content/answerProducts.js'), 'utf8').matchAll(/^\s*'([a-z0-9-]+)':\s*\{/gm)]
    .map((m) => `/1c/${m[1]}`),
);

let failed = 0;
let passed = 0;

const ok = (name, note = '') => { passed += 1; console.log(`  ок    ${name}${note ? ' — ' + note : ''}`); };
const bad = (name, why) => { failed += 1; console.log(`  СБОЙ  ${name} — ${why}`); };
const check = (name, cond, why) => (cond ? ok(name) : bad(name, why));

/* ── Как достаётся страница ─────────────────────────────────────────────── */

/**
 * Правила Vercel в порядке применения: сначала файл, потом переписывание
 * всего остального в /app.html. Здесь повторяется ровно это — иначе
 * проверка проверяла бы не то, что отдаёт сайт.
 */
function fromDist(path) {
  const clean = path.split('?')[0].replace(/\/$/, '') || '/';
  const candidates = clean === '/'
    ? ['index.html']
    : [`${clean.slice(1)}.html`, join(clean.slice(1), 'index.html'), clean.slice(1)];
  for (const c of candidates) {
    const file = join(DIST, c);
    if (existsSync(file) && statSync(file).isFile()) {
      return { status: 200, body: readFileSync(file, 'utf8'), from: c };
    }
  }
  const fallback = join(DIST, 'app.html');
  if (existsSync(fallback)) {
    return { status: 200, body: readFileSync(fallback, 'utf8'), from: 'app.html (переписывание)' };
  }
  return { status: 404, body: '', from: null };
}

async function fromWeb(path) {
  // Сетевая ошибка — это не «страница сломана», и вываливать на неё стек
  // вызовов бессмысленно: читать его всё равно будет человек, у которого
  // просто нет интернета. Отдаём 0 и объясняем это выше по-человечески.
  try {
    const res = await fetch(BASE + path, { redirect: 'follow' });
    return { status: res.status, body: await res.text(), from: 'сеть' };
  } catch (e) {
    return { status: 0, body: '', from: 'сеть', error: e.message };
  }
}

const get = (path) => (BASE ? fromWeb(path) : Promise.resolve(fromDist(path)));

/* ── Разбор html без библиотеки ─────────────────────────────────────────── */

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
};
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];
const lang = (html) => attr(html.match(/<html\b[^>]*>/i)?.[0] || '', 'lang');
const title = (html) => (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
const meta = (html, prop) => {
  const found = tags(html, 'meta').find((t) => (attr(t, 'name') === prop || attr(t, 'property') === prop));
  return found ? attr(found, 'content') : null;
};
const links = (html, rel) => tags(html, 'link').filter((t) => attr(t, 'rel') === rel);
const jsonLd = (html) => {
  const blocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  return blocks.map((b) => {
    const raw = b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try { return JSON.parse(raw); } catch { return { __broken: raw.slice(0, 80) }; }
  });
};
const embedded = (html) => {
  const m = html.match(/<script[^>]*id="site-content"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return { __broken: true }; }
};
const isRuOnly = (path) => RU_ONLY.some((re) => re.test(path));

/**
 * Тема ставится скриптом /theme-init.js до первой отрисовки. Он обязан стоять
 * в <head> раньше стилей: иначе человек с тёмной темой увидит вспышку
 * светлой. Возвращает текст проблемы или null.
 */
function themeInitProblem(html) {
  const head = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || '';
  const script = head.search(/<script\b[^>]*\bsrc="\/theme-init\.js"[^>]*>\s*<\/script>/i);
  if (script < 0) return 'в <head> нет <script src="/theme-init.js">';
  if (/<script\b[^>]*\bsrc="\/theme-init\.js"[^>]*\b(async|defer|type="module")/i.test(head)) {
    return '/theme-init.js должен быть синхронным (без async, defer, type="module")';
  }
  const style = head.search(/<link\b[^>]*rel="stylesheet"|<style\b/i);
  if (style >= 0 && style < script) return '/theme-init.js стоит после стилей — будет вспышка темы';
  return null;
}

/* ── Проверки ───────────────────────────────────────────────────────────── */

async function checkSitemap() {
  console.log('\nКарта сайта');
  const { status, body } = await get('/sitemap.xml');
  if (BASE && [0, 403, 407, 502, 503].includes(status)) {
    // Такой ответ на карту сайта означает не сломанный сайт, а закрытую
    // сеть: прокси, корпоративный фильтр, отсутствие интернета. Сообщать
    // об этом как о сорока шести сломанных страницах — врать.
    console.log(`\n  Сеть не пускает: ${BASE}/sitemap.xml — ${status === 0 ? 'адрес не разрешается' : 'ответ ' + status}.`);
    console.log('  Это про доступ, а не про сайт. Проверьте без --url или из другой сети.');
    process.exit(2);
  }
  if (status !== 200 || !body.includes('<urlset')) {
    bad('sitemap.xml', `отдался как ${status}`);
    return [];
  }
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paths = locs.map((l) => l.replace(/^https?:\/\/[^/]+/, '') || '/');
  check('sitemap.xml отдаётся', true);
  check('в карте есть адреса', paths.length > 10, `всего ${paths.length}`);
  const dup = paths.filter((p, i) => paths.indexOf(p) !== i);
  check('нет повторов', dup.length === 0, `повторы: ${dup.join(', ')}`);
  const abs = locs.every((l) => l.startsWith('http'));
  check('адреса полные', abs, 'в карте сайта нужны абсолютные адреса');
  ok('адресов в карте', String(paths.length));
  return paths;
}

async function checkPage(path) {
  const { status, body, from } = await get(path);
  const name = path;
  if (status !== 200) return bad(name, `отдался как ${status}`);
  if (from === 'app.html (переписывание)' || (!BASE && from === 'app.html')) {
    return bad(name, 'страница не собрана заранее: поисковик увидит пустую заготовку');
  }
  const problems = [];
  if (!title(body)) problems.push('нет заголовка');
  if (!meta(body, 'description')) problems.push('нет описания');
  const canon = links(body, 'canonical')[0];
  if (!canon) problems.push('нет канонического адреса');
  const alts = links(body, 'alternate').filter((t) => attr(t, 'hreflang'));
  if (isRuOnly(path)) {
    if (alts.length) problems.push('русский раздел не должен предлагать языковые альтернативы');
  } else if (alts.length !== LOCALES.length + 1) {
    problems.push(`языковых альтернатив ${alts.length}, а нужно ${LOCALES.length + 1} (три языка и x-default)`);
  }
  const pageLang = lang(body);
  if (!pageLang) problems.push('нет языка страницы');
  const broken = jsonLd(body).filter((j) => j.__broken);
  if (broken.length) problems.push('разметка JSON-LD не разбирается');
  if (/>(\s*)(undefined|NaN)(\s*)</.test(body)) problems.push('в тексте страницы есть undefined или NaN');
  const content = embedded(body);
  if (content?.__broken) problems.push('встроенное содержимое сайта не разбирается');
  const theme = themeInitProblem(body);
  if (theme) problems.push(theme);
  if (problems.length) return bad(name, problems.join('; '));
  return ok(name, `${pageLang}, ${alts.length ? alts.length + ' альтернатив' : 'только ru'}`);
}

async function checkFiles() {
  console.log('\nСлужебные файлы');
  const robots = await get('/robots.txt');
  check('robots.txt', robots.status === 200, `отдался как ${robots.status}`);
  if (robots.status === 200) {
    check('robots.txt закрывает заготовку', robots.body.includes('/app.html'),
      'без этого /app.html попадёт в выдачу пустой страницей');
    check('robots.txt указывает карту сайта', /sitemap/i.test(robots.body), 'нет строки Sitemap');
  }
  const llms = await get('/llms.txt');
  check('llms.txt', llms.status === 200, `отдался как ${llms.status}`);

  if (BASE) {
    const og = await fetch(BASE + '/og.png');
    check('og.png', og.status === 200, `отдался как ${og.status}`);
  } else {
    const file = join(DIST, 'og.png');
    const size = existsSync(file) ? statSync(file).size : 0;
    check('og.png', size > 10000, size ? `всего ${size} байт` : 'файла нет');
  }

  // Скрипт темы: файл есть и это он, а не заготовка /app.html по переписыванию.
  const themeJs = BASE
    ? await fromWeb('/theme-init.js')
    : (existsSync(join(DIST, 'theme-init.js'))
      ? { status: 200, body: readFileSync(join(DIST, 'theme-init.js'), 'utf8') }
      : { status: 404, body: '' });
  check('theme-init.js', themeJs.status === 200 && themeJs.body.includes('tk_theme') && !/<html/i.test(themeJs.body),
    themeJs.status === 200 ? 'отдаётся не скрипт темы' : `отдался как ${themeJs.status}`);
  const shell = await get('/admin');
  if (shell.status === 200) {
    const why = themeInitProblem(shell.body);
    check('панель /admin: скрипт темы в <head>', !why, why);
  }

  const admin = shell;
  check('/admin открывается', admin.status === 200, `отдался как ${admin.status}`);
  const unknown = await get('/такой-страницы-нет');
  check('неизвестный адрес не 404 от Vercel', unknown.status === 200,
    'приложение само показывает «страница не найдена», значит адрес должен доходить до него');
}

/**
 * «О компании» и «Статьи экспертов»: страницы есть, разметка та, что
 * обещана, и в ней нет того, чего нет на странице.
 */
async function checkAboutAndArticles(paths) {
  console.log('\nО компании и статьи');
  const types = (html) => jsonLd(html).map((j) => j['@type']);

  for (const path of ['/o-kompanii', '/kz/o-kompanii', '/en/o-kompanii']) {
    const { status, body } = await get(path);
    if (status !== 200) { bad(path, `отдался как ${status}`); continue; }
    const about = jsonLd(body).find((j) => j['@type'] === 'AboutPage');
    check(`${path}: разметка AboutPage`, Boolean(about?.mainEntity?.['@id']), 'нет AboutPage с организацией');
    // Реквизитов пока нет — в разметке их быть не должно (заполнятся из настроек).
    check(`${path}: без выдуманных реквизитов`, !/"taxID"|"aggregateRating"/.test(body),
      'в разметке реквизиты или рейтинг, которых нет на странице');
  }

  // Статьи могут быть все в черновиках (draft: true — ждут вычитки автором): тогда
  // список пуст, ItemList и статьи в карте сайта не ждём.
  const articles = paths.filter((p) => /^\/stati\/.+/.test(p));
  // Счётчик просмотров (миграция 065) рисуется только в браузере, когда ответила база. В собранном
  // html его быть не должно: сборка без сети показала бы выдуманное или устаревшее число.
  const VIEWS_IN_HTML = /data-article-views|\d[\d  ]*(?:&nbsp;|\s)(?:просмотр(?:а|ов)?|қаралым|views?)(?!\p{L})/iu;
  for (const path of ['/stati', '/kz/stati', '/en/stati']) {
    const { status, body } = await get(path);
    if (status !== 200) { bad(path, `отдался как ${status}`); continue; }
    if (articles.length) check(`${path}: список статей в разметке`, types(body).includes('ItemList'), 'нет ItemList');
    check(`${path}: блок «Станьте автором»`, /href="(\/kz|\/en)?\/contact"/.test(body), 'нет ссылки на контакт');
    check(`${path}: без числа просмотров в собранном html`, !VIEWS_IN_HTML.test(body),
      'число просмотров попало в пререндер — оно должно приходить из базы уже в браузере');
  }

  if (!articles.length) console.log('  —     статей пока нет (все в черновиках) — проверки статей пропущены');
  for (const path of articles) {
    const { body } = await get(path);
    const art = jsonLd(body).find((j) => j['@type'] === 'Article');
    const problems = [];
    if (!art) problems.push('нет разметки Article');
    else {
      if (!art.author?.name) problems.push('у статьи нет автора');
      if (!art.datePublished) problems.push('нет даты публикации');
      if (!art.headline) problems.push('нет заголовка');
    }
    if (!types(body).includes('BreadcrumbList')) problems.push('нет хлебных крошек');
    if (!body.includes('href="/proverka"')) problems.push('нет ссылки на /proverka');
    if (VIEWS_IN_HTML.test(body)) problems.push('число просмотров попало в пререндер');
    if (problems.length) bad(path, problems.join('; '));
    else ok(path, `Article, автор ${art.author.name}`);
  }

  const { body: home } = await get('/');
  check('подвал ведёт на обе страницы', home.includes('href="/o-kompanii"') && home.includes('href="/stati"'),
    'в подвале нет ссылки на /o-kompanii или /stati');
  const llms = await get('/llms.txt');
  check('llms.txt знает о статьях', llms.body.includes('/stati') && llms.body.includes('/o-kompanii'),
    'в llms.txt нет /stati или /o-kompanii');
}

/**
 * Страницы расширений 1С: все двенадцать собраны заранее, у каждой свой
 * заголовок и один H1, разметка SoftwareApplication + FAQPage + хлебные
 * крошки без рейтингов, ссылка на экспресс-проверку. Каталог ведёт на
 * каждую, карта сайта и llms.txt о них знают.
 */
async function checkProductPages(paths) {
  console.log('\nСтраницы расширений 1С');
  const known = new Set(paths);
  const titles = new Map();
  const h1s = new Map();
  for (const id of PRODUCT_PAGE_IDS) {
    const path = `/products/${id}`;
    const res = await get(path);
    if (res.status !== 200) { bad(path, `отдался как ${res.status}`); continue; }
    if (res.from === 'app.html (переписывание)' || (!BASE && res.from === 'app.html')) {
      bad(path, 'страница не собрана заранее'); continue;
    }
    const body = res.body;
    const problems = [];
    const t = title(body);
    if (!t) problems.push('нет заголовка');
    else if (titles.has(t)) problems.push(`заголовок совпадает с ${titles.get(t)}`);
    else titles.set(t, path);
    const h1 = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    if (h1.length !== 1) problems.push(`H1 на странице: ${h1.length}, а нужен один`);
    else {
      const text = h1[0].replace(/<[^>]+>/g, '').trim();
      if (!text) problems.push('H1 пустой');
      else if (h1s.has(text)) problems.push(`H1 совпадает с ${h1s.get(text)}`);
      else h1s.set(text, path);
    }
    const ld = jsonLd(body);
    const types = ld.map((j) => j['@type']);
    for (const need of ['SoftwareApplication', 'FAQPage', 'BreadcrumbList']) {
      if (!types.includes(need)) problems.push(`нет разметки ${need}`);
    }
    const app = ld.find((j) => j['@type'] === 'SoftwareApplication');
    if (app && !(app.offers || []).length) problems.push('в SoftwareApplication нет цены');
    // Только JSON-LD: во встроенных данных страницы есть коллекция CMS «review» (страница /reviews) — это не разметка.
    if (/"aggregateRating"|"review"|"ratingValue"/.test(JSON.stringify(ld))) problems.push('в разметке рейтинг или отзывы');
    const faq = ld.find((j) => j['@type'] === 'FAQPage');
    if (faq && (faq.mainEntity || []).length < 3) problems.push('в FAQ меньше трёх вопросов');
    if (!body.includes('href="/proverka"')) problems.push('нет ссылки на /proverka');
    if (!body.includes('href="/contact"')) problems.push('нет ссылки на /contact');
    const canon = links(body, 'canonical')[0];
    if (!canon || !attr(canon, 'href')?.endsWith(path)) problems.push('канонический адрес не на эту страницу');
    if (lang(body) !== 'ru') problems.push(`язык страницы ${lang(body)}, а нужен ru`);
    if (!known.has(path)) problems.push('нет в карте сайта');
    if (problems.length) bad(path, problems.join('; '));
    else ok(path, t);
  }

  // Русских страниц продуктов на других языках нет: /kz/products/<id> не собирается.
  const kz = await get(`/kz/products/${PRODUCT_PAGE_IDS[0]}`);
  check('/kz/products/<id> не собирается',
    kz.status !== 200 || /app\.html/.test(kz.from || '') || !kz.body.includes('data-prerendered'),
    'нашлась собранная казахская страница продукта — текстов на казахском нет');

  const all = paths.filter((p) => /^\/products\/.+/.test(p));
  check('в карте сайта ровно 12 страниц продуктов', all.length === PRODUCT_PAGE_IDS.length,
    `в карте ${all.length}: ${all.join(', ')}`);

  for (const path of ['/products', '/kz/products', '/en/products']) {
    const { body } = await get(path);
    const missing = PRODUCT_PAGE_IDS.filter((id) => !body.includes(`href="/products/${id}"`));
    check(`${path}: карточки ведут на страницы продуктов`, missing.length === 0,
      `нет ссылок на: ${missing.join(', ')}`);
  }

  const llms = await get('/llms.txt');
  const notInLlms = PRODUCT_PAGE_IDS.filter((id) => !llms.body.includes(`/products/${id})`));
  check('llms.txt знает о страницах продуктов', notInLlms.length === 0, `нет: ${notInLlms.join(', ')}`);
}

async function checkInternalLinks(paths) {
  console.log('\nВнутренние ссылки');
  const known = new Set(paths);
  const dead = new Set();
  const offline = new Set();
  const answersBuilt = paths.some((p) => /^\/1c\/.+/.test(p));
  let checked = 0;
  for (const path of paths.slice(0, 60)) {
    const { status, body } = await get(path);
    if (status !== 200) continue;
    const hrefs = [...body.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1].replace(/\/$/, '') || '/');
    for (const href of new Set(hrefs)) {
      if (href.startsWith('/admin') || href.startsWith('/assets') || /\.[a-z0-9]+$/i.test(href)) continue;
      checked += 1;
      if (known.has(href)) continue;
      const res = await get(href);
      const prerendered = res.status === 200 && res.from !== 'app.html (переписывание)' && res.from !== 'app.html';
      // Разборы /1c/<slug> собираются из базы. Локальная сборка без базы их не видит — тогда ссылку
      // на разбор из каталога answerProducts.js считаем живой (проверка по живому сайту — --url).
      if (!prerendered && !BASE && !answersBuilt && KNOWN_ANSWERS.has(href)) { offline.add(href); continue; }
      if (!prerendered) dead.add(`${href} (со страницы ${path})`);
    }
  }
  check('ссылки ведут на собранные страницы', dead.size === 0,
    [...dead].slice(0, 8).join('; '));
  ok('проверено ссылок', String(checked));
  if (offline.size) {
    ok('разборы /1c из каталога (сборка без базы, проверятся по живому сайту)', [...offline].join(', '));
  }
}

/* ── Запуск ─────────────────────────────────────────────────────────────── */

console.log(BASE ? `Проверяю живой сайт: ${BASE}` : `Проверяю сборку: ${DIST}`);
if (!BASE && !existsSync(DIST)) {
  console.log(`\nСБОЙ  папки ${DIST} нет. Сначала npm run build.`);
  process.exit(1);
}

const paths = await checkSitemap();
console.log('\nСтраницы');
for (const path of paths) await checkPage(path);
await checkFiles();
await checkAboutAndArticles(paths);
await checkProductPages(paths);
await checkInternalLinks(paths);

console.log(`\nИтог: прошло ${passed}, не прошло ${failed}.`);
if (failed) {
  console.log('Не прошедшее — это то, что увидит поисковик или человек без JavaScript.');
  process.exit(1);
}
