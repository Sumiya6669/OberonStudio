/**
 * Страница «О компании» (/o-kompanii).
 *
 * Правило страницы — то же, что у «Безопасности»: только факты, которые уже
 * есть на сайте и в коде продуктов. Откуда что взято:
 *   - кто и чем занимается — hero и подвал (t.hero.sub, t.footer.subtitle),
 *     каталог src/lib/content/site.js (PRODUCTS: группы 1c / bots / custom);
 *   - имя, роль и «6+ лет в 1С и ИИ» — подтверждены владельцем 09.10.2026;
 *   - как работаем — t.process (шаги, ТЗ до начала работ) и t.faq / t.contact
 *     (договор с физическим лицом, сумма до начала);
 *   - принципы — src/lib/content/security.js (сверено по коду продуктов 08.10.2026);
 *   - отзывы — только опубликованные в CMS (useTestimonials), в коде их нет;
 *   - контакты — SITE_SETTINGS и настройки сайта из панели.
 *
 * ГОЛОС. Сайт сейчас говорит от первого лица («Я автоматизирую…»), поэтому
 * по умолчанию 'i'. Владелец переключает одним флагом ABOUT_VOICE на 'we'.
 * Строки, которые зависят от голоса, записаны парой { i, we }; остальные —
 * обычной строкой. Выбор делает функция voiced() ниже.
 *
 * РЕКВИЗИТЫ. ИП ещё не зарегистрирован, поэтому блок не выводится. Когда
 * появятся — заполнить ABOUT_LEGAL (name и bin обязательны), и блок
 * появится на странице сам. Пустые поля не выводятся никогда.
 *
 * Казахский текст — первый вариант, нужна вычитка носителем.
 */

/** 'i' — от первого лица, как на главной; 'we' — от лица студии. */
export const ABOUT_VOICE = 'i';

/**
 * Реквизиты. Пусто — блока на странице нет.
 * name — «ИП Фамилия Имя» как в свидетельстве; bin — ИИН/БИН; address —
 * юридический адрес; bank — банк и ИИК, если хотите их показывать.
 */
export const ABOUT_LEGAL = {
  name: '',
  bin: '',
  address: '',
  bank: '',
};

export const hasLegal = (legal = ABOUT_LEGAL) => Boolean(legal?.name && legal?.bin);

/** Строка в нужном голосе: пара { i, we } или обычная строка. */
export function voiced(value, voice = ABOUT_VOICE) {
  if (value && typeof value === 'object' && !Array.isArray(value) && ('i' in value || 'we' in value)) {
    return value[voice] ?? value.i;
  }
  return value;
}

