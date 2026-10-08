/**
 * Точка входа для сборки страниц.
 *
 * Тот же самый AppShell, что работает в браузере, только с неподвижным
 * маршрутизатором. Это принципиально: если бы разметку страниц собирал
 * отдельный «упрощённый» рендер, она бы рано или поздно разошлась с тем,
 * что видит человек, — и разошлась бы незаметно.
 *
 * Язык отдельным параметром не передаётся: он выводится из адреса
 * (`/kz/faq` → казахский) ровно так же, как в браузере.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { AppShell } from '@/App';
import { SeoCollector, renderHead } from '@/lib/seo/Seo';

// Статьи экспертов лежат в файлах репозитория, а не в CMS: сборке страниц
// нужен их список, и берётся он из той же сборки, что рисует страницы.
export { ARTICLES } from '@/lib/content/articles';

export function render(url, { content = null } = {}) {
  // Сюда компонент Seo складывает теги во время прохода рендера.
  const seo = {};

  const html = renderToString(
    <SeoCollector value={seo}>
      <StaticRouter location={url}>
        <AppShell initialContent={content} />
      </StaticRouter>
    </SeoCollector>,
  );

  return { html, head: renderHead(seo), seo };
}
