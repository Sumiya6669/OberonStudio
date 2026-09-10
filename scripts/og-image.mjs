/**
 * Картинка превью ссылки — public/og.png, 1200×630.
 *
 * Зачем отдельным скриптом, а не в сборке: рисует её настоящий браузер
 * (тот же Chromium, что и в проверках), а на сборке в Vercel браузера нет.
 * Поэтому картинка лежит в репозитории готовым файлом, а скрипт нужен,
 * только когда её надо перерисовать:
 *
 *     node scripts/og-image.mjs
 *
 * Почему браузером, а не библиотекой: нужен Inter и кириллица, а рисовалки
 * SVG в контейнере подставляют первый попавшийся шрифт, и вместо
 * фирменного вида получается «что-то с засечками».
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'og.png');
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

const HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #080808; color: #f7f7f7;
    font-family: Inter, system-ui, sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 80px;
    position: relative;
  }
  /* Свечение того же синего, что и на сайте: карточка должна опознаваться
     как та же студия, а не как чужая заготовка. */
  .glow {
    position: absolute; width: 900px; height: 900px; border-radius: 50%;
    background: radial-gradient(circle, rgba(77,127,255,.28) 0%, rgba(77,127,255,0) 62%);
    right: -240px; top: -320px;
  }
  .glow2 {
    position: absolute; width: 700px; height: 700px; border-radius: 50%;
    background: radial-gradient(circle, rgba(227,178,60,.10) 0%, rgba(227,178,60,0) 62%);
    left: -260px; bottom: -300px;
  }
  .row { display: flex; align-items: center; gap: 20px; position: relative; }
  .mark {
    width: 76px; height: 76px; border-radius: 20px; background: #4d7fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 900; font-size: 32px; letter-spacing: -1px; color: #fff;
    box-shadow: 0 12px 40px rgba(77,127,255,.42);
  }
  .brand { font-size: 34px; font-weight: 800; letter-spacing: -.6px; }
  .brand small { display: block; font-size: 17px; font-weight: 500;
    letter-spacing: 2.4px; text-transform: uppercase; color: rgba(247,247,247,.42); margin-top: 4px; }
  h1 { position: relative; font-size: 50px; line-height: 1.18; font-weight: 800;
       letter-spacing: -1.3px; }
  h1 span { display: block; white-space: nowrap; }
  h1 em { font-style: normal; color: #4d7fff; }
  .tags { position: relative; display: flex; gap: 12px; margin-top: 34px; }
  .tag { border: 1px solid rgba(247,247,247,.14); border-radius: 999px;
         padding: 9px 18px; font-size: 19px; color: rgba(247,247,247,.78); }
  .foot { position: relative; display: flex; justify-content: space-between;
          align-items: flex-end; font-size: 22px; color: rgba(247,247,247,.5); }
  .foot b { color: #f7f7f7; font-weight: 600; }
</style></head>
<body>
  <div class="glow"></div><div class="glow2"></div>

  <div class="row">
    <div class="mark">OS</div>
    <div class="brand">Oberon Studio<small>AI · CRM · 1C</small></div>
  </div>

  <div>
    <h1>
      <span>Разработка и сопровождение <em>1С</em></span>
      <span>AI-агенты и автоматизация бизнеса</span>
    </h1>
    <div class="tags">
      <div class="tag">Доработки и обмены</div>
      <div class="tag">CRM и интеграции</div>
      <div class="tag">AI-агенты</div>
    </div>
  </div>

  <div class="foot">
    <div>Казахстан · ответ в течение часа</div>
    <div><b>oberon-studio.vercel.app</b></div>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(HTML, { waitUntil: 'networkidle' });
// Шрифт может доехать позже разметки; без этой строки первая сборка иногда
// снимает картинку системным шрифтом.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

const buffer = await page.screenshot({ type: 'png' });
await writeFile(OUT, buffer);
await browser.close();

process.stdout.write(`og.png готов: ${Math.round(buffer.length / 1024)} КБ → ${path.relative(ROOT, OUT)}\n`);
