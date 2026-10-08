/**
 * Тексты страницы /proverka — бесплатная экспресс-проверка базы 1С.
 *
 * Отдельным файлом, а не в общем словаре i18n: страница длинная, и её
 * шесть проверок, шаги и форма в ru.js/kz.js/en.js растворились бы среди
 * подписей к меню. Язык выбирается так же, как везде, — по адресу.
 *
 * Названия пунктов меню 1С («Файл → Открыть», «Проверить») во всех трёх
 * версиях оставлены по-русски: так они называются в самой программе и в
 * самой обработке, и человек ищет на экране именно эти слова.
 *
 * Казахский текст — первый вариант, требует вычитки носителем.
 */

/** Публичный адрес файла. Сам файл кладётся в public/downloads/ отдельно. */
export const EPF_FILE = 'Tinker_ExpressCheck.epf';
export const EPF_URL = `/downloads/${EPF_FILE}`;

/** Код формы для заявки: колонка crm.ticket.form, подпись — в админке (FORMS). */
export const PROVERKA_FORM = 'express_check';

/** Тема заявки (crm.ticket.subject) — по-русски на любом языке страницы. */
export const PROVERKA_SUBJECT = 'Экспресс-проверка базы 1С';

/** Где на сайте лежат продукты 1С: каталог с включённым фильтром. */
export const PRODUCTS_1C_PATH = '/products?cat=1С';

