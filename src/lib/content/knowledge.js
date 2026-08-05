/**
 * База знаний консультанта.
 *
 * Ответы строятся по реальному содержимому сайта: продукты, проекты, услуги.
 * Никаких цен — стоимость обсуждается только на консультации.
 *
 * Как добавить тему: допишите объект в TOPICS. Чем больше синонимов
 * в `keywords`, тем точнее консультант поймёт вопрос.
 */

const L = (ru, kz, en) => ({ ru, kz, en });

export const TOPICS = [
  {
    id: 'crm',
    keywords: ['crm', 'црм', 'срм', 'воронк', 'сделк', 'клиентск базу', 'клиентскую базу', 'менеджер', 'отдел продаж', 'amocrm', 'битрикс', 'pipeline', 'sales'],
    link: '/products',
    answer: L(
      'Делаем CRM под ваш процесс, а не подгоняем процесс под коробку. Внутри: воронка с вашими этапами, карточка клиента со всей историей, задачи и напоминания менеджерам, KPI и отчётность. Подключаем WhatsApp и Telegram, чтобы переписка падала в карточку сделки, и связываем с 1С по остаткам и счетам.\n\nЧтобы прикинуть объём, скажите: сколько менеджеров и в чём сейчас ведёте клиентов — таблицы, тетрадь, готовая CRM?',
      'CRM-ді сіздің процесіңізге қарай жасаймыз. Ішінде: өз кезеңдеріңізбен воронка, клиент картасы, менеджерлерге тапсырма мен еске салу, KPI және есептілік. WhatsApp пен Telegram қосылады, 1С-пен байланысады.\n\nКөлемін бағалау үшін айтыңыз: неше менеджер бар және қазір клиенттерді қайда жүргізесіз?',
      'We build CRM around your process instead of forcing your process into a template: your pipeline stages, full client history, tasks and reminders, KPIs and reporting. WhatsApp and Telegram feed conversations into the deal card, and 1C syncs stock and invoices.\n\nTo size it up: how many managers, and where do you keep clients today?',
    ),
  },
  {
    id: 'ai_agent',
    keywords: ['ai', 'ии', 'агент', 'бот', 'чат-бот', 'чатбот', 'gpt', 'нейросет', 'искусственн', 'автоответ', 'agent', 'chatbot'],
    link: '/products',
    answer: L(
      'AI-агент берёт на себя входящие в Telegram и WhatsApp: отвечает на вопросы по вашим материалам, уточняет задачу, снимает потребность и передаёт готовую заявку в CRM. Работает круглосуточно, так что ночные и выходные обращения не теряются. Сложные случаи передаёт живому менеджеру вместе с историей переписки.\n\nГде у вас сейчас теряются обращения — не успеваете отвечать, или отвечаете, но поздно?',
      'AI-агент Telegram мен WhatsApp-тағы өтініштерді өз мойнына алады: сұраққа жауап береді, қажеттілікті анықтап, дайын өтінімді CRM-ге береді. Тәулік бойы жұмыс істейді, күрделі жағдайды менеджерге береді.\n\nҚазір өтініштер қай жерде жоғалады?',
      'An AI agent handles inbound on Telegram and WhatsApp: answers from your materials, clarifies the request, qualifies it and hands a complete lead to CRM. Runs 24/7, so nights and weekends stop leaking. Complex cases escalate to a human with the full thread.\n\nWhere do enquiries slip today — no time to reply, or replies arrive too late?',
    ),
  },
  {
    id: 'support',
    keywords: ['поддержк', 'support', 'обращен', 'тикет', 'первая лини', 'операторы', 'колл-центр', 'call'],
    link: '/products',
    answer: L(
      'Первую линию поддержки закрывает агент: отвечает по вашей базе знаний, а всё нестандартное отдаёт специалисту вместе с контекстом. Обычно так снимается основная масса типовых вопросов, и люди занимаются только сложным.\n\nСколько обращений в день приходит и какие вопросы повторяются чаще всего?',
      'Бірінші желі қолдауын агент жабады: базаңыз бойынша жауап береді, стандартты емесін маманға контекстімен жібереді.\n\nКүніне қанша өтініш келеді және қандай сұрақтар жиі қайталанады?',
      'The agent covers first-line support from your knowledge base and escalates anything unusual with full context, so your team only handles the hard cases.\n\nHow many enquiries a day, and which questions repeat most?',
    ),
  },
  {
    id: 'integration_1c',
    keywords: ['1с', '1c', 'интеграц', 'kaspi', 'каспи', 'wildberries', 'вайлдберриз', 'ozon', 'озон', 'маркетплейс', 'halyk', 'обмен', 'выгрузк', 'синхрон', 'api'],
    link: '/products',
    answer: L(
      'Настраиваем двусторонний обмен между 1С и внешними системами: Kaspi.kz, Wildberries, OZON, платёжные сервисы, склад. Остатки, цены и заказы синхронизируются в реальном времени, чеки формируются автоматически, сверка кассы перестаёт быть ручной работой.\n\nКакая у вас конфигурация 1С и с чем нужно связать в первую очередь?',
      '1С пен сыртқы жүйелер арасында екіжақты алмасу орнатамыз: Kaspi.kz, Wildberries, OZON, төлем сервистері, қойма. Қалдық, баға және тапсырыс нақты уақытта синхрондалады.\n\nСізде 1С қай конфигурацияда және алдымен немен байланыстыру керек?',
      'We set up two-way sync between 1C and outside systems: Kaspi.kz, Wildberries, OZON, payment providers, warehouse. Stock, prices and orders stay current, receipts generate themselves, till reconciliation stops being manual work.\n\nWhich 1C configuration do you run, and what needs connecting first?',
    ),
  },
  {
    id: 'analytics',
    keywords: ['аналитик', 'отчет', 'отчёт', 'дашборд', 'метрик', 'статистик', 'прибыл', 'выручк', 'excel', 'эксель', 'bi', 'report', 'dashboard'],
    link: '/products',
    answer: L(
      'Собираем дашборд, где продажи, прибыль и остатки видны в реальном времени: сегментация клиентов, прогноз выручки, выгрузка в Excel. Данные тянутся из 1С и CRM, так что цифры перестают расходиться между отчётами.\n\nКакие показатели вы сейчас считаете руками и как часто они нужны?',
      'Сату, пайда және қалдық нақты уақытта көрінетін дашборд жинаймыз: клиенттерді сегменттеу, түсім болжамы, Excel-ге шығару. Дерек 1С пен CRM-нен тартылады.\n\nҚазір қандай көрсеткіштерді қолмен санайсыз?',
      'We build a dashboard where sales, profit and stock are visible in real time: customer segmentation, revenue forecast, Excel export. Data comes from 1C and CRM, so numbers stop disagreeing across reports.\n\nWhich figures do you calculate by hand today, and how often do you need them?',
    ),
  },
  {
    id: 'booking',
    keywords: ['запис', 'бронир', 'расписан', 'клиник', 'салон', 'косметолог', 'барбер', 'фитнес', 'студи', 'медцентр', 'приём', 'booking', 'appointment'],
    link: '/products',
    answer: L(
      'Для клиник, салонов и студий делаем онлайн-запись с напоминаниями в WhatsApp: клиент выбирает время сам, расписание специалистов и история визитов ведутся автоматически. Напоминания заметно снижают неявки — администратору не нужно обзванивать всех вручную.\n\nСколько специалистов в расписании и как сейчас ведётся запись?',
      'Клиника, салон және студиялар үшін WhatsApp-та еске салуы бар онлайн жазылу жасаймыз: клиент уақытты өзі таңдайды, маман кестесі мен визит тарихы автоматты жүргізіледі.\n\nКестеде қанша маман бар және жазылу қалай жүргізіледі?',
      'For clinics, salons and studios we build online booking with WhatsApp reminders: clients pick their slot, staff schedules and visit history maintain themselves. Reminders cut no-shows noticeably.\n\nHow many specialists are in the schedule, and how do you book people now?',
    ),
  },
  {
    id: 'horeca',
    keywords: ['ресторан', 'кафе', 'кофейн', 'iiko', 'айко', 'меню', 'кухн', 'доставк', 'общепит', 'бар', 'restaurant'],
    link: '/projects',
    answer: L(
      'В ресторанах закрываем приём заказов через Telegram-бот с передачей на кухню и интеграцией с iiko, плюс аналитика загрузки по часам и позициям меню. У нас такой проект уже в портфолио — заказы доходят до кухни без участия официанта.\n\nУ вас сейчас iiko, r_keeper или что-то другое?',
      'Мейрамханаларда Telegram-бот арқылы тапсырыс қабылдап, ас үйге беруді және iiko интеграциясын жасаймыз, сағат бойынша жүктеме аналитикасы қосылады.\n\nСізде iiko, r_keeper әлде басқа жүйе ме?',
      'For restaurants we handle Telegram ordering with kitchen routing and iiko integration, plus load analytics by hour and menu item. We have exactly this in the portfolio — orders reach the kitchen without a waiter.\n\nAre you on iiko, r_keeper or something else?',
    ),
  },
  {
    id: 'documents',
    keywords: ['документ', 'счет', 'счёт', 'накладн', 'договор', 'скан', 'pdf', 'распозна', 'ocr', 'бухгалт'],
    link: '/products',
    answer: L(
      'Обработку документов забирает AI: данные из PDF, счетов и накладных распознаются и заносятся в 1С и CRM сами, с проверкой реквизитов и контролем дублей. Ручной ввод остаётся только на нестандартных бумагах.\n\nСколько документов в месяц проходит и в каком они виде — сканы, PDF, фото?',
      'Құжат өңдеуді AI алады: PDF, шот пен жүкқұжаттағы дерек танылып, 1С және CRM-ге өзі енгізіледі, деректемелер тексеріледі.\n\nАйына қанша құжат өтеді және олар қандай түрде?',
      'AI takes over document handling: data from PDFs, invoices and delivery notes is recognised and posted into 1C and CRM automatically, with detail checks and duplicate control.\n\nHow many documents a month, and in what form — scans, PDFs, photos?',
    ),
  },
  {
    id: 'price',
    keywords: ['цена', 'цены', 'стоим', 'скольк', 'бюджет', 'прайс', 'дорого', 'дешев', 'тенге', 'price', 'cost', 'budget', 'баға', 'қанша'],
    link: '/contact',
    answer: L(
      'Цену называем только после разбора задачи — иначе это будет цифра с потолка. Стоимость складывается из числа интеграций, ролей и прав, объёма переноса данных и глубины AI-логики: CRM для трёх менеджеров и система для отдела из тридцати отличаются в разы.\n\nОпишите задачу в двух словах, и я передам её команде — расчёт и консультация бесплатные. Или напишите напрямую в Telegram, ответим быстрее.',
      'Бағаны тапсырманы талдағаннан кейін ғана айтамыз. Құны интеграция саны, рөлдер, дерек көшіру көлемі және AI логикасының тереңдігіне байланысты.\n\nТапсырманы қысқаша сипаттаңыз — есептеу мен кеңес тегін.',
      'We quote only after understanding the task — anything earlier is a number pulled from air. Cost depends on integrations, roles and permissions, data migration and how deep the AI logic goes.\n\nDescribe the task briefly and I will pass it to the team — the estimate and consultation are free.',
    ),
  },
  {
    id: 'timeline',
    keywords: ['срок', 'сколько времени', 'когда', 'быстро', 'долго', 'дедлайн', 'успе', 'timeline', 'how long', 'мерзім'],
    link: '/process',
    answer: L(
      'Срок зависит от объёма: типовой модуль из каталога разворачивается быстрее, чем система с нуля под сложный процесс с миграцией данных. Обещать конкретные даты, не посмотрев задачу, не буду — это ровно то, из-за чего проекты потом срываются.\n\nРасскажите про задачу, оценим по этапам. Как мы ведём работу, расписано в разделе «Процесс».',
      'Мерзім көлемге байланысты: каталогтағы дайын модуль күрделі процеске арналған жүйеден жылдам іске қосылады. Тапсырманы көрмей нақты күн айтпаймын.\n\nТапсырма туралы айтыңыз, кезеңдер бойынша бағалаймыз.',
      'Timing depends on scope: a catalogue module goes live faster than a system built from scratch with data migration. I will not promise dates before seeing the task — that is exactly how projects slip.\n\nTell me about it and we will estimate stage by stage.',
    ),
  },
  {
    id: 'cases',
    keywords: ['кейс', 'портфоли', 'пример', 'проект', 'опыт', 'работ', 'делали', 'case', 'portfolio', 'example', 'тәжірибе'],
    link: '/projects',
    answer: L(
      'В портфолио 20 проектов: рестораны с iiko, гостиницы, CRM для спортивных секций и косметологии, интеграции 1С с Kaspi и маркетплейсами, AI-агенты в Telegram и WhatsApp, обработка документов, образовательные платформы. По каждому указаны отрасль, стек и что получилось.\n\nОткрыть можно в разделе «Проекты». Какая отрасль вам ближе — покажу похожий кейс.',
      'Портфолиода 20 жоба бар: мейрамханалар, қонақ үйлер, CRM, 1С интеграциялары, Telegram мен WhatsApp-тағы AI-агенттер. Әрқайсысында сала, стек және нәтиже көрсетілген.\n\n«Жобалар» бөлімінен қараңыз. Сізге қай сала жақын?',
      'The portfolio holds 20 projects: restaurants on iiko, hotels, CRM for sports clubs and beauty clinics, 1C integrations with Kaspi and marketplaces, AI agents on Telegram and WhatsApp, document processing, education platforms.\n\nOpen the Projects page. Which industry is closest to yours?',
    ),
  },
  {
    id: 'stack',
    keywords: ['стек', 'технолог', 'на чем', 'на чём', 'язык', 'react', 'python', 'postgres', 'хостинг', 'сервер', 'stack', 'tech'],
    link: '/stack',
    answer: L(
      'Работаем на React и Next.js на фронте, Python с FastAPI и Node.js на бэке, PostgreSQL как основная база, OpenAI и LangChain для AI-логики, плюс интеграции с 1С, Kaspi и мессенджерами. Стек подбираем под задачу, а не наоборот.\n\nПодробнее — в разделе «Стек». Есть требования по технологиям с вашей стороны?',
      'Фронтта React пен Next.js, бэкте Python (FastAPI) және Node.js, дерекқор PostgreSQL, AI үшін OpenAI мен LangChain, оған қоса 1С, Kaspi және мессенджер интеграциялары.\n\nТолығырақ «Стек» бөлімінде.',
      'React and Next.js on the front, Python with FastAPI and Node.js on the back, PostgreSQL as the main database, OpenAI and LangChain for AI logic, plus 1C, Kaspi and messenger integrations. The stack follows the task, not the other way round.\n\nMore on the Stack page. Any technology constraints on your side?',
    ),
  },
  {
    id: 'process',
    keywords: ['как работа', 'этап', 'процесс', 'начать', 'начало', 'с чего', 'договор', 'оплат', 'предоплат', 'гаранти', 'поддержк после', 'process', 'how do you work'],
    link: '/process',
    answer: L(
      'Начинаем с разбора задачи: смотрим текущий процесс, узкие места и что должно измениться. Дальше согласовываем объём и этапы, показываем работу по частям, а не одним куском в конце — так правки стоят дешевле. После запуска остаёмся на поддержке.\n\nПолностью этапы расписаны в разделе «Процесс». С чего хотите начать?',
      'Тапсырманы талдаудан бастаймыз: қазіргі процесс, тар жерлер және не өзгеруі керек. Содан кейін көлем мен кезеңдерді келісеміз, жұмысты бөлікпен көрсетеміз. Іске қосқаннан кейін қолдауда қаламыз.\n\nКезеңдер «Процесс» бөлімінде.',
      'We start by unpacking the task: current process, bottlenecks, what should change. Then we agree scope and stages and show work in pieces rather than one lump at the end — revisions cost less that way. After launch we stay on support.\n\nFull stages on the Process page.',
    ),
  },
  {
    id: 'website',
    keywords: ['сайт', 'лендинг', 'магазин', 'интернет-магазин', 'landing', 'website', 'shop', 'ecommerce'],
    link: '/services',
    answer: L(
      'Делаем сайты и интернет-магазины с прицелом на то, что будет после запуска: заявки падают в CRM, каталог связан с 1С, аналитика показывает, откуда пришёл клиент. Отдельно можно поставить AI-консультанта, который отвечает по товарам и оформляет заказ прямо в чате.\n\nСайт нужен с нуля или переделать существующий?',
      'Сайттар мен интернет-дүкендер жасаймыз: өтінім CRM-ге түседі, каталог 1С-пен байланысты, аналитика клиенттің қайдан келгенін көрсетеді. Чатта жауап беретін AI-кеңесші қосуға болады.\n\nСайт нөлден керек пе, әлде барын қайта жасау керек пе?',
      'We build sites and online stores with life after launch in mind: leads land in CRM, the catalogue syncs with 1C, analytics shows where customers come from. An AI consultant can answer product questions and take the order in chat.\n\nFrom scratch, or rebuilding an existing site?',
    ),
  },
  {
    id: 'contacts',
    keywords: ['контакт', 'связ', 'телефон', 'позвон', 'написать', 'whatsapp', 'ватсап', 'телеграм', 'telegram', 'почт', 'email', 'contact', 'байланыс'],
    link: '/contact',
    answer: L(
      'Проще всего написать напрямую: Telegram @DeveloperAI0 или WhatsApp +7 776 550 96 86 — кнопки есть рядом с этим чатом. Можно оставить заявку в разделе «Контакты», тогда мы напишем сами.\n\nЕсли удобно, оставьте контакт прямо здесь — передам команде.',
      'Тікелей жазған ыңғайлы: Telegram @DeveloperAI0 немесе WhatsApp +7 776 550 96 86 — түймелер осы чаттың қасында. «Байланыс» бөлімінде өтінім қалдыруға болады.\n\nҚаласаңыз, байланысыңызды осында қалдырыңыз.',
      'Easiest is to message directly: Telegram @DeveloperAI0 or WhatsApp +7 776 550 96 86 — the buttons sit next to this chat. You can also leave a request on the Contact page.\n\nOr drop your contact here and I will pass it to the team.',
    ),
  },
];

