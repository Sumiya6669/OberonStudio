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
  // sameAs — «это та же организация, что и вон там». Карточки в 2ГИС и
  // Google Картах здесь работают сильнее соцсетей: по ним поиск связывает
  // сайт с реальной точкой на карте.
  const sameAs = [
    settings.telegram_url, settings.whatsapp_url,
    settings.maps_2gis_url, settings.maps_google_url,
  ].filter(Boolean);

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
export function breadcrumbLd(path, title, parents = []) {
  if (!path || path === '/') return null;

  // Промежуточные шаги нужны там, где страница лежит в разделе: разбор в
  // «Ответах по 1С», работа в «Работах и ценах». Без них выдача показывает
  // путь «Oberon Studio → Обмен с банком встал», как будто раздела нет, а
  // человеку из поиска полезнее видеть, что рядом есть другие разборы.
  const steps = [
    { name: SITE_NAME, item: `${SITE_URL}/` },
    ...parents.filter((p) => p?.name && p?.path).map((p) => ({
      name: p.name, item: `${SITE_URL}${p.path}`,
    })),
    { name: title, item: `${SITE_URL}${path}` },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, i) => ({
      '@type': 'ListItem', position: i + 1, name: step.name, item: step.item,
    })),
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

/**
 * Разбор одной беды в 1С.
 *
 * Размечается как вопрос с ответом, а не как статья: страница и написана
 * как ответ на запрос человека своими словами. Именно из такой разметки
 * блок ответа в поиске и модель берут текст. В ответ идёт короткое
 * объяснение плюс то, что можно проверить самому, — то есть ровно то, что
 * на странице; разметка, обещающая больше страницы, вредна.
 */
export function answerLd(answer) {
  if (!answer?.question || !answer?.lead) return null;

  const steps = (answer.steps || []).filter(Boolean);
  const text = steps.length
    ? `${answer.lead}\n\nЧто проверить: ${steps.join('; ')}.`
    : answer.lead;

  return {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: answer.question,
      text: answer.title || answer.question,
      answerCount: 1,
      acceptedAnswer: { '@type': 'Answer', text },
    },
  };
}

/** Список разборов — обычный перечень ссылок, без обещаний. */
export function answersListLd(answers) {
  if (!answers?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Частые вопросы по 1С',
    itemListElement: answers.slice(0, 50).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: a.title,
      url: `${SITE_URL}/1c/${a.slug}`,
    })),
  };
}

/**
 * Оффер — конкретная работа с ценой.
 *
 * Цена попадает в разметку только если она задана. Пустая цена означает
 * «по запросу», и размечать её нулём нельзя: в выдаче это прочитается как
 * «бесплатно», а объясняться придётся с живым человеком.
 */
export function offerLd(offer) {
  if (!offer?.title) return null;

  const price = Number(offer.priceFrom) > 0
    ? clean({
        '@type': 'Offer',
        priceCurrency: 'KZT',
        price: Number(offer.priceFrom),
        // от — то есть это минимум, а не точная цена.
        priceSpecification: {
          '@type': 'PriceSpecification',
          minPrice: Number(offer.priceFrom),
          priceCurrency: 'KZT',
        },
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/uslugi/${offer.slug}`,
      })
    : null;

  return clean({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: offer.title,
    description: offer.seoDesc || offer.tagline || offer.lead,
    serviceType: '1С: разработка и сопровождение',
    provider: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
    areaServed: { '@type': 'Country', name: 'Kazakhstan' },
    url: `${SITE_URL}/uslugi/${offer.slug}`,
    offers: price || undefined,
  });
}

/**
 * Кейс. Размечается как Article, а не как Review или CreativeWork с
 * рейтингом: отзыва клиента здесь нет, и притворяться, что он есть,
 * нельзя — это ровно та разметка, за которую поисковик наказывает.
 */
export function caseLd(item) {
  if (!item?.title) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.title,
    description: item.seoDesc || item.tagline || '',
    articleSection: 'Кейсы',
    inLanguage: 'ru',
    url: `${SITE_URL}/keysy/${item.slug}`,
    author: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
  };
}

/** Список кейсов — перечень ссылок, без обещаний и без оценок. */
export function casesListLd(items) {
  if (!items?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Кейсы Oberon Studio',
    itemListElement: items.slice(0, 50).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.title,
      url: `${SITE_URL}/keysy/${c.slug}`,
    })),
  };
}

export function offersListLd(offers) {
  if (!offers?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Работы и цены',
    itemListElement: offers.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: o.title,
      url: `${SITE_URL}/uslugi/${o.slug}`,
    })),
  };
}
