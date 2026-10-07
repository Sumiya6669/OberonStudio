/**
 * Тексты страницы /bezopasnost — как продукты Tinker обращаются с базой 1С.
 *
 * Каждое утверждение сверено по коду продуктов (папка «Products for AI Tinker»,
 * 08.10.2026): Общее/onec/core/Обновление.bsl (подпись Ed25519, https, запрет
 * понижения версии, автооткат, окна заморозки), Ядро.bsl (ЗащищенноеСоединение
 * с сертификатами ОС, ЗаписатьСекрет → безопасное хранилище БСП, проверка
 * администратора), Общее/onec/tinker_ext.py (роли <Префикс>_БазовыеПрава и
 * _ПолныеПрава, регламенты собираются выключенными), агенты продуктов
 * (Агент.bsl: что и как создаётся), сайт — vercel.json и api/_guard.js.
 *
 * Чего здесь нет и быть не должно: сертификаций, аудитов третьих сторон,
 * «банковского уровня защиты» — ничего такого не было. Слабые места названы
 * прямо: PDF-выписка уходит в Claude целиком, обычные настройки продукта
 * меняет любой, у кого есть роль продукта.
 *
 * Казахский текст — первый вариант, требует вычитки носителем.
 */

const ru = {
  label: 'Безопасность',
  title: 'Что продукты Tinker делают с вашей базой 1С',
  sub: 'Коротко и без жаргона: что меняется в базе, что из неё уходит наружу и кто чем управляет. Только то, что сделано в коде продуктов.',
  sections: [
    {
      icon: 'layers',
      title: 'Типовая конфигурация остаётся типовой',
      points: [
        'Каждый продукт — отдельное расширение 1С. Объекты типовой конфигурации не изменяются: у расширения свои обработки, отчёты и регистры.',
        'Снимать конфигурацию с поддержки не нужно.',
        'Честно об установке: для расширения нужно снять флажки «Безопасный режим» и «Защита от опасных действий». Говорим об этом заранее.',
      ],
    },
    {
      icon: 'file',
      title: 'Что продукты записывают в базу',
      points: [
        'Антикамералка, Контроль ВС и СНТ, Проверка контрагента, Маркировка, Дебиторка и Пульт типовые документы не создают и не меняют: читают базу и пишут только в свои регистры.',
        'ИИ-разбор первички, Импорт ЕАЭС, Kaspi и Акты сверки создают документы только по кнопке пользователя и черновиками — без проведения. Письмо с актом сверки уходит только после вашего подтверждения.',
        'ЭСФ-агент по вашей команде создаёт счёт-фактуру и черновик ЭСФ. В КА счёт-фактура проводится. Подписываете и отправляете ЭСФ вы, своей ЭЦП.',
        'Робот разноски создаёт банковские документы по выписке, по умолчанию без проведения. Автопроведение включается настройкой — только для выбранных видов операций и только уверенных совпадений; спорное не проводится никогда. Выписки с почты загружаются только черновиками.',
      ],
    },
    {
      icon: 'send',
      title: 'Что уходит из базы наружу',
      points: [
        'По умолчанию — ничего: регламентные задания поставляются выключенными, связь с внешним сервисом появляется только после того, как администратор введёт его токен или ключ.',
        'Telegram — если указаны бот и чат: сводки с названием находки, контрагентом и суммой.',
        'Claude (ИИ Anthropic) — если задан ключ ИИ. ИИ-разбор первички отправляет файл документа, Акты сверки — текст письма и вложения; оба — только при отмеченном согласии. Робот разноски для подсказки по операции отправляет назначение, сумму, дату, КНП и наименование второй стороны, без БИН/ИИН и счетов; выписку в PDF или Excel он отправляет целиком.',
        'Telegram и Claude — сервисы за пределами Казахстана.',
        'Сервер обновлений Tinker получает ключ клиента и версию конфигурации. Данные базы и БИН не передаются.',
        'Отчёты о сбоях — только если вы их включили: имя расширения, версии и текст ошибки, из которого вычищены числа от пяти цифр, почта и токены.',
        'Госсервисы и Kaspi: Проверка контрагента отправляет ИИН/БИН на портал КГД, Маркировка читает коды в ИС МПТ, Kaspi читает заказы. Пульт по умолчанию кладёт снимок в папку обмена, через сервер Tinker — только если выбран такой канал.',
        'Скрытой телеметрии нет.',
      ],
    },
    {
      icon: 'refresh',
      title: 'Обновления',
      points: [
        'Каждое обновление подписано цифровой подписью Ed25519. Расширение проверяет подпись, контрольную сумму SHA-256, размер и версию файла до установки.',
        'Адрес сервера обновлений и ключ проверки подписи зашиты в сборку расширения — подменить их в настройках нельзя. Связь — только по HTTPS.',
        'Откат на более старую версию запрещён. Если новая версия за шесть часов не заработала, прежняя возвращается автоматически.',
        'В дни сдачи отчётности (с 15 по 25 число, в феврале, мае, августе и ноябре — с 10-го) автообновление не ставится. Включает автообновление администратор.',
      ],
    },
    {
      icon: 'users',
      title: 'Кто чем управляет',
      points: [
        'В каждом продукте две роли: пользователь и администратор продукта.',
        'Обновить, откатить версию, ввести или сменить ключи и токены может только администратор — это проверяется в коде, а не только в интерфейсе.',
        'Рабочие настройки продукта (например, режим автопроведения в Роботе разноски) доступны тем, у кого есть роль продукта. Назначайте её тем, кому доверяете это решение.',
      ],
    },
    {
      icon: 'lock',
      title: 'Соединения, ключи и журнал',
      points: [
        'Все внешние запросы — по HTTPS с проверкой сертификата сервера по корневым сертификатам Windows.',
        'Токены и ключи хранятся в безопасном хранилище БСП, а не в константах; на экране показываются звёздочками.',
        'Журнал предупреждений связан цепочкой SHA-256: правка или удаление записи задним числом заметны. События пишутся и в журнал регистрации 1С.',
      ],
    },
    {
      icon: 'globe',
      title: 'Этот сайт',
      points: [
        'Формы заявок, отзывы и чат ограничены по частоте запросов — против спама и перебора.',
        'Заголовки безопасности: политика содержимого (CSP), запрет встраивания сайта в чужие страницы, nosniff, Referrer-Policy и Permissions-Policy.',
        'Какие персональные данные собирает сайт и где они хранятся — в Политике обработки персональных данных.',
      ],
    },
  ],
  privacyLink: 'Политика обработки персональных данных',
  ctaTitle: 'Остались вопросы о вашей базе?',
  ctaText: 'Начните с бесплатной экспресс-проверки: она только читает базу и не выходит в интернет.',
  ctaCheck: 'Проверить базу бесплатно',
  ctaContact: 'Задать вопрос',
};

