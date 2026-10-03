/**
 * Fallback-контент для портфолио и отзывов.
 *
 * Тексты проектов берутся из i18n (`t.works.projects`); отзывы — только из базы (cms.item, коллекция review),
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
