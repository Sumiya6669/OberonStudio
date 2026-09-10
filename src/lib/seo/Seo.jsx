/**
 * Мета-теги страницы — одни и те же на сервере и в браузере.
 *
 * Без внешней библиотеки, потому что задача маленькая и понятная: собрать
 * теги во время рендера. На сервере они складываются в объект, который потом
 * вставляется в <head> готовой страницы; в браузере — пишутся прямо в документ
 * при каждой смене маршрута.
 *
 * Почему это вообще нужно. Сейчас у всех девяти страниц сайта ОДИН заголовок
 * из index.html. Для поиска это девять страниц, которые конкурируют друг с
 * другом и не отвечают ни на один запрос; для блока ответа брать нечего.
 *
 * Правило чистки: в браузере переписываются только теги с пометкой data-seo.
 * Всё, что стоит в index.html руками, остаётся нетронутым — иначе смена
 * маршрута снесла бы, например, иконку сайта.
 */
import React from 'react';

const SeoSink = React.createContext(null);

/** Обёртка серверного рендера: сюда складываются теги во время прохода. */
export function SeoCollector({ value, children }) {
  return <SeoSink.Provider value={value}>{children}</SeoSink.Provider>;
}

export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Один и тот же список тегов строится из одних и тех же данных. */
function buildTags(seo) {
  const tags = [];
  const meta = (attr, key, content) => {
    if (content) tags.push({ tag: 'meta', attrs: { [attr]: key, content } });
  };

  meta('name', 'description', seo.description);
  if (seo.keywords) meta('name', 'keywords', seo.keywords);
  if (seo.noindex) meta('name', 'robots', 'noindex, nofollow');

  meta('property', 'og:title', seo.title);
  meta('property', 'og:description', seo.description);
  meta('property', 'og:type', seo.type || 'website');
  meta('property', 'og:url', seo.canonical);
  meta('property', 'og:site_name', seo.siteName);
  meta('property', 'og:locale', seo.ogLocale);
  if (seo.image) {
    meta('property', 'og:image', seo.image);
    // Размер обязателен: без него мессенджер часто рисует не карточку с
    // широкой картинкой, а маленькую иконку сбоку.
    if (seo.imageWidth) meta('property', 'og:image:width', String(seo.imageWidth));
    if (seo.imageHeight) meta('property', 'og:image:height', String(seo.imageHeight));
    meta('property', 'og:image:alt', seo.title);
  }

  meta('name', 'twitter:card', seo.image ? 'summary_large_image' : 'summary');
  meta('name', 'twitter:title', seo.title);
  meta('name', 'twitter:description', seo.description);
  if (seo.image) meta('name', 'twitter:image', seo.image);

  // Подтверждение прав на сайт для Search Console и Вебмастера. Коды
  // задаются в панели: просить программиста ради строчки в head — верный
  // способ отложить регистрацию в поиске на месяц.
  for (const item of seo.verification || []) {
    if (item?.name && item?.content) meta('name', item.name, item.content);
  }

  if (seo.canonical) {
    tags.push({ tag: 'link', attrs: { rel: 'canonical', href: seo.canonical } });
  }
  for (const alt of seo.alternates || []) {
    tags.push({
      tag: 'link',
      attrs: { rel: 'alternate', hreflang: alt.hreflang, href: alt.href },
    });
  }
  return tags;
}

/** Разметка <head> для серверного рендера. */
export function renderHead(seo) {
  const parts = [];
  if (seo.title) parts.push(`<title>${escapeHtml(seo.title)}</title>`);

  for (const { tag, attrs } of buildTags(seo)) {
    const attrText = Object.entries(attrs)
      .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
      .join(' ');
    parts.push(`<${tag} ${attrText} data-seo="1" />`);
  }

  for (const block of seo.jsonLd || []) {
    // Закрывающий тег внутри JSON закрыл бы сам script — единственная
    // подстановка, которая здесь обязательна.
    const json = JSON.stringify(block).replace(/<\//g, '<\\/');
    parts.push(
      `<script type="application/ld+json" data-seo="1">${json}</script>`,
    );
  }

  return parts.join('\n    ');
}

function applyToDocument(seo) {
  if (seo.title) document.title = seo.title;

  for (const node of document.head.querySelectorAll('[data-seo]')) {
    node.remove();
  }

  for (const { tag, attrs } of buildTags(seo)) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    node.setAttribute('data-seo', '1');
    document.head.appendChild(node);
  }

  for (const block of seo.jsonLd || []) {
    const node = document.createElement('script');
    node.type = 'application/ld+json';
    node.setAttribute('data-seo', '1');
    node.textContent = JSON.stringify(block);
    document.head.appendChild(node);
  }

  if (seo.lang) document.documentElement.setAttribute('lang', seo.lang);
}

/**
 * Ставит мета-теги страницы. Ничего не рисует.
 *
 * На сервере пишет в собиратель во время рендера — проход один и
 * синхронный, поэтому это безопасно. В браузере пишет в документ.
 */
export function Seo(seo) {
  const sink = React.useContext(SeoSink);

  // Хук вызывается всегда, в том числе на сервере: иначе порядок хуков
  // зависел бы от окружения. На сервере эффекты просто не выполняются.
  useIsomorphicLayoutEffect(() => {
    if (!sink) applyToDocument(seo);
    // Зависимость по содержимому: объект пересоздаётся на каждый рендер,
    // а меняется редко.
  }, [JSON.stringify(seo)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (sink) Object.assign(sink, seo);
  return null;
}