const kz = {
  label: 'Қауіпсіздік',
  title: 'Tinker өнімдері сіздің 1С базаңызбен не істейді',
  sub: 'Қысқа әрі жаргонсыз: базада не өзгереді, одан сыртқа не кетеді және кім неге жауап береді. Тек өнімдердің кодында жасалғаны.',
  sections: [
    {
      icon: 'layers',
      title: 'Типтік конфигурация типтік күйінде қалады',
      points: [
        'Әр өнім — жеке 1С кеңейтуі. Типтік конфигурацияның объектілері өзгермейді: кеңейтудің өз өңдеулері, есептері мен тізілімдері бар.',
        'Конфигурацияны қолдаудан шығарудың қажеті жоқ.',
        'Орнату туралы шынын айтсақ: кеңейту үшін «Безопасный режим» және «Защита от опасных действий» белгілерін алып тастау керек. Бұл туралы алдын ала айтамыз.',
      ],
    },
    {
      icon: 'file',
      title: 'Өнімдер базаға не жазады',
      points: [
        'Антикамералка, ВС және ТІЖ бақылауы, Контрагентті тексеру, Таңбалау, Дебиторлық берешек және Пульт типтік құжаттарды жасамайды және өзгертпейді: базаны оқиды және тек өз тізілімдеріне жазады.',
        'Бастапқы құжаттарды ИИ-талдау, ЕАЭО импорты, Kaspi және Салыстыру актілері құжаттарды тек пайдаланушының батырмасы бойынша және жоба ретінде — өткізбей жасайды. Салыстыру актісі бар хат тек сіз растағаннан кейін жіберіледі.',
        'ЭШФ-агент сіздің пәрменіңіз бойынша шот-фактура мен ЭШФ жобасын жасайды. КА-да шот-фактура өткізіледі. ЭШФ-ке сіз өз ЭЦҚ-ңызбен қол қойып, жібересіз.',
        'Банк тарату роботы үзінді көшірме бойынша банк құжаттарын жасайды, әдепкі бойынша өткізбей. Автоматты өткізу баптаумен қосылады — тек таңдалған операция түрлері мен сенімді сәйкестіктер үшін; даулы операция ешқашан өткізілмейді. Поштадан келген үзінді көшірмелер тек жоба ретінде жүктеледі.',
      ],
    },
    {
      icon: 'send',
      title: 'Базадан сыртқа не кетеді',
      points: [
        'Әдепкі бойынша — ештеңе: регламенттік тапсырмалар өшірулі күйде жеткізіледі, сыртқы сервиспен байланыс әкімші оның токенін немесе кілтін енгізгеннен кейін ғана пайда болады.',
        'Telegram — бот пен чат көрсетілсе: табылған мәселенің атауы, контрагент және сомасы бар жиынтықтар.',
        'Claude (Anthropic ИИ) — ИИ кілті берілсе. Бастапқы құжаттарды ИИ-талдау құжат файлын, Салыстыру актілері хат мәтіні мен тіркемелерді жібереді; екеуі де тек келісім белгіленгенде. Банк тарату роботы операция бойынша кеңес алу үшін төлем мақсатын, соманы, күнді, ТМБК мен екінші тараптың атауын жібереді, БСН/ЖСН мен шоттарсыз; PDF немесе Excel үзінді көшірмесін толығымен жібереді.',
        'Telegram мен Claude — Қазақстаннан тыс сервистер.',
        'Tinker жаңарту серверіне клиент кілті мен конфигурация нұсқасы ғана беріледі. База деректері мен БСН берілмейді.',
        'Ақаулар туралы есептер — тек сіз қоссаңыз: кеңейту атауы, нұсқалар және бес және одан көп цифрлы сандар, пошта мен токендер тазартылған қате мәтіні.',
        'Мемлекеттік сервистер мен Kaspi: Контрагентті тексеру ЖСН/БСН-ды МКК порталына жібереді, Таңбалау ТАЖ-дағы кодтарды оқиды, Kaspi тапсырыстарды оқиды. Пульт әдепкі бойынша суретті алмасу қалтасына салады, Tinker сервері арқылы — тек осындай арна таңдалса.',
        'Жасырын телеметрия жоқ.',
      ],
    },
    {
      icon: 'refresh',
      title: 'Жаңартулар',
      points: [
        'Әр жаңартуға Ed25519 цифрлық қолтаңбасы қойылған. Кеңейту орнатпас бұрын қолтаңбаны, SHA-256 бақылау сомасын, файлдың өлшемі мен нұсқасын тексереді.',
        'Жаңарту серверінің мекенжайы мен қолтаңбаны тексеру кілті кеңейту жинағына енгізілген — оларды баптауда ауыстыруға болмайды. Байланыс — тек HTTPS арқылы.',
        'Ескі нұсқаға қайту тыйым салынған. Жаңа нұсқа алты сағат ішінде жұмыс істемесе, алдыңғысы автоматты түрде қайтарылады.',
        'Есеп тапсыру күндерінде (айдың 15-інен 25-іне дейін, ақпан, мамыр, тамыз және қарашада — 10-ынан бастап) автожаңарту орнатылмайды. Автожаңартуды әкімші қосады.',
      ],
    },
    {
      icon: 'users',
      title: 'Кім неге жауап береді',
      points: [
        'Әр өнімде екі рөл бар: пайдаланушы және өнім әкімшісі.',
        'Жаңарту, нұсқаны қайтару, кілттер мен токендерді енгізу немесе ауыстыру тек әкімшіге рұқсат — бұл интерфейсте ғана емес, кодта тексеріледі.',
        'Өнімнің жұмыс баптаулары (мысалы, Банк тарату роботындағы автоматты өткізу режимі) өнім рөлі барларға қолжетімді. Бұл рөлді осы шешімді сеніп тапсыратын адамдарға беріңіз.',
      ],
    },
    {
      icon: 'lock',
      title: 'Байланыс, кілттер және журнал',
      points: [
        'Барлық сыртқы сұраулар — сервер сертификатын Windows түбірлік сертификаттары бойынша тексеретін HTTPS арқылы.',
        'Токендер мен кілттер тұрақтыларда емес, БСП қауіпсіз қоймасында сақталады; экранда жұлдызшамен көрсетіледі.',
        'Ескертулер журналы SHA-256 тізбегімен байланысқан: жазбаны кейін түзету немесе жою байқалады. Оқиғалар 1С тіркеу журналына да жазылады.',
      ],
    },
    {
      icon: 'globe',
      title: 'Осы сайт',
      points: [
        'Өтінім формалары, пікірлер және чат сұрау жиілігі бойынша шектелген — спам мен іріктеуге қарсы.',
        'Қауіпсіздік тақырыптары: мазмұн саясаты (CSP), сайтты бөгде беттерге ендіруге тыйым, nosniff, Referrer-Policy және Permissions-Policy.',
        'Сайт қандай дербес деректерді жинайды және оларды қайда сақтайды — Дербес деректерді өңдеу саясатында.',
      ],
    },
  ],
  privacyLink: 'Дербес деректерді өңдеу саясаты',
  ctaTitle: 'Базаңыз туралы сұрақтар қалды ма?',
  ctaText: 'Тегін жедел тексеруден бастаңыз: ол базаны тек оқиды және интернетке шықпайды.',
  ctaCheck: 'Базаны тегін тексеру',
  ctaContact: 'Сұрақ қою',
};

