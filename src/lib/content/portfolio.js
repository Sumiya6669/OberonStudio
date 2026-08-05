/**
 * Fallback-контент для портфолио и отзывов.
 *
 * Тексты проектов и отзывов берутся из i18n (`t.works.projects`, `t.reviews.items`),
 * а здесь лежат метаданные, одинаковые для всех языков (отрасль, стек) и
 * локализованные подписи (результат, роль автора отзыва).
 *
 * Эти данные показываются только тогда, когда в Supabase ещё нет опубликованных
 * записей. Как только кейс или отзыв добавлен через админ-панель — приоритет у базы.
 *
 * ВАЖНО: стоимость проектов здесь намеренно не хранится и не выводится.
 */

export const PROJECT_META = [
  {
    slug: 'yuvema-ecosystem',
    industry: 'AI Platform',
    tech: ['React', 'FastAPI', 'OpenAI', 'PostgreSQL', 'Redis'],
    result: {
      ru: 'Автономные агенты, аналитика и документооборот в одном контуре',
      kz: 'Автономды агенттер, аналитика және құжат айналымы бір контурда',
      en: 'Autonomous agents, analytics and document flow in one system',
    },
  },
  {
    slug: 'restaurant-ai-iiko',
    industry: 'HoReCa',
    tech: ['Telegram Bot API', 'iiko API', 'Node.js', 'PostgreSQL'],
    result: {
      ru: 'Заказы из Telegram попадают на кухню без участия официанта',
      kz: 'Telegram-дағы тапсырыстар даяшысыз ас үйге түседі',
      en: 'Telegram orders reach the kitchen without a waiter in the loop',
    },
  },
  {
    slug: 'hotel-smart-booking',
    industry: 'Hospitality',
    tech: ['Python', 'Booking.com API', '2GIS API', 'WhatsApp API'],
    result: {
      ru: 'Бронирование и подтверждения работают автоматически, 24/7',
      kz: 'Брондау мен растау тәулік бойы автоматты жұмыс істейді',
      en: 'Booking and confirmations run automatically, 24/7',
    },
  },
  {
    slug: 'sport-crm',
    industry: 'Fitness',
    tech: ['React', 'Supabase', 'Kaspi Pay', 'WhatsApp API'],
    result: {
      ru: 'Абонементы, оплаты и напоминания — в одной системе вместо тетрадей',
      kz: 'Абонементтер, төлемдер және еске салулар — бір жүйеде',
      en: 'Memberships, payments and reminders in one system',
    },
  },
  {
    slug: 'beauty-crm',
    industry: 'Beauty',
    tech: ['React', 'Node.js', 'PostgreSQL', 'WhatsApp API'],
    result: {
      ru: 'История процедур и напоминания клиентам без ручного контроля',
      kz: 'Процедура тарихы мен еске салулар қолмен бақылаусыз',
      en: 'Treatment history and client reminders without manual work',
    },
  },
  {
    slug: 'shop-ai-consultant',
    industry: 'E-commerce',
    tech: ['OpenAI', 'RAG', 'Next.js', 'Vector DB'],
    result: {
      ru: 'Консультации по товарам и оформление заказа прямо в чате',
      kz: 'Тауар бойынша кеңес пен тапсырыс чаттың өзінде',
      en: 'Product guidance and checkout handled inside the chat',
    },
  },
  {
    slug: '1c-marketplaces',
    industry: 'Integration',
    tech: ['1C', 'Kaspi.kz API', 'Wildberries API', 'OZON API'],
    result: {
      ru: 'Остатки, цены и заказы синхронизируются в реальном времени',
      kz: 'Қалдық, баға және тапсырыс нақты уақытта синхрондалады',
      en: 'Stock, prices and orders stay in sync in real time',
    },
  },
  {
    slug: 'sales-ai-analytics',
    industry: 'Analytics',
    tech: ['Python', 'ClickHouse', 'ML', 'Recharts'],
    result: {
      ru: 'Прогноз выручки, сегментация и LTV в одном дашборде',
      kz: 'Түсім болжамы, сегменттеу және LTV бір дашбордта',
      en: 'Revenue forecast, segmentation and LTV in one dashboard',
    },
  },
  {
    slug: 'marketplace-ai',
    industry: 'Marketplace',
    tech: ['Next.js', 'OpenAI', 'Elasticsearch', 'PostgreSQL'],
    result: {
      ru: 'Умный поиск и авто-модерация контента без ручной проверки',
      kz: 'Ақылды іздеу мен контентті авто-модерация',
      en: 'Smart search and automated content moderation',
    },
  },
  {
    slug: 'telegram-ai-operator',
    industry: 'AI Agent',
    tech: ['Telegram Bot API', 'OpenAI', 'LangChain', 'CRM API'],
    result: {
      ru: 'Агент квалифицирует лид и передаёт его в CRM сам',
      kz: 'Агент лидті бағалап, CRM-ге өзі жібереді',
      en: 'The agent qualifies leads and hands them to CRM itself',
    },
  },
  {
    slug: 'whatsapp-ai-manager',
    industry: 'AI Agent',
    tech: ['WhatsApp Business API', 'OpenAI', 'Node.js', '1C'],
    result: {
      ru: 'Прайсы, наличие и оформление заявок — без менеджера',
      kz: 'Прайс, қолжетімділік және өтінім — менеджерсіз',
      en: 'Price lists, stock and order intake without a manager',
    },
  },
  {
    slug: 'b2b-wholesale-crm',
    industry: 'CRM',
    tech: ['React', 'Node.js', 'PostgreSQL', '1C'],
    result: {
      ru: 'Воронка, KPI менеджеров и счета связаны с 1C',
      kz: 'Воронка, менеджер KPI және шот 1C-пен байланысты',
      en: 'Pipeline, manager KPIs and invoices wired into 1C',
    },
  },
  {
    slug: 'kaspi-halyk-payments',
    industry: 'Fintech',
    tech: ['Kaspi QR', 'Halyk API', 'Python', '1C'],
    result: {
      ru: 'Авто-чеки и сверка кассы вместо ручной отчётности',
      kz: 'Авто-чек және касса салыстыруы қолмен есеп берудің орнына',
      en: 'Automatic receipts and till reconciliation instead of manual reports',
    },
  },
  {
    slug: 'business-dashboard',
    industry: 'Analytics',
    tech: ['React', 'Recharts', 'Supabase', 'OpenAI'],
    result: {
      ru: 'Все метрики бизнеса в реальном времени и экспорт отчётов',
      kz: 'Бизнестің барлық метрикасы нақты уақытта, есеп экспорты',
      en: 'Every business metric in real time, with report export',
    },
  },
  {
    slug: 'lead-processing-platform',
    industry: 'Automation',
    tech: ['Python', 'OpenAI', 'RabbitMQ', 'PostgreSQL'],
    result: {
      ru: 'Классификация и маршрутизация заявок без оператора',
      kz: 'Өтінімді жіктеу мен бағыттау оператордың қатысуынсыз',
      en: 'Request classification and routing without an operator',
    },
  },
  {
    slug: 'warehouse-accounting',
    industry: 'Logistics',
    tech: ['1C', 'React', 'PostgreSQL', 'REST API'],
    result: {
      ru: 'Автоинвентаризация и уведомления о минимальных остатках',
      kz: 'Авто-түгендеу және ең төмен қалдық туралы хабарлама',
      en: 'Automated stock-taking and low-stock alerts',
    },
  },
  {
    slug: 'support-ai-agent',
    industry: 'Support',
    tech: ['OpenAI', 'RAG', 'LangChain', 'Helpdesk API'],
    result: {
      ru: 'Первая линия поддержки закрывается агентом без оператора',
      kz: 'Бірінші желі қолдауын агент операторсыз жабады',
      en: 'First-line support handled by the agent, not a person',
    },
  },
  {
    slug: 'medical-booking',
    industry: 'Medical',
    tech: ['React', 'Node.js', 'WhatsApp API', 'PostgreSQL'],
    result: {
      ru: 'Запись, напоминания и история приёмов в одном контуре',
      kz: 'Жазылу, еске салу және қабылдау тарихы бір жүйеде',
      en: 'Appointments, reminders and visit history in one place',
    },
  },
  {
    slug: 'document-ai',
    industry: 'Automation',
    tech: ['Python', 'OCR', 'OpenAI', '1C'],
    result: {
      ru: 'Данные из PDF и счетов попадают в 1C и CRM автоматически',
      kz: 'PDF пен шоттағы дерек 1C және CRM-ге автоматты түседі',
      en: 'Data from PDFs and invoices flows into 1C and CRM automatically',
    },
  },
  {
    slug: 'education-platform',
    industry: 'EdTech',
    tech: ['Next.js', 'OpenAI', 'Supabase', 'Stripe'],
    result: {
      ru: 'Персональные учебные пути и автопроверка заданий',
      kz: 'Жеке оқу жолдары және тапсырманы авто-тексеру',
      en: 'Personalised learning paths and automated grading',
    },
  },
];

