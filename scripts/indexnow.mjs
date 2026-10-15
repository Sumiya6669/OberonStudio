/**
 * IndexNow: сообщить поисковикам (Яндекс, Bing, Seznam, Naver — через общий api.indexnow.org),
 * что страницы сайта новые или изменились. Без этого Яндекс находит новую статью сам — за дни
 * или недели; с IndexNow обычно за часы. Google IndexNow не поддерживает: ему — карта сайта
 * в Search Console.
 *
 *   node scripts/indexnow.mjs                 все адреса из живой карты сайта
 *   node scripts/indexnow.mjs /stati          только адреса, начинающиеся с /stati
 *   node scripts/indexnow.mjs --dry           показать, что ушло бы, ничего не отправляя
 *
 * Запускать ПОСЛЕ выкладки: поисковик сразу придёт за страницами, и они должны быть на сайте.
 * Ключ — файл public/<ключ>.txt (ключ не секрет: поисковик сверяет его по этому файлу на сайте).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_URL = (process.env.VITE_SITE_URL || 'https://tinker-kz.vercel.app').replace(/\/$/, '');
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const prefix = args.find((a) => a.startsWith('/')) || '';

const keyFile = readdirSync(resolve('public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('нет файла ключа public/<32 hex>.txt');
const key = readFileSync(resolve('public', keyFile), 'ascii').trim();
if (`${key}.txt` !== keyFile) throw new Error(`${keyFile}: внутри файла должен быть тот же ключ`);

const live = await fetch(`${SITE_URL}/${keyFile}`);
if (!dry && (!live.ok || (await live.text()).trim() !== key)) {
  throw new Error(`${SITE_URL}/${keyFile} не отдаёт ключ — сначала выложите сайт`);
}

const sitemap = await (await fetch(`${SITE_URL}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].trim())
  .filter((u) => u.startsWith(SITE_URL) && u.slice(SITE_URL.length).startsWith(prefix));
if (!urls.length) throw new Error('в карте сайта нет подходящих адресов');

console.log(`адресов: ${urls.length}${prefix ? ` (начинаются с ${prefix})` : ''}`);
if (dry) {
  urls.forEach((u) => console.log('  ' + u));
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: new URL(SITE_URL).host,
    key,
    keyLocation: `${SITE_URL}/${keyFile}`,
    urlList: urls.slice(0, 10000),
  }),
});
// 200 — принято, 202 — принято, ключ ещё проверяется; 403 — ключ не найден на сайте; 422 — адреса не того сайта.
console.log(`ответ IndexNow: ${res.status} ${res.statusText}`);
if (res.status >= 300) process.exit(1);