const ru = {
  label: 'О компании',
  title: 'Tinker — 1С для Казахстана и ИИ-автоматизация',
  lead: {
    i: 'Я — Альберт Гаан, ведущий разработчик 1С и ИИ в Tinker, 6+ лет в 1С и ИИ. Делаю расширения для 1С:Бухгалтерии для Казахстана 3.0 и Комплексной автоматизации 2.4, ИИ-агентов и ботов, интеграции с Kaspi и банками — и разработку под заказ, когда готового решения нет.',
    we: 'Tinker — студия 1С и ИИ-автоматизации из Казахстана. Мы делаем расширения для 1С:Бухгалтерии для Казахстана 3.0 и Комплексной автоматизации 2.4, ИИ-агентов и ботов, интеграции с Kaspi и банками — и разработку под заказ, когда готового решения нет. Ведущий разработчик — Альберт Гаан, 6+ лет в 1С и ИИ.',
  },
  facts: {
    ext: 'расширений 1С в каталоге',
    configs: 'конфигурации: БухКз 3.0 и КА 2.4',
    bots: 'бота и сервиса',
    years: 'лет в 1С и ИИ',
  },
  whatTitle: { i: 'Что я делаю', we: 'Что мы делаем' },
  what: [
    {
      icon: 'puzzle',
      title: 'Продукты для 1С',
      text: 'Расширения для БухКз 3.0 и КА 2.4, каждое в двух вариантах: ЭСФ, разноска банка, СНТ и виртуальный склад, акты сверки, дебиторка, пульт бухгалтерской фирмы. Ставятся как обычные расширения: типовую конфигурацию не меняют и с поддержки её не снимают.',
      to: '/products?cat=1С',
      cta: 'Каталог расширений',
    },
    {
      icon: 'bot',
      title: 'Боты и сервисы',
      text: 'Готовые сервисы без 1С: кадры в Telegram, маржа на Kaspi, продавец в WhatsApp, накладные в iiko и r_keeper. Подключаются за день-два и оплачиваются помесячно.',
      to: '/products?cat=Боты',
      cta: 'Боты и сервисы',
    },
    {
      icon: 'code',
      title: 'Разработка под заказ',
      text: 'Сайты, приложения, CRM, интеграции и доработки 1С — когда готового продукта под задачу нет.',
      to: '/services',
      cta: 'Услуги',
      second: { to: '/projects', cta: 'Работы' },
    },
    {
      icon: 'scan',
      title: 'Бесплатная экспресс-проверка 1С',
      text: 'Внешняя обработка .epf для БухКз 3.0 и КА 2.4: только читает базу и за пару минут находит ЭСФ без выписки, просроченную дебиторку, ошибки СНТ и ВС, неразнесённый банк, неверные ИИН/БИН и встречные долги.',
      to: '/proverka',
      cta: 'Проверить базу',
    },
  ],
  howTitle: { i: 'Как я работаю', we: 'Как мы работаем' },
  how: [
    { title: 'Разговор', text: 'Бесплатно, до 30 минут: задача и бизнес — чтобы понять причину, а не симптом.' },
    { title: 'ТЗ до начала работ', text: 'Стек, архитектура, интеграции, этапы, сроки и стоимость — вы видите всё до разработки.' },
    { title: 'Прототип и разработка', text: 'Сначала прототип, потом итерации с регулярными показами — правки по ходу, а не в конце.' },
    { title: 'Запуск и поддержка', text: 'Тестирование и согласование с вами, запуск, дальше — поддержка по договорённости.' },
  ],
  terms: {
    i: 'Работаю как частный специалист: юридического лица нет, договор заключается с физическим лицом. Предмет работ, сроки, сумма и порядок приёмки фиксируются письменно до начала, а не по ходу дела.',
    we: 'Юридического лица пока нет: договор заключается с исполнителем — физическим лицом. Предмет работ, сроки, сумма и порядок приёмки фиксируются письменно до начала, а не по ходу дела.',
  },
  termsLink: 'Как оформляются работы',
  howLink: 'Процесс целиком',
  principlesTitle: 'Принципы, которые соблюдаются в продуктах',
  principlesSub: 'Сверено по коду продуктов — подробно, с исключениями, на странице «Безопасность».',
  principles: [
    { icon: 'layers', title: 'Типовая остаётся типовой', text: 'Каждый продукт — отдельное расширение 1С. Объекты типовой конфигурации не меняются, снимать её с поддержки не нужно.' },
    { icon: 'eye', title: 'Большинство продуктов только читают', text: 'Антикамералка, Контроль ВС и СНТ, Проверка контрагента, Маркировка, Дебиторка и Пульт типовые документы не создают и не меняют. Экспресс-проверка только читает базу и в интернет не выходит.' },
    { icon: 'file', title: 'Документы — черновиками и по кнопке', text: 'Продукты, которые создают документы, делают это по команде пользователя и без проведения. ЭСФ подписываете и отправляете вы, своей ЭЦП; письмо с актом сверки уходит только после вашего подтверждения. Исключения — счёт-фактура в КА и автопроведение в Роботе разноски, которое включает администратор, — описаны на странице «Безопасность».' },
    { icon: 'send', title: 'Ничего наружу без согласия', text: 'Регламентные задания поставляются выключенными, связь с сервисом появляется после ввода ключа администратором, отправка в ИИ — только после отдельного флажка администратора. Скрытой телеметрии нет.' },
    { icon: 'refresh', title: 'Подписанные обновления', text: 'Каждое обновление подписано Ed25519, расширение проверяет подпись и контрольную сумму до установки. Связь — только по HTTPS, откат на старую версию запрещён, в дни сдачи отчётности автообновление не ставится.' },
    { icon: 'alert', title: 'Ограничения — заранее', text: 'Для установки расширения нужно снять флажки «Безопасный режим» и «Защита от опасных действий». Об этом говорится до установки, а не после.' },
  ],
  principlesLink: 'Безопасность: подробно',
  reviewsTitle: 'Отзывы',
  reviewsAll: 'Все отзывы',
  contactsTitle: 'Контакты',
  hours: {
    i: 'Telegram — основной канал. Отвечаю в рабочие дни с 10:00 до 19:00 по Астане, обычно в течение часа.',
    we: 'Telegram — основной канал. Отвечаем в рабочие дни с 10:00 до 19:00 по Астане, обычно в течение часа.',
  },
  channel: 'Telegram-канал',
  contactCta: 'Обсудить задачу',
  legalTitle: 'Реквизиты',
  legal: { name: 'Наименование', bin: 'ИИН/БИН', address: 'Адрес', bank: 'Банк' },
};

