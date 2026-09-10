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
 *   node scripts/check-site.mjs --url https://oberon-studio.vercel.app
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
const RU_ONLY = [/^\/1c(\/|$)/, /^\/uslugi(\/|$)/];

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

  const admin = await get('/admin');
  check('/admin открывается', admin.status === 200, `отдался как ${admin.status}`);
  const unknown = await get('/такой-страницы-нет');
  check('неизвестный адрес не 404 от Vercel', unknown.status === 200,
    'приложение само показывает «страница не найдена», значит адрес должен доходить до него');
}

async function checkInternalLinks(paths) {
  console.log('\nВнутренние ссылки');
  const known = new Set(paths);
  const dead = new Set();
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
      if (!prerendered) dead.add(`${href} (со страницы ${path})`);
    }
  }
  check('ссылки ведут на собранные страницы', dead.size === 0,
    [...dead].slice(0, 8).join('; '));
  ok('проверено ссылок', String(checked));
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
await checkInternalLinks(paths);

console.log(`\nИтог: прошло ${passed}, не прошло ${failed}.`);
if (failed) {
  console.log('Не прошедшее — это то, что увидит поисковик или человек без JavaScript.');
  process.exit(1);
}