/** Приветственные и служебные реплики. */
export const SMALL_TALK = [
  {
    id: 'greeting',
    keywords: ['привет', 'здравств', 'добрый день', 'добрый вечер', 'доброе утро', 'салам', 'сәлем', 'hello', 'hi ', 'hey'],
    answer: L(
      'Здравствуйте. Я консультант Oberon Studio — помогу разобраться, что из наших решений подходит под вашу задачу.\n\nЧем занимается ваш бизнес и что хотите автоматизировать?',
      'Сәлеметсіз бе. Мен Oberon Studio кеңесшісімін — қай шешім сізге келетінін анықтауға көмектесемін.\n\nБизнесіңіз немен айналысады және нені автоматтандырғыңыз келеді?',
      'Hello. I am the Oberon Studio consultant — happy to work out which of our solutions fits your case.\n\nWhat does your business do, and what would you like to automate?',
    ),
  },
  {
    id: 'thanks',
    keywords: ['спасибо', 'благодар', 'рахмет', 'thanks', 'thank you'],
    answer: L(
      'Пожалуйста. Если появятся вопросы — пишите сюда или сразу в Telegram, отвечаем быстро.',
      'Оқасы жоқ. Сұрақ туындаса — осында немесе Telegram-ға жазыңыз.',
      'Any time. If more questions come up, write here or straight to Telegram.',
    ),
  },
  {
    id: 'who',
    keywords: ['кто ты', 'ты бот', 'человек', 'живой', 'робот', 'who are you', 'are you a bot', 'нейросет'],
    answer: L(
      'Я бот-консультант на сайте Oberon Studio: отвечаю по нашим решениям и проектам, помогаю сформулировать задачу. Договориться о деталях и получить расчёт лучше у живой команды — оставьте контакт или напишите в Telegram.',
      'Мен Oberon Studio сайтындағы бот-кеңесшімін: шешімдер мен жобалар бойынша жауап беремін. Нақты есеп үшін тірі командаға жазыңыз.',
      'I am the consultant bot on the Oberon Studio site: I answer about our solutions and projects. For details and an estimate, the live team is better — leave a contact or write to Telegram.',
    ),
  },
];