const kz = {
  label: 'Компания туралы',
  title: 'Tinker — Қазақстанға арналған 1С және ИИ-автоматтандыру',
  lead: {
    i: 'Мен — Альберт Гаан, Tinker-дегі 1С және ИИ жетекші әзірлеушісімін, 1С және ИИ саласында 6+ жыл. Қазақстанға арналған 1С:Бухгалтерия 3.0 және Кешенді автоматтандыру 2.4 үшін кеңейтімдер, ИИ-агенттер мен боттар, Kaspi және банктермен интеграциялар жасаймын — дайын шешім болмаса, тапсырыс бойынша әзірлеймін.',
    we: 'Tinker — Қазақстандағы 1С және ИИ-автоматтандыру студиясы. Біз Қазақстанға арналған 1С:Бухгалтерия 3.0 және Кешенді автоматтандыру 2.4 үшін кеңейтімдер, ИИ-агенттер мен боттар, Kaspi және банктермен интеграциялар жасаймыз — дайын шешім болмаса, тапсырыс бойынша әзірлейміз. Жетекші әзірлеуші — Альберт Гаан, 1С және ИИ саласында 6+ жыл.',
  },
  facts: {
    ext: 'каталогтағы 1С кеңейтімі',
    configs: 'конфигурация: БухКз 3.0 және КА 2.4',
    bots: 'бот және сервис',
    years: 'жыл 1С және ИИ саласында',
  },
  whatTitle: { i: 'Не істеймін', we: 'Не істейміз' },
  what: [
    {
      icon: 'puzzle',
      title: '1С өнімдері',
      text: 'БухКз 3.0 және КА 2.4 үшін кеңейтімдер, әрқайсысы екі нұсқада: ЭШФ, банкті тарату, ТІЖ және виртуалды қойма, салыстыру актілері, дебиторлық берешек, бухгалтерлік фирма пульті. Кәдімгі кеңейтім ретінде орнатылады: типтік конфигурацияны өзгертпейді және оны қолдаудан шығармайды.',
      to: '/products?cat=1С',
      cta: 'Кеңейтімдер каталогы',
    },
    {
      icon: 'bot',
      title: 'Боттар мен сервистер',
      text: '1С-сіз дайын сервистер: Telegram-дағы кадрлар, Kaspi-дегі маржа, WhatsApp-тағы сатушы, iiko және r_keeper-дегі жүкқұжаттар. Бір-екі күнде қосылады, ай сайын төленеді.',
      to: '/products?cat=Боты',
      cta: 'Боттар мен сервистер',
    },
    {
      icon: 'code',
      title: 'Тапсырыс бойынша әзірлеу',
      text: 'Сайттар, қосымшалар, CRM, интеграциялар және 1С пысықтаулары — міндетке дайын өнім болмаған кезде.',
      to: '/services',
      cta: 'Қызметтер',
      second: { to: '/projects', cta: 'Жұмыстар' },
    },
    {
      icon: 'scan',
      title: '1С-ті тегін жедел тексеру',
      text: 'БухКз 3.0 және КА 2.4 үшін .epf сыртқы өңдеуі: базаны тек оқиды және бірнеше минутта жазылмаған ЭШФ, мерзімі өткен дебиторлық берешек, ТІЖ мен ВҚ қателері, таратылмаған банк, қате ЖСН/БСН және қарсы қарыздарды табады.',
      to: '/proverka',
      cta: 'Базаны тексеру',
    },
  ],
  howTitle: { i: 'Қалай жұмыс істеймін', we: 'Қалай жұмыс істейміз' },
  how: [
    { title: 'Әңгіме', text: 'Тегін, 30 минутқа дейін: міндет пен бизнес — симптомды емес, себепті түсіну үшін.' },
    { title: 'Жұмысқа дейін ТТ', text: 'Стек, архитектура, интеграциялар, кезеңдер, мерзімдер мен құны — бәрін әзірлеуге дейін көресіз.' },
    { title: 'Прототип және әзірлеу', text: 'Алдымен прототип, содан кейін тұрақты көрсетілімдермен итерациялар — түзетулер соңында емес, барысында.' },
    { title: 'Іске қосу және қолдау', text: 'Тестілеу және сізбен келісу, іске қосу, одан әрі — келісім бойынша қолдау.' },
  ],
  terms: {
    i: 'Жеке маман ретінде жұмыс істеймін: заңды тұлға жоқ, шарт жеке тұлғамен жасалады. Жұмыс нысаны, мерзімдер, сома және қабылдау тәртібі жұмыс басталғанға дейін жазбаша бекітіледі.',
    we: 'Әзірге заңды тұлға жоқ: шарт орындаушымен — жеке тұлғамен жасалады. Жұмыс нысаны, мерзімдер, сома және қабылдау тәртібі жұмыс басталғанға дейін жазбаша бекітіледі.',
  },
  termsLink: 'Жұмыстар қалай рәсімделеді',
  howLink: 'Бүкіл процесс',
  principlesTitle: 'Өнімдерде сақталатын қағидаттар',
  principlesSub: 'Өнімдердің коды бойынша салыстырылған — толығырақ, ерекшеліктерімен, «Қауіпсіздік» бетінде.',
  principles: [
    { icon: 'layers', title: 'Типтік типтік күйінде қалады', text: 'Әр өнім — жеке 1С кеңейтімі. Типтік конфигурацияның объектілері өзгермейді, оны қолдаудан шығарудың қажеті жоқ.' },
    { icon: 'eye', title: 'Өнімдердің көбі тек оқиды', text: 'Антикамералка, ВС және ТІЖ бақылауы, Контрагентті тексеру, Таңбалау, Дебиторлық берешек және Пульт типтік құжаттарды жасамайды және өзгертпейді. Жедел тексеру базаны тек оқиды және интернетке шықпайды.' },
    { icon: 'file', title: 'Құжаттар — жоба ретінде және батырма бойынша', text: 'Құжат жасайтын өнімдер мұны пайдаланушының пәрмені бойынша және өткізбей жасайды. ЭШФ-ке сіз өз ЭЦҚ-ңызбен қол қойып, жібересіз; салыстыру актісі бар хат тек сіз растағаннан кейін жіберіледі. Ерекшеліктер — КА-дағы шот-фактура және Банк тарату роботындағы әкімші қосатын автоматты өткізу — «Қауіпсіздік» бетінде сипатталған.' },
    { icon: 'send', title: 'Келісімсіз сыртқа ештеңе кетпейді', text: 'Регламенттік тапсырмалар өшірулі күйде жеткізіледі, сервиспен байланыс әкімші кілтті енгізгеннен кейін пайда болады, ИИ-ге жіберу — тек әкімшінің бөлек белгісінен кейін. Жасырын телеметрия жоқ.' },
    { icon: 'refresh', title: 'Қолтаңбалы жаңартулар', text: 'Әр жаңартуға Ed25519 қолтаңбасы қойылған, кеңейту орнатпас бұрын қолтаңба мен бақылау сомасын тексереді. Байланыс — тек HTTPS арқылы, ескі нұсқаға қайтуға тыйым салынған, есеп тапсыру күндерінде автожаңарту орнатылмайды.' },
    { icon: 'alert', title: 'Шектеулер — алдын ала', text: 'Кеңейтімді орнату үшін «Безопасный режим» және «Защита от опасных действий» белгілерін алып тастау керек. Бұл туралы орнатуға дейін айтылады.' },
  ],
  principlesLink: 'Қауіпсіздік: толығырақ',
  reviewsTitle: 'Пікірлер',
  reviewsAll: 'Барлық пікірлер',
  contactsTitle: 'Байланыс',
  hours: {
    i: 'Telegram — негізгі арна. Жұмыс күндері Астана уақытымен 10:00-ден 19:00-ге дейін, әдетте бір сағат ішінде жауап беремін.',
    we: 'Telegram — негізгі арна. Жұмыс күндері Астана уақытымен 10:00-ден 19:00-ге дейін, әдетте бір сағат ішінде жауап береміз.',
  },
  channel: 'Telegram-арна',
  contactCta: 'Міндетті талқылау',
  legalTitle: 'Деректемелер',
  legal: { name: 'Атауы', bin: 'ЖСН/БСН', address: 'Мекенжай', bank: 'Банк' },
};