const ru = {
  hero: {
    label: 'Бесплатно · внешняя обработка .epf',
    title: 'Бесплатная экспресс-проверка базы 1С',
    configs: [
      'Бухгалтерия для Казахстана 3.0',
      'Комплексная автоматизация для Казахстана 2.4',
    ],
    sub: 'Одна внешняя обработка (.epf). Открывается через Файл → Открыть и за пару минут показывает «денежные» проблемы учёта — с суммами и полным списком документов по каждой проверке.',
    ctaPrimary: 'Получить файл',
    ctaSecondary: 'Что проверяет',
  },
  checks: {
    label: 'Что проверяет',
    title: 'Шесть проверок',
    sub: 'Рядом с каждой — продукт Tinker, который берёт эту задачу на себя постоянно, а не раз в квартал.',
    productLabel: 'Закрывает',
    items: [
      {
        title: 'ЭСФ',
        points: [
          'Реализации без выписанного ЭСФ или с ЭСФ в ошибке.',
          'Отдельно — те, у которых уже прошёл срок выписки: 15 календарных дней после даты оборота.',
        ],
        product: 'ЭСФ-контролёр',
      },
      {
        title: 'Просроченная дебиторка',
        points: [
          'Долг покупателей, разложенный по документам: оплаты гасят самые старые.',
          'Срок — по договору или по дате платежа.',
        ],
        product: 'Дебиторка',
      },
      {
        title: 'СНТ и виртуальный склад',
        points: [
          'СНТ с ошибкой и отклонённые.',
          'Отгрузки товаров виртуального склада без действующей СНТ.',
          'Отрицательные остатки на ВС.',
          'Всё — по данным, уже загруженным в 1С.',
        ],
        product: 'Контроль ВС и СНТ',
      },
      {
        title: 'Банковские поступления',
        points: [
          'Непроведённые поступления.',
          'Поступления без контрагента — неопознанные.',
          'Оплаты покупателей без договора.',
        ],
        product: 'Робот разноски',
      },
      {
        title: 'ИИН/БИН контрагентов',
        points: [
          'Контрагенты с оборотом, у которых нет ИИН/БИН.',
          'Контрагенты с неверным ИИН/БИН: проверяются 12 цифр и контрольный разряд.',
        ],
        product: 'Проверка контрагента',
      },
      {
        title: 'Встречные расчёты',
        points: [
          'Контрагент одновременно должен вам, а вы — ему.',
          'По одному договору долг, по другому — аванс.',
          'Это кандидаты на акт сверки и зачёт.',
        ],
        product: 'Акты сверки',
      },
    ],
    productsLink: 'Все продукты для 1С',
  },
  safety: {
    label: 'Безопасность',
    title: 'Только чтение',
    items: [
      { icon: 'lock', title: 'Ничего не записывает в базу', text: 'Обработка только читает данные: документы, справочники и регистры остаются как были.' },
      { icon: 'offline', title: 'Не выходит в интернет', text: 'Ничего никуда не отправляет. Отчёт остаётся у вас на экране.' },
      { icon: 'shield', title: 'Безопасный режим', text: 'Работает в безопасном режиме, без установки расширений и без изменений конфигурации.' },
      { icon: 'code', title: 'Открытый код', text: 'Исходный код не закрыт — его можно открыть и прочитать в Конфигураторе.' },
    ],
  },
  howto: {
    label: 'Как запустить',
    title: 'Три шага',
    steps: [
      { title: 'Скачайте файл', text: 'Ссылка появится сразу после заявки ниже.' },
      {
        title: 'Откройте его в 1С',
        text: 'Файл → Открыть → выберите файл. Если 1С покажет предупреждение безопасности — подтвердите открытие. Нужны права на открытие внешних обработок; обычно они есть у администратора.',
      },
      {
        title: 'Выберите организацию и период',
        text: 'По умолчанию — последние 3 месяца. Нажмите «Проверить».',
      },
    ],
  },
  report: {
    label: 'Что делать с отчётом',
    title: 'Отчёт — ваш',
    items: [
      '«Показать все» открывает полный список найденного по каждой проверке прямо в 1С; двойной щелчок — сам документ.',
      'Сохраните полный отчёт — сводку и все найденные документы — кнопкой «Сохранить в Excel» или «Сохранить в PDF».',
      'Пришлите нам на бесплатную консультацию — разберём находки и скажем, что из этого можно автоматизировать.',
    ],
    note: 'Мы не видим ваших данных, пока вы сами их не пришлёте.',
  },
  form: {
    label: 'Получить файл',
    title: 'Оставьте контакт — ссылка появится сразу',
    sub: 'Контакт нужен, чтобы договориться о бесплатном разборе отчёта, если он вам понадобится.',
    name: 'Имя',
    namePh: 'Алексей',
    phone: 'Телефон / Telegram',
    phonePh: '+7 700 000 0000',
    email: 'Email',
    emailPh: 'name@company.kz',
    company: 'Компания',
    companyPh: 'ТОО «Компания»',
    config: 'Какая у вас 1С',
    configs: ['БухКз 3.0', 'КА 2.4', 'Другая'],
    submit: 'Получить файл',
    sending: 'Отправляем…',
    error: 'Не удалось отправить заявку. Попробуйте ещё раз или напишите нам в Telegram.',
    doneTitle: 'Файл готов',
    doneSub: 'Скачайте обработку и откройте её в 1С.',
    download: 'Скачать обработку (.epf)',
    doneSteps: [
      'В 1С: Файл → Открыть → выберите скачанный файл.',
      'Если появится предупреждение безопасности — подтвердите открытие.',
      'Выберите организацию и период и нажмите «Проверить».',
      'Сохраните полный отчёт в PDF или Excel и пришлите нам, если хотите разобрать находки.',
    ],
    ref: 'Номер обращения',
    again: 'Отправить ещё одну заявку',
  },
};