const en = {
  label: 'Security',
  title: 'What Tinker products do with your 1C database',
  sub: 'Briefly and without jargon: what changes in the database, what leaves it and who controls what. Only what is actually implemented in the product code.',
  sections: [
    {
      icon: 'layers',
      title: 'The standard configuration stays standard',
      points: [
        'Each product is a separate 1C extension. Objects of the standard configuration are not changed: the extension has its own processors, reports and registers.',
        'You do not need to take the configuration off vendor support.',
        'To be upfront about installation: the extension needs the «Безопасный режим» (safe mode) and «Защита от опасных действий» (unsafe action protection) flags cleared. We say so in advance.',
      ],
    },
    {
      icon: 'file',
      title: 'What the products write to the database',
      points: [
        'Antikameralka, VS & SNT control, Counterparty check, Marking, Receivables and the Console do not create or change standard documents: they read the database and write only to their own registers.',
        'AI document recognition, EAEU import, Kaspi and Reconciliation acts create documents only when a user presses the button, and as drafts — not posted. A reconciliation e-mail is sent only after you confirm it.',
        'The ESF agent creates an invoice and an ESF draft on your command. In Complex Automation the invoice is posted. You sign and send the ESF yourself, with your own digital signature.',
        'The bank posting robot creates bank documents from the statement, unposted by default. Auto-posting is turned on in settings — only for the operation types you choose and only for confident matches; disputed items are never posted. Statements from e-mail are loaded only as drafts.',
      ],
    },
    {
      icon: 'send',
      title: 'What leaves the database',
      points: [
        'By default — nothing: scheduled jobs ship disabled, and a connection to an external service appears only after an administrator enters its token or key.',
        'Telegram — if a bot and chat are set: digests with the finding, counterparty and amount.',
        'Claude (Anthropic AI) — if an AI key is set. AI document recognition sends the document file, Reconciliation acts send the e-mail text and attachments; both only with the consent box ticked. The bank robot sends the payment purpose, amount, date, KNP code and the other party’s name to suggest an operation, without BIN/IIN or accounts; a PDF or Excel statement is sent in full.',
        'Telegram and Claude are services outside Kazakhstan.',
        'The Tinker update server receives the client key and the configuration version. Database data and the BIN are not sent.',
        'Crash reports — only if you turn them on: extension name, versions and the error text with numbers of five or more digits, e-mails and tokens removed.',
        'Government services and Kaspi: Counterparty check sends the IIN/BIN to the State Revenue portal, Marking reads codes in the marking system, Kaspi reads orders. The Console puts its snapshot into an exchange folder by default, and goes through the Tinker server only if you choose that channel.',
        'No hidden telemetry.',
      ],
    },
    {
      icon: 'refresh',
      title: 'Updates',
      points: [
        'Every update is signed with an Ed25519 digital signature. Before installing, the extension checks the signature, the SHA-256 checksum, the file size and the version.',
        'The update server address and the signature key are built into the extension — they cannot be swapped in settings. Connection is HTTPS only.',
        'Rolling back to an older version is not allowed. If a new version does not start working within six hours, the previous one is restored automatically.',
        'On reporting days (15th to 25th of the month; in February, May, August and November from the 10th) automatic updates are not installed. An administrator turns automatic updates on.',
      ],
    },
    {
      icon: 'users',
      title: 'Who controls what',
      points: [
        'Each product has two roles: user and product administrator.',
        'Only an administrator can update, roll back, or enter and change keys and tokens — this is checked in code, not just hidden in the interface.',
        'Working settings of a product (for example, the auto-posting mode of the bank robot) are available to anyone with the product role. Give it to people you trust with that decision.',
      ],
    },
    {
      icon: 'lock',
      title: 'Connections, keys and log',
      points: [
        'All external requests use HTTPS with the server certificate checked against the Windows root certificates.',
        'Tokens and keys are kept in the secure storage of the 1C Standard Subsystems Library (BSP), not in constants, and are shown as asterisks on screen.',
        'The warning log is chained with SHA-256: editing or deleting an entry after the fact is visible. Events are also written to the 1C event log.',
      ],
    },
    {
      icon: 'globe',
      title: 'This website',
      points: [
        'Request forms, reviews and the chat are rate-limited against spam and brute force.',
        'Security headers: Content Security Policy, a ban on embedding the site in other pages, nosniff, Referrer-Policy and Permissions-Policy.',
        'What personal data the site collects and where it is stored is described in the personal data policy.',
      ],
    },
  ],
  privacyLink: 'Personal data policy',
  ctaTitle: 'Questions about your database?',
  ctaText: 'Start with the free express check: it only reads the database and never goes online.',
  ctaCheck: 'Check your database for free',
  ctaContact: 'Ask a question',
};

export const SECURITY_TEXT = { ru, kz, en };