const en = {
  label: 'About',
  title: 'Tinker — 1C for Kazakhstan and AI automation',
  lead: {
    i: 'I am Albert Gaan, lead 1C and AI developer at Tinker, with 6+ years in 1C and AI. I build extensions for 1C:Accounting for Kazakhstan 3.0 and Complex Automation 2.4, AI agents and bots, integrations with Kaspi and banks — and custom development when there is no ready-made solution.',
    we: 'Tinker is a 1C and AI automation studio from Kazakhstan. We build extensions for 1C:Accounting for Kazakhstan 3.0 and Complex Automation 2.4, AI agents and bots, integrations with Kaspi and banks — and custom development when there is no ready-made solution. Lead developer: Albert Gaan, 6+ years in 1C and AI.',
  },
  facts: {
    ext: '1C extensions in the catalogue',
    configs: 'configurations: Accounting KZ 3.0 and CA 2.4',
    bots: 'bots and services',
    years: 'years in 1C and AI',
  },
  whatTitle: { i: 'What I do', we: 'What we do' },
  what: [
    {
      icon: 'puzzle',
      title: '1C products',
      text: 'Extensions for Accounting KZ 3.0 and Complex Automation 2.4, each in two versions: e-invoices, bank posting, waybills and the virtual warehouse, reconciliations, receivables, a dashboard for accounting firms. Installed as regular extensions: the standard configuration is not changed and stays under vendor support.',
      to: '/products?cat=1С',
      cta: '1C extensions',
    },
    {
      icon: 'bot',
      title: 'Bots and services',
      text: 'Ready-made services that do not need 1C: HR paperwork in Telegram, Kaspi margins, a WhatsApp sales assistant, supplier invoices into iiko and r_keeper. Connected in a day or two, paid monthly.',
      to: '/products?cat=Боты',
      cta: 'Bots and services',
    },
    {
      icon: 'code',
      title: 'Custom development',
      text: 'Websites, apps, CRM, integrations and 1C modifications — when there is no ready product for the task.',
      to: '/services',
      cta: 'Services',
      second: { to: '/projects', cta: 'Work' },
    },
    {
      icon: 'scan',
      title: 'Free express check of your 1C database',
      text: 'An external .epf processor for Accounting KZ 3.0 and CA 2.4: read-only, and in a couple of minutes it finds missing e-invoices, overdue receivables, waybill and virtual-warehouse errors, unposted bank receipts, invalid IIN/BIN and mutual debts.',
      to: '/proverka',
      cta: 'Check my database',
    },
  ],
  howTitle: { i: 'How I work', we: 'How we work' },
  how: [
    { title: 'A conversation', text: 'Free, up to 30 minutes: the task and the business — to find the cause, not the symptom.' },
    { title: 'A brief before work starts', text: 'Stack, architecture, integrations, stages, timing and cost — you see it all before development.' },
    { title: 'Prototype and development', text: 'A prototype first, then iterations with regular demos — changes along the way, not at the end.' },
    { title: 'Launch and support', text: 'Testing and sign-off with you, launch, then support as agreed.' },
  ],
  terms: {
    i: 'I work as a private specialist: there is no legal entity, so the contract is signed with an individual. Scope, timing, price and acceptance are fixed in writing before work starts.',
    we: 'There is no legal entity yet: the contract is signed with the contractor as an individual. Scope, timing, price and acceptance are fixed in writing before work starts.',
  },
  termsLink: 'How work is contracted',
  howLink: 'The full process',
  principlesTitle: 'Principles the products follow',
  principlesSub: 'Checked against the product code — in detail, with the exceptions, on the Security page.',
  principles: [
    { icon: 'layers', title: 'The standard configuration stays standard', text: 'Each product is a separate 1C extension. Objects of the standard configuration are not changed, and it stays under vendor support.' },
    { icon: 'eye', title: 'Most products only read', text: 'Anti-audit, Virtual warehouse and waybills, Counterparty check, Marking, Receivables and the Dashboard do not create or change standard documents. The express check only reads the database and does not go online.' },
    { icon: 'file', title: 'Documents as drafts, on a button press', text: 'Products that create documents do so on the user’s command and without posting. You sign and send e-invoices yourself, with your own digital signature; a reconciliation letter goes out only after you confirm it. The exceptions — the invoice in Complex Automation and auto-posting in the Bank posting robot, which an administrator switches on — are described on the Security page.' },
    { icon: 'send', title: 'Nothing leaves without consent', text: 'Scheduled jobs ship switched off, a connection to a service appears only after an administrator enters its key, and sending data to AI only after a separate administrator checkbox. There is no hidden telemetry.' },
    { icon: 'refresh', title: 'Signed updates', text: 'Every update is signed with Ed25519; the extension checks the signature and checksum before installing. HTTPS only, no downgrades, and no automatic updates during filing days.' },
    { icon: 'alert', title: 'Limitations up front', text: 'Installing an extension requires clearing the “Safe mode” and “Protection from dangerous actions” flags. This is said before installation, not after.' },
  ],
  principlesLink: 'Security in detail',
  reviewsTitle: 'Reviews',
  reviewsAll: 'All reviews',
  contactsTitle: 'Contacts',
  hours: {
    i: 'Telegram is the main channel. I reply on working days from 10:00 to 19:00 Astana time, usually within an hour.',
    we: 'Telegram is the main channel. We reply on working days from 10:00 to 19:00 Astana time, usually within an hour.',
  },
  channel: 'Telegram channel',
  contactCta: 'Discuss a task',
  legalTitle: 'Company details',
  legal: { name: 'Name', bin: 'IIN/BIN', address: 'Address', bank: 'Bank' },
};

export const ABOUT_TEXT = { ru, kz, en };