/** Быстрые подсказки под полем ввода. */
export const QUICK_REPLIES = L(
  ['Нужна CRM', 'AI-агент для заявок', 'Интеграция с 1С', 'Сколько стоит?', 'Покажите проекты'],
  ['CRM керек', 'Өтінімге AI-агент', '1С интеграциясы', 'Бағасы қанша?', 'Жобаларды көрсетіңіз'],
  ['I need a CRM', 'AI agent for leads', '1C integration', 'How much?', 'Show me projects'],
);

/** Ответ, когда вопрос не распознан: не выдумываем, а уточняем. */
export const FALLBACK = L(
  'Чтобы ответить точно, мне не хватает контекста. Расскажите в двух словах: чем занимается бизнес и какой процесс отнимает больше всего времени?\n\nМы делаем CRM, AI-агентов для заявок и поддержки, интеграции с 1С и маркетплейсами, аналитику и онлайн-запись. Если задача за пределами этого — честно скажу.',
  'Дәл жауап беру үшін контекст жетіспейді. Бизнесіңіз немен айналысады және қай процесс көп уақыт алады?\n\nБіз CRM, AI-агенттер, 1С интеграциялары, аналитика және онлайн жазылу жасаймыз.',
  'I need a bit more context to answer properly. In short: what does the business do, and which process eats the most time?\n\nWe build CRM, AI agents for leads and support, 1C and marketplace integrations, analytics and online booking. If your task falls outside that, I will say so.',
);