export const TESTIMONIAL_META = [
  { rating: 5, role: { ru: 'Коммерческий директор', kz: 'Коммерциялық директор', en: 'Commercial Director' }, company: { ru: 'Оптовая торговля · Алматы', kz: 'Көтерме сауда · Алматы', en: 'Wholesale · Almaty' } },
  { rating: 5, role: { ru: 'Управляющий', kz: 'Басқарушы', en: 'General Manager' }, company: { ru: 'Ресторан · Алматы', kz: 'Мейрамхана · Алматы', en: 'Restaurant · Almaty' } },
  { rating: 5, role: { ru: 'CTO', kz: 'CTO', en: 'CTO' }, company: { ru: 'IT-стартап · Астана', kz: 'IT-стартап · Астана', en: 'IT startup · Astana' } },
  { rating: 5, role: { ru: 'Владелец', kz: 'Иесі', en: 'Owner' }, company: { ru: 'Гостиница · Шымкент', kz: 'Қонақ үй · Шымкент', en: 'Hotel · Shymkent' } },
  { rating: 5, role: { ru: 'Финансовый директор', kz: 'Қаржы директоры', en: 'CFO' }, company: { ru: 'Розничная сеть · Алматы', kz: 'Бөлшек сауда желісі · Алматы', en: 'Retail chain · Almaty' } },
  { rating: 5, role: { ru: 'Администратор', kz: 'Әкімші', en: 'Administrator' }, company: { ru: 'Косметология · Астана', kz: 'Косметология · Астана', en: 'Beauty clinic · Astana' } },
  { rating: 5, role: { ru: 'Руководитель отдела продаж', kz: 'Сату бөлімінің жетекшісі', en: 'Head of Sales' }, company: { ru: 'Интернет-магазин · Караганда', kz: 'Интернет-дүкен · Қарағанды', en: 'Online store · Karaganda' } },
  { rating: 5, role: { ru: 'Операционный директор', kz: 'Операциялық директор', en: 'COO' }, company: { ru: 'Логистика · Алматы', kz: 'Логистика · Алматы', en: 'Logistics · Almaty' } },
  { rating: 5, role: { ru: 'Владелец', kz: 'Иесі', en: 'Owner' }, company: { ru: 'Фитнес-клуб · Астана', kz: 'Фитнес-клуб · Астана', en: 'Fitness club · Astana' } },
  { rating: 5, role: { ru: 'Директор', kz: 'Директор', en: 'Director' }, company: { ru: 'B2B-дистрибуция · Алматы', kz: 'B2B-дистрибуция · Алматы', en: 'B2B distribution · Almaty' } },
  { rating: 5, role: { ru: 'Руководитель', kz: 'Жетекші', en: 'Head of Operations' }, company: { ru: 'Учебный центр · Астана', kz: 'Оқу орталығы · Астана', en: 'Training centre · Astana' } },
  { rating: 5, role: { ru: 'Главный бухгалтер', kz: 'Бас бухгалтер', en: 'Chief Accountant' }, company: { ru: 'Производство · Караганда', kz: 'Өндіріс · Қарағанды', en: 'Manufacturing · Karaganda' } },
  { rating: 5, role: { ru: 'Собственник', kz: 'Меншік иесі', en: 'Founder' }, company: { ru: 'Оптовые продажи · Тараз', kz: 'Көтерме сату · Тараз', en: 'Wholesale · Taraz' } },
  { rating: 5, role: { ru: 'Главный врач', kz: 'Бас дәрігер', en: 'Chief Physician' }, company: { ru: 'Медцентр · Алматы', kz: 'Медорталық · Алматы', en: 'Medical centre · Almaty' } },
  { rating: 5, role: { ru: 'Категорийный менеджер', kz: 'Санат менеджері', en: 'Category Manager' }, company: { ru: 'Розница · Астана', kz: 'Бөлшек сауда · Астана', en: 'Retail · Astana' } },
  { rating: 5, role: { ru: 'Руководитель направления', kz: 'Бағыт жетекшісі', en: 'Business Unit Lead' }, company: { ru: 'Финансовые услуги · Алматы', kz: 'Қаржы қызметтері · Алматы', en: 'Financial services · Almaty' } },
  { rating: 5, role: { ru: 'Маркетолог', kz: 'Маркетолог', en: 'Marketing Lead' }, company: { ru: 'Digital-агентство · Алматы', kz: 'Digital-агенттік · Алматы', en: 'Digital agency · Almaty' } },
  { rating: 5, role: { ru: 'Начальник склада', kz: 'Қойма бастығы', en: 'Warehouse Manager' }, company: { ru: 'Дистрибуция · Шымкент', kz: 'Дистрибуция · Шымкент', en: 'Distribution · Shymkent' } },
  { rating: 5, role: { ru: 'Директор', kz: 'Директор', en: 'Director' }, company: { ru: 'Туристическая компания · Алматы', kz: 'Туристік компания · Алматы', en: 'Travel company · Almaty' } },
  { rating: 5, role: { ru: 'Сооснователь', kz: 'Тең құрылтайшы', en: 'Co-founder' }, company: { ru: 'SaaS-стартап · Астана', kz: 'SaaS-стартап · Астана', en: 'SaaS startup · Astana' } },
];

/** Проекты для секции «Работы» — тексты из i18n, метаданные отсюда. Без стоимости. */
export function buildFallbackProjects(t, lang) {
  const items = t?.works?.projects || [];
  return items.map((project, index) => {
    const meta = PROJECT_META[index] || {};
    return {
      id: `fallback-${meta.slug || index}`,
      slug: meta.slug || `case-${index + 1}`,
      title: project.title,
      description: project.desc,
      industry: meta.industry || 'Case',
      technologies: meta.tech || [],
      result: meta.result?.[lang] || meta.result?.ru || '',
      client_name: null,
      image_url: null,
    };
  });
}

/** Отзывы — тексты из i18n, подписи отсюда. */
export function buildFallbackTestimonials(t, lang) {
  const items = t?.reviews?.items || [];
  return items.map((review, index) => {
    const meta = TESTIMONIAL_META[index] || {};
    return {
      id: `fallback-review-${index}`,
      text: review.text,
      name: meta.role?.[lang] || meta.role?.ru || '',
      company: meta.company?.[lang] || meta.company?.ru || '',
      rating: meta.rating || 5,
      image_url: null,
    };
  });
}