const kz = {
  hero: {
    label: 'Тегін · сыртқы өңдеу .epf',
    title: '1С базасын тегін жедел тексеру',
    configs: [
      'Қазақстанға арналған Бухгалтерия 3.0',
      'Қазақстанға арналған Кешенді автоматтандыру 2.4',
    ],
    sub: 'Бір сыртқы өңдеу (.epf). «Файл → Открыть» арқылы ашылады және бірнеше минутта есептегі «ақшалай» мәселелерді сомаларымен және әр тексеру бойынша құжаттардың толық тізімімен көрсетеді.',
    ctaPrimary: 'Файлды алу',
    ctaSecondary: 'Не тексереді',
  },
  checks: {
    label: 'Не тексереді',
    title: 'Алты тексеру',
    sub: 'Әрқайсысының жанында — бұл міндетті тоқсанына бір рет емес, үнемі өз мойнына алатын Tinker өнімі.',
    productLabel: 'Шешеді',
    items: [
      {
        title: 'ЭШФ',
        points: [
          'ЭШФ жазылмаған немесе ЭШФ қатемен тұрған өткізулер.',
          'Бөлек — жазып беру мерзімі өтіп кеткендері: айналым күнінен кейін 15 күнтізбелік күн.',
        ],
        product: 'ЭСФ-контролёр',
      },
      {
        title: 'Мерзімі өткен дебиторлық берешек',
        points: [
          'Сатып алушылардың берешегі құжаттар бойынша бөлінген: төлемдер ең ескілерін өтейді.',
          'Мерзімі — шарт бойынша немесе төлем күні бойынша.',
        ],
        product: 'Дебиторка',
      },
      {
        title: 'ТІЖ және виртуалды қойма',
        points: [
          'Қатемен тұрған және қабылданбаған ТІЖ (СНТ).',
          'Виртуалды қойма тауарларын қолданыстағы ТІЖ-сіз тиеу.',
          'Виртуалды қоймадағы теріс қалдықтар.',
          'Барлығы — 1С-ке әлдеқашан жүктелген деректер бойынша.',
        ],
        product: 'Контроль ВС и СНТ',
      },
      {
        title: 'Банк түсімдері',
        points: [
          'Өткізілмеген түсімдер.',
          'Контрагенті жоқ, яғни анықталмаған түсімдер.',
          'Шартсыз сатып алушылардың төлемдері.',
        ],
        product: 'Робот разноски',
      },
      {
        title: 'Контрагенттердің ЖСН/БСН',
        points: [
          'Айналымы бар, бірақ ЖСН/БСН жоқ контрагенттер.',
          'ЖСН/БСН қате контрагенттер: 12 цифр және бақылау разряды тексеріледі.',
        ],
        product: 'Проверка контрагента',
      },
      {
        title: 'Қарсы есеп айырысулар',
        points: [
          'Контрагент сізге қарыз, ал сіз оған қарызсыз.',
          'Бір шарт бойынша қарыз, басқасы бойынша — аванс.',
          'Бұлар — салыстыру актісі мен өзара есепке алуға үміткерлер.',
        ],
        product: 'Акты сверки',
      },
    ],
    productsLink: '1С-ке арналған барлық өнімдер',
  },
  safety: {
    label: 'Қауіпсіздік',
    title: 'Тек оқу',
    items: [
      { icon: 'lock', title: 'Базаға ештеңе жазбайды', text: 'Өңдеу деректерді тек оқиды: құжаттар, анықтамалықтар және тізілімдер өзгеріссіз қалады.' },
      { icon: 'offline', title: 'Интернетке шықпайды', text: 'Ештеңені ешқайда жібермейді. Есеп сіздің экраныңызда қалады.' },
      { icon: 'shield', title: 'Қауіпсіз режим', text: 'Қауіпсіз режимде жұмыс істейді, кеңейтулер орнатпайды және конфигурацияны өзгертпейді.' },
      { icon: 'code', title: 'Ашық код', text: 'Бастапқы код жабық емес — оны Конфигураторда ашып оқуға болады.' },
    ],
  },
  howto: {
    label: 'Қалай іске қосу',
    title: 'Үш қадам',
    steps: [
      { title: 'Файлды жүктеп алыңыз', text: 'Сілтеме төмендегі өтінімнен кейін бірден пайда болады.' },
      {
        title: '1С-те ашыңыз',
        text: '«Файл → Открыть» → файлды таңдаңыз. 1С қауіпсіздік ескертуін көрсетсе — ашуды растаңыз. Сыртқы өңдеулерді ашуға құқық қажет; әдетте ол әкімшіде болады.',
      },
      {
        title: 'Ұйым мен кезеңді таңдаңыз',
        text: 'Әдепкі бойынша — соңғы 3 ай. «Проверить» түймесін басыңыз.',
      },
    ],
  },
  report: {
    label: 'Есеппен не істеу керек',
    title: 'Есеп — сіздікі',
    items: [
      '«Показать все» әр тексеру бойынша табылғанның толық тізімін 1С-тің өзінде ашады; екі рет басу — құжаттың өзі.',
      'Толық есепті — қорытынды мен табылған барлық құжаттарды — «Сохранить в Excel» немесе «Сохранить в PDF» батырмасымен сақтаңыз.',
      'Тегін кеңеске бізге жіберіңіз — табылғандарды талдап, нені автоматтандыруға болатынын айтамыз.',
    ],
    note: 'Өзіңіз жібермейінше, біз деректеріңізді көрмейміз.',
  },
  form: {
    label: 'Файлды алу',
    title: 'Байланысыңызды қалдырыңыз — сілтеме бірден шығады',
    sub: 'Байланыс қажет болса, есепті тегін талдауға келісу үшін керек.',
    name: 'Аты',
    namePh: 'Асқар',
    phone: 'Телефон / Telegram',
    phonePh: '+7 700 000 0000',
    email: 'Email',
    emailPh: 'name@company.kz',
    company: 'Компания',
    companyPh: '«Компания» ЖШС',
    config: 'Сізде қандай 1С',
    configs: ['БухКз 3.0', 'КА 2.4', 'Басқа'],
    submit: 'Файлды алу',
    sending: 'Жіберілуде…',
    error: 'Өтінімді жіберу мүмкін болмады. Қайталап көріңіз немесе бізге Telegram-да жазыңыз.',
    doneTitle: 'Файл дайын',
    doneSub: 'Өңдеуді жүктеп алып, 1С-те ашыңыз.',
    download: 'Өңдеуді жүктеп алу (.epf)',
    doneSteps: [
      '1С-те: «Файл → Открыть» → жүктелген файлды таңдаңыз.',
      'Қауіпсіздік ескертуі шықса — ашуды растаңыз.',
      'Ұйым мен кезеңді таңдап, «Проверить» түймесін басыңыз.',
      'Табылғандарды талдағыңыз келсе, толық есепті PDF немесе Excel-ге сақтап, бізге жіберіңіз.',
    ],
    ref: 'Өтініш нөмірі',
    again: 'Тағы бір өтінім жіберу',
  },
};