/** Просьба оставить контакт — показывается после нескольких реплик. */
export const LEAD_PROMPT = L(
  'Чтобы не гадать дальше, давайте передам задачу команде — консультация и расчёт бесплатные. Напишите имя и удобный контакт: телефон, Telegram или email.',
  'Тапсырманы командаға берейін — кеңес пен есептеу тегін. Атыңыз бен байланысыңызды жазыңыз.',
  'Let me pass this to the team — consultation and estimate are free. Send your name and a contact: phone, Telegram or email.',
);

export const LEAD_DONE = L(
  'Записал, передал команде. Свяжемся в ближайшее рабочее время. Если нужно быстрее — напишите в Telegram @DeveloperAI0, там отвечаем сразу.',
  'Жаздым, командаға бердім. Жақын жұмыс уақытында хабарласамыз. Жылдамырақ керек болса — Telegram @DeveloperAI0.',
  'Noted and passed to the team. We will be in touch during business hours. Need it faster — write to Telegram @DeveloperAI0.',
);

export const LEAD_FAILED = L(
  'Не получилось отправить заявку — похоже, что-то со связью. Напишите напрямую в Telegram @DeveloperAI0 или на WhatsApp +7 776 550 96 86, так надёжнее.',
  'Өтінімді жіберу мүмкін болмады. Тікелей Telegram @DeveloperAI0 немесе WhatsApp +7 776 550 96 86 жазыңыз.',
  'The request did not go through — looks like a connection issue. Write directly to Telegram @DeveloperAI0 or WhatsApp +7 776 550 96 86.',
);

