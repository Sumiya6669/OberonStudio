/**
 * Контент сайта, который раньше хранился в Supabase.
 *
 * Сайт полностью статический: базы данных нет, всё редактируется здесь
 * и попадает на прод обычным коммитом.
 *
 * Telegram и WhatsApp — боевые. Email пока заглушка, замените на рабочий.
 */

export const SITE_SETTINGS = {
  telegram: '@DeveloperAI0',
  telegram_url: 'https://t.me/DeveloperAI0',
  whatsapp: '+7 776 550 96 86',
  whatsapp_url: 'https://wa.me/77765509686',
  email: 'hello@oberon.studio',
};

/**
 * Каталог готовых решений.
 * price / subscription = null → в карточке выводится «по запросу».
 * Если захотите показать цены — поставьте число в тенге, например price: 450000.
 */
export const PRODUCTS = [
  {
    id: 'oberon-crm',
    name: 'Oberon CRM',
    tagline: 'CRM с AI-воронкой под ваш процесс',
    description: 'Кастомная CRM вместо коробочных шаблонов: воронка продаж, задачи менеджеров, история клиента, автоматические follow-up и отчётность. Интегрируется с мессенджерами и 1С.',
    icon: '📊',
    color: '#4d7fff',
    categories: ['CRM'],
    price: null,
    subscription: null,
    features: ['Настройка воронки под процесс', 'Задачи и напоминания', 'KPI менеджеров', 'Интеграция с 1С и мессенджерами'],
    popular: true,
  },
  {
    id: 'ai-sales-agent',
    name: 'AI-агент продаж',
    tagline: 'Обрабатывает входящие круглосуточно',
    description: 'Автономный агент в Telegram и WhatsApp: отвечает на вопросы, квалифицирует лид, снимает потребность и передаёт готовую заявку в CRM. Ни одно обращение не теряется.',
    icon: '🤖',
    color: '#10d4a8',
    categories: ['AI'],
    price: null,
    subscription: null,
    features: ['Telegram и WhatsApp', 'Квалификация лида', 'Передача в CRM', 'Обучение на ваших материалах'],
    popular: true,
  },
  {
    id: 'ai-support',
    name: 'AI-поддержка',
    tagline: 'Первая линия без оператора',
    description: 'Агент отвечает на типовые обращения клиентов, опираясь на вашу базу знаний, и эскалирует сложные случаи живому специалисту с полным контекстом переписки.',
    icon: '💬',
    color: '#a855f7',
    categories: ['AI'],
    price: null,
    subscription: null,
    features: ['База знаний компании', 'Эскалация оператору', 'История обращений', 'Аналитика вопросов'],
    popular: false,
  },
  {
    id: 'horeca-suite',
    name: 'HoReCa Suite',
    tagline: 'Заказы, кухня и аналитика ресторана',
    description: 'Приём заказов через Telegram-бот, передача на кухню, интеграция с iiko, аналитика загрузки по часам и позициям меню.',
    icon: '🍽️',
    color: '#f0a020',
    categories: ['HoReCa'],
    price: null,
    subscription: null,
    features: ['Telegram-бот заказов', 'Интеграция с iiko', 'Аналитика загрузки', 'Уведомления кухне'],
    popular: false,
  },
  {
    id: 'booking-system',
    name: 'Онлайн-запись',
    tagline: 'Для клиник, салонов и студий',
    description: 'Запись клиентов онлайн, напоминания в WhatsApp, история визитов, расписание специалистов и загрузка по дням. Подходит медцентрам, косметологии, фитнесу.',
    icon: '📅',
    color: '#f472b6',
    categories: ['Medical', 'Beauty'],
    price: null,
    subscription: null,
    features: ['Запись 24/7', 'Напоминания в WhatsApp', 'История визитов', 'Расписание специалистов'],
    popular: true,
  },
  {
    id: '1c-integration',
    name: '1С-интеграции',
    tagline: 'Синхронизация с маркетплейсами и кассами',
    description: 'Двусторонний обмен между 1С и внешними системами: Kaspi.kz, Wildberries, OZON, платёжные сервисы, склад. Остатки, цены и заказы в реальном времени.',
    icon: '🔗',
    color: '#06b6d4',
    categories: ['Integration'],
    price: null,
    subscription: null,
    features: ['Kaspi.kz, WB, OZON', 'Обмен остатками и ценами', 'Kaspi QR и Halyk', 'Сверка и отчётность'],
    popular: false,
  },
  {
    id: 'analytics-dashboard',
    name: 'Бизнес-дашборд',
    tagline: 'Все метрики в одном экране',
    description: 'Сводная аналитика продаж, прибыли и остатков: данные в реальном времени, сегментация клиентов, прогноз выручки и экспорт отчётов в Excel.',
    icon: '📈',
    color: '#4d7fff',
    categories: ['Analytics'],
    price: null,
    subscription: null,
    features: ['Метрики в реальном времени', 'Прогноз выручки', 'Сегментация клиентов', 'Экспорт в Excel'],
    popular: false,
  },
  {
    id: 'document-ai',
    name: 'AI-обработка документов',
    tagline: 'Счета и договоры без ручного ввода',
    description: 'Извлечение данных из PDF, счетов и накладных с автоматическим занесением в 1С и CRM. Распознавание сканов, проверка реквизитов, контроль дублей.',
    icon: '📄',
    color: '#10d4a8',
    categories: ['Automation'],
    price: null,
    subscription: null,
    features: ['Распознавание сканов', 'Занесение в 1С и CRM', 'Проверка реквизитов', 'Контроль дублей'],
    popular: false,
  },
];
