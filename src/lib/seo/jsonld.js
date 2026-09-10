/**
 * Разметка JSON-LD: то, чем поисковики и модели опознают, кто вы и что делаете.
 *
 * Единственное правило, которого здесь придерживаемся жёстко: **не выдумывать**.
 * В разметку попадает только то, что реально есть — в настройках сайта или в
 * опубликованном содержимом. Ни адреса, ни БИН, ни рейтингов «4.9 из 87
 * отзывов», если этих чисел нет в базе. Придуманный факт в JSON-LD — это
 * не оптимизация, а заявление, за которое отвечает владелец сайта.
 *
 * Поэтому почти каждая функция ниже начинается с проверки «а есть ли данные»
 * и возвращает null, если их нет. Пустой блок лучше красивого вранья.
 */
import { SITE_NAME, SITE_URL } from './pages';

const clean = (obj) => {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
};

/** Кто мы. Ссылки на мессенджеры — из настроек сайта, а не из головы. */
export function organizationLd(settings = {}) {
  const sameAs = [settings.telegram_url, settings.whatsapp_url].filter(Boolean);

  const contactPoint = [];
  if (settings.email || settings.phone) {
    contactPoint.push(clean({
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: settings.email || undefined,
      telephone: settings.phone || undefined,
      availableLanguage: ['ru', 'kk', 'en'],
    }));
  }

  const address = settings.address
    ? clean({
        '@type': 'PostalAddress',
        addressCountry: 'KZ',
        streetAddress: settings.address,
      })
    : null;

  return clean({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: settings.company_legal || SITE_NAME,
    alternateName: settings.company_legal ? SITE_NAME : undefined,
    url: SITE_URL,
    email: settings.email || undefined,
    telephone: settings.phone || undefined,
    taxID: settings.bin || undefined,
    address,
    contactPoint: contactPoint.length ? contactPoint : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  });
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: ['ru', 'kk', 'en'],
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

/** Хлебные крошки. Только для внутренних страниц: на главной их нет. */
export function breadcrumbLd(path, title) {
  if (!path || path === '/') return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: title, item: `${SITE_URL}${path}` },
    ],
  };
}

/** Услуги. Цена попадает в разметку, только если она реально задана. */
export function servicesLd(services) {
  if (!services?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Услуги',
    itemListElement: services.slice(0, 20).map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: clean({
        '@type': 'Service',
        name: service.title,
        description: service.desc,
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: 'KZ',
        offers: service.priceFrom
          ? {
              '@type': 'Offer',
              price: String(service.priceFrom),
              priceCurrency: 'KZT',
              url: `${SITE_URL}/services`,
            }
          : undefined,
      }),
    })),
  };
}

/** Вопросы и ответы. Это самый цитируемый блок в ответах поисковиков. */
export function faqLd(items) {
  const clean_items = (items || []).filter((item) => item?.q && item?.a);
  if (!clean_items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: clean_items.slice(0, 30).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** Проекты. Без стоимости и без имён клиентов — их на сайте намеренно нет. */
export function worksLd(projects) {
  if (!projects?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Реализованные проекты',
    itemListElement: projects.slice(0, 30).map((project, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: clean({
        '@type': 'CreativeWork',
        name: project.title,
        description: project.description,
        about: project.industry,
        keywords: project.technologies?.length
          ? project.technologies.join(', ')
          : undefined,
        image: project.image_url || undefined,
      }),
    })),
  };
}

/**
 * Отзывы БЕЗ агрегированного рейтинга.
 *
 * Соблазн приписать aggregateRating велик — звёздочки в выдаче заметны. Но
 * это утверждение о том, что отзывы собраны и посчитаны по правилам, и
 * поисковики за выдуманные звёздочки наказывают. Отдаём только тексты.
 */
export function reviewsLd(testimonials) {
  const items = (testimonials || []).filter((review) => review?.text);
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Отзывы',
    itemListElement: items.slice(0, 20).map((review, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: clean({
        '@type': 'Review',
        reviewBody: review.text,
        author: review.name
          ? { '@type': 'Person', name: review.name }
          : undefined,
        itemReviewed: { '@id': `${SITE_URL}/#organization` },
      }),
    })),
  };
}

export function productsLd(products) {
  if (!products?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Готовые решения',
    itemListElement: products.slice(0, 20).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: clean({
        '@type': 'Product',
        name: product.name,
        description: product.description || product.tagline,
        brand: { '@id': `${SITE_URL}/#organization` },
        offers: product.price
          ? {
              '@type': 'Offer',
              price: String(product.price),
              priceCurrency: 'KZT',
              availability: 'https://schema.org/InStock',
            }
          : undefined,
      }),
    })),
  };
}