/** Ссылка «открыть раздел» под ответом. */
export const LINK_LABELS = L('Открыть раздел', 'Бөлімді ашу', 'Open section');

const CONTACT_PATTERNS = [
  /\+?\d[\d\s\-()]{8,}/,               // телефон
  /@[a-zA-Z][\w]{3,}/,                  // telegram-ник
  /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/,      // email
];

/** Есть ли в сообщении телефон, ник или почта. */
export function containsContact(text) {
  return CONTACT_PATTERNS.some(pattern => pattern.test(text));
}

const matcherCache = new Map();

/**
 * Ключевое слово должно начинаться с начала слова, иначе ловятся ложные
 * совпадения: «работы» содержит «бот», «сайт» прячется в «дизайте».
 * Конец слова свободен — это позволяет писать основы: «интеграц» → «интеграции».
 */
function matches(keyword, text) {
  let matcher = matcherCache.get(keyword);
  if (!matcher) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    matcher = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}`, 'iu');
    matcherCache.set(keyword, matcher);
  }
  return matcher.test(text);
}

function scoreTopic(topic, lower) {
  let score = 0;
  for (const keyword of topic.keywords) {
    if (matches(keyword, lower)) {
      // Длинные совпадения весомее: «интернет-магазин» точнее, чем «сайт».
      score += keyword.length >= 6 ? 2 : 1;
    }
  }
  return score;
}

/**
 * Подбирает ответ по сообщению пользователя.
 * @returns {{ id: string, text: string, link?: string, matched: boolean }}
 */
export function findAnswer(message, lang = 'ru') {
  const lower = ` ${message.toLowerCase().trim()} `;
  const pick = obj => obj[lang] || obj.ru;

  for (const item of SMALL_TALK) {
    if (item.keywords.some(k => matches(k, lower))) {
      return { id: item.id, text: pick(item.answer), matched: true };
    }
  }

  let best = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    const score = scoreTopic(topic, lower);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }

  if (best && bestScore > 0) {
    return { id: best.id, text: pick(best.answer), link: best.link, matched: true };
  }

  return { id: 'fallback', text: pick(FALLBACK), matched: false };
}