const en = {
  hero: {
    label: 'Free · external data processor .epf',
    title: 'Free express check of your 1C database',
    configs: [
      '1C:Accounting for Kazakhstan 3.0',
      '1C:Complex Automation for Kazakhstan 2.4',
    ],
    sub: 'A single external data processor (.epf). Open it via File → Open («Файл → Открыть») and within a couple of minutes it shows the accounting problems that cost money — with amounts and the full list of documents for every check.',
    ctaPrimary: 'Get the file',
    ctaSecondary: 'What it checks',
  },
  checks: {
    label: 'What it checks',
    title: 'Six checks',
    sub: 'Next to each one is the Tinker product that takes the task over for good, not once a quarter.',
    productLabel: 'Covered by',
    items: [
      {
        title: 'E-invoices (ESF)',
        points: [
          'Sales with no e-invoice issued, or with an e-invoice in error.',
          'Separately — those already past the issuing deadline: 15 calendar days after the turnover date.',
        ],
        product: 'ESF controller',
      },
      {
        title: 'Overdue receivables',
        points: [
          'Customer debt broken down by document: payments settle the oldest first.',
          'Due date — by contract or by payment date.',
        ],
        product: 'Receivables',
      },
      {
        title: 'Waybills (SNT) and the virtual warehouse',
        points: [
          'SNT in error or rejected.',
          'Shipments of virtual-warehouse goods without a valid SNT.',
          'Negative virtual-warehouse balances.',
          'All based on data already loaded into 1C.',
        ],
        product: 'Virtual warehouse & SNT control',
      },
      {
        title: 'Bank receipts',
        points: [
          'Receipts not posted.',
          'Receipts without a counterparty — unidentified.',
          'Customer payments without a contract.',
        ],
        product: 'Bank posting robot',
      },
      {
        title: 'Counterparty IIN/BIN',
        points: [
          'Counterparties with turnover but no IIN/BIN.',
          'Counterparties with an invalid IIN/BIN: 12 digits and the check digit are verified.',
        ],
        product: 'Counterparty check',
      },
      {
        title: 'Mutual settlements',
        points: [
          'A counterparty owes you while you owe them.',
          'Debt under one contract, advance under another.',
          'Candidates for a reconciliation statement and offset.',
        ],
        product: 'Reconciliation statements',
      },
    ],
    productsLink: 'All 1C products',
  },
  safety: {
    label: 'Safety',
    title: 'Read-only',
    items: [
      { icon: 'lock', title: 'Writes nothing to the database', text: 'The processor only reads data: documents, catalogs and registers stay as they were.' },
      { icon: 'offline', title: 'No internet access', text: 'Sends nothing anywhere. The report stays on your screen.' },
      { icon: 'shield', title: 'Safe mode', text: 'Runs in safe mode, installs no extensions and does not change the configuration.' },
      { icon: 'code', title: 'Open source code', text: 'The source code is not locked — you can open and read it in the Designer.' },
    ],
  },
  howto: {
    label: 'How to run it',
    title: 'Three steps',
    steps: [
      { title: 'Download the file', text: 'The link appears right after the request form below.' },
      {
        title: 'Open it in 1C',
        text: 'File → Open («Файл → Открыть») → choose the file. If 1C shows a security warning, confirm opening. You need the right to open external data processors; usually the administrator has it.',
      },
      {
        title: 'Choose the company and period',
        text: 'The last 3 months by default. Press «Проверить» (Check).',
      },
    ],
  },
  report: {
    label: 'What to do with the report',
    title: 'The report is yours',
    items: [
      '«Показать все» (Show all) opens the full list of findings for each check right in 1C; double-click opens the document itself.',
      'Save the full report — the summary and every document found — with the «Сохранить в Excel» or «Сохранить в PDF» button.',
      'Send it to us for a free consultation — we will go through the findings and tell you what can be automated.',
    ],
    note: 'We do not see your data unless you send it to us yourself.',
  },
  form: {
    label: 'Get the file',
    title: 'Leave a contact — the link appears right away',
    sub: 'We need a contact to arrange a free review of the report, if you want one.',
    name: 'Name',
    namePh: 'Alex',
    phone: 'Phone / Telegram',
    phonePh: '+7 700 000 0000',
    email: 'Email',
    emailPh: 'name@company.kz',
    company: 'Company',
    companyPh: 'Company LLP',
    config: 'Which 1C do you use',
    configs: ['Accounting KZ 3.0', 'Complex Automation 2.4', 'Other'],
    submit: 'Get the file',
    sending: 'Sending…',
    error: 'Could not send the request. Please try again or message us on Telegram.',
    doneTitle: 'The file is ready',
    doneSub: 'Download the processor and open it in 1C.',
    download: 'Download the processor (.epf)',
    doneSteps: [
      'In 1C: File → Open («Файл → Открыть») → choose the downloaded file.',
      'If a security warning appears, confirm opening.',
      'Choose the company and period and press «Проверить» (Check).',
      'Save the full report to PDF or Excel and send it to us if you want the findings reviewed.',
    ],
    ref: 'Request number',
    again: 'Send another request',
  },
};

export const PROVERKA_TEXT = { ru, kz, en };
