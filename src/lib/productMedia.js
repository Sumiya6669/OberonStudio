/**
 * Наглядные материалы к продуктам: экран 1С, сообщение в Telegram, ролик.
 *
 * Ключ — id продукта (src/lib/content/site.js, он же slug в панели). Файлы
 * лежат в public/media/products/<id>/ и отдаются с того же домена — CSP
 * (img-src и media-src 'self') ничего дополнительно не разрешает.
 *
 * Откуда файлы (репозиторий продуктов, папка «ИИ-маркетолог»):
 *  - экран 1С — НАСТОЯЩЕЕ окно формы продукта в 1С:Бухгалтерии для
 *    Казахстана на тестовой копии базы (media/shoot1c.py); служебные поля
 *    настроек на снимке скрыты, данные вымышленные;
 *  - Telegram — тот самый HTML-дайджест, который продукт отправляет, взятый
 *    из 1С на тех же данных; 12-значные номера закрыты точками;
 *  - видео — video/render_products.py: без голоса, крупные субтитры.
 * На каждой картинке есть пометка «Пример · вымышленные данные».
 *
 * width/height — настоящие размеры файлов: браузер резервирует место
 * заранее, и вёрстка не прыгает, пока картинка грузится.
 */

const t = (ru, kz, en) => ({ ru, kz, en });

const SHOT = { width: 1316, height: 880, smallWidth: 720 };
const VIDEO = { width: 720, height: 720 };
// экран «Закрытие месяца» пульта — настоящий размер файла screen-close-1c.webp
const CLOSE_SHOT = { width: 1316, height: 880 };

const NOTE_1C = t(
  'Настоящий экран 1С:Бухгалтерии для Казахстана на тестовой базе. Данные вымышленные.',
  '1С:Қазақстанға арналған Бухгалтерияның нақты экраны, тестілік база. Деректер ойдан алынған.',
  'A real 1C:Accounting for Kazakhstan screen on a test database. The data is fictional.',
);
const NOTE_TG = t(
  'Сообщение собрано из настоящего дайджеста, который продукт отправляет в Telegram. Данные вымышленные.',
  'Хабар өнім Telegram-ға жіберетін нақты дайджесттен жасалған. Деректер ойдан алынған.',
  'Built from the real digest the product sends to Telegram. The data is fictional.',
);
const NOTE_VIDEO = t(
  'Ролик без звука: всё сказано субтитрами на экране.',
  'Бейне дыбыссыз: бәрі экрандағы субтитрлерде.',
  'No sound: everything is in the on-screen captions.',
);

/**
 * extraScreens — дополнительные экраны 1С продукта ПЕРЕД основным: { file, width, height, alt, caption }
 * (file — имя без расширения в public/media/products/<id>/, рядом лежит <file>-720.webp).
 */
function entry(id, { screen, telegram, video, tgHeight, extraScreens = [] }) {
  const base = `/media/products/${id}`;
  return {
    screens: [...extraScreens.map((x) => ({
      src: `${base}/${x.file}.webp`,
      srcSmall: `${base}/${x.file}-720.webp`,
      width: x.width,
      height: x.height,
      smallWidth: SHOT.smallWidth,
      alt: x.alt,
      caption: x.caption,
      note: NOTE_1C,
    })), {
      src: `${base}/screen-1c.webp`,
      srcSmall: `${base}/screen-1c-720.webp`,
      ...SHOT,
      alt: screen.alt,
      caption: screen.caption,
      note: NOTE_1C,
    }],
    telegram: {
      src: `${base}/telegram.webp`,
      width: 840,
      height: tgHeight,
      alt: telegram.alt,
      caption: telegram.caption,
      note: NOTE_TG,
    },
    video: {
      src: `${base}/video.mp4`,
      poster: `${base}/poster.webp`,
      ...VIDEO,
      caption: video,
      note: NOTE_VIDEO,
    },
  };
}

export const PRODUCT_MEDIA = {
  esf: entry('esf', {
    tgHeight: 3000,
    screen: {
      alt: t(
        'Рабочее место ЭСФ-контролёра в 1С: НДС под риском, сводка и таблица находок с важностью, документом, контрагентом и сроком',
        '1С-тегі ЭСФ-бақылаушы жұмыс орны: тәуекелдегі ҚҚС, қорытынды және табылғандар кестесі',
        'ESF Controller workplace in 1C: VAT at risk, summary and a table of findings with severity, document, counterparty and deadline',
      ),
      caption: t(
        'Рабочее место после «Проверить»: 28 находок, НДС под риском одной цифрой, что сделать по каждой.',
        '«Тексеру» батырмасынан кейін: 28 табылған, тәуекелдегі ҚҚС бір санмен, әрқайсысы бойынша не істеу керек.',
        'After “Check”: 28 findings, VAT at risk as one number, and what to do about each.',
      ),
    },
    telegram: {
      alt: t(
        'Сообщение бота в Telegram: НДС под риском, счётчики по важности, список проверок и что сделать в первую очередь',
        'Telegram-дағы бот хабары: тәуекелдегі ҚҚС, маңыздылық бойынша санағыштар және бірінші кезекте не істеу керек',
        'Bot message in Telegram: VAT at risk, counts by severity, checks and what to do first',
      ),
      caption: t('Утренняя сводка: что горит и что сделать первым.', 'Таңғы шолу: не жанып тұр және алдымен не істеу керек.', 'Morning digest: what is urgent and what to do first.'),
    },
    video: t('ЭСФ-контролёр за 30 секунд.', 'ЭСФ-бақылаушы 30 секундта.', 'ESF Controller in 30 seconds.'),
  }),

  'bank-robot': entry('bank-robot', {
    tgHeight: 1642,
    screen: {
      alt: t(
        'Рабочее место робота разноски в 1С: банковские документы за неделю со статусом, контрагентом, видом операции, разноской и уверенностью',
        '1С-тегі банк үлестіру роботының жұмыс орны: апталық банк құжаттары, мәртебесі, контрагент, операция түрі және сенімділік',
        'Bank posting robot workplace in 1C: a week of bank documents with status, counterparty, operation type, allocation and confidence',
      ),
      caption: t(
        'После «Подобрать»: 16 документов, уверенные уже отмечены — остаётся «Применить».',
        '«Іріктеу» батырмасынан кейін: 16 құжат, сенімділері белгіленген — «Қолдану» ғана қалды.',
        'After “Match”: 16 documents, the confident ones are ticked — just press “Apply”.',
      ),
    },
    telegram: {
      alt: t(
        'Сообщение бота в Telegram: сколько документов исправить, проверить и не распознано, и список для ручной проверки',
        'Telegram-дағы бот хабары: қанша құжатты түзету, тексеру керек және қолмен тексеруге тізім',
        'Bot message in Telegram: documents to fix, to review and unrecognised, with a list for manual review',
      ),
      caption: t('Что осталось проверить руками — и почему.', 'Қолмен не тексеру қалды — және неге.', 'What is left to check by hand — and why.'),
    },
    video: t('Робот разноски за 30 секунд.', 'Үлестіру роботы 30 секундта.', 'Bank posting robot in 30 seconds.'),
  }),

  receivables: entry('receivables', {
    tgHeight: 1518,
    screen: {
      alt: t(
        'Рабочее место Дебиторки в 1С: должники с долгом, просрочкой, стадией и готовым текстом сообщения',
        '1С-тегі Дебиторка жұмыс орны: қарызы, мерзімі өткені, сатысы және дайын хабар мәтіні бар борышкерлер',
        'Receivables workplace in 1C: debtors with debt, overdue amount, stage and a ready message text',
      ),
      caption: t(
        'Кто должен, насколько просрочил и кому написать сегодня — с готовым текстом.',
        'Кім қарыз, қанша кешіктірді және бүгін кімге жазу керек — дайын мәтінмен.',
        'Who owes, how overdue, and whom to message today — with the text ready.',
      ),
    },
    telegram: {
      alt: t(
        'Сообщение бота в Telegram: долг всего, просрочено, кому написать сегодня и черновики претензий',
        'Telegram-дағы бот хабары: жалпы қарыз, мерзімі өткені, бүгін кімге жазу және талап-арыз жобалары',
        'Bot message in Telegram: total debt, overdue, whom to message today and draft claims',
      ),
      caption: t('Руководитель видит деньги сам, без отчёта от бухгалтера.', 'Басшы ақшаны өзі көреді, бухгалтер есебінсіз.', 'The owner sees the money without waiting for a report.'),
    },
    video: t('Дебиторка за 30 секунд.', 'Дебиторка 30 секундта.', 'Receivables in 30 seconds.'),
  }),

  kaspi: entry('kaspi', {
    tgHeight: 2752,
    screen: {
      alt: t(
        'Рабочее место Kaspi в 1С: итог за период и находки — заказ выдан без реализации, отменён с реализацией, заказов больше остатка',
        '1С-тегі Kaspi жұмыс орны: кезең қорытындысы және табылғандар — іске асырусыз берілген тапсырыс, қалдықтан көп тапсырыс',
        'Kaspi workplace in 1C: period total and findings — order issued without a sale document, cancelled with one, orders above stock',
      ),
      caption: t(
        'Расхождения между Kaspi и 1С — списком, с тем, что сделать по каждому.',
        'Kaspi мен 1С арасындағы айырмашылықтар — тізіммен, әрқайсысы бойынша не істеу керек.',
        'Kaspi vs 1C discrepancies as a list, with what to do about each.',
      ),
    },
    telegram: {
      alt: t(
        'Сообщение бота в Telegram: находки по заказам Kaspi, сумма под риском и что сделать в первую очередь',
        'Telegram-дағы бот хабары: Kaspi тапсырыстары бойынша табылғандар және бірінші кезекте не істеу керек',
        'Bot message in Telegram: Kaspi order findings, amount at risk and what to do first',
      ),
      caption: t('Главное по заказам Kaspi — сводкой.', 'Kaspi тапсырыстары бойынша ең бастысы — шолумен.', 'The key Kaspi order issues in one digest.'),
    },
    video: t('Kaspi ↔ 1С за 30 секунд.', 'Kaspi ↔ 1С 30 секундта.', 'Kaspi ↔ 1C in 30 seconds.'),
  }),

  'akty-sverki': entry('akty-sverki', {
    tgHeight: 612,
    screen: {
      alt: t(
        'Рабочее место актов сверки в 1С: журнал актов со статусами и подробный разбор расхождения по одному контрагенту',
        '1С-тегі салыстыру актілерінің жұмыс орны: мәртебелері бар актілер журналы және бір контрагент бойынша айырмашылықты талдау',
        'Reconciliation workplace in 1C: a log of statements with statuses and a detailed breakdown of one discrepancy',
      ),
      caption: t(
        'Ответ контрагента разобран: чего нет у него, чего нет у нас, где другая сумма.',
        'Контрагент жауабы талданды: онда не жоқ, бізде не жоқ, қай жерде сома басқа.',
        'The reply is parsed: what they are missing, what we are missing, where the amount differs.',
      ),
    },
    telegram: {
      alt: t(
        'Сообщение бота в Telegram: акты по статусам, сумма расхождений и молчащий контрагент',
        'Telegram-дағы бот хабары: мәртебелер бойынша актілер, айырмашылық сомасы және жауап бермеген контрагент',
        'Bot message in Telegram: statements by status, total discrepancy and a silent counterparty',
      ),
      caption: t('Расхождения и молчащие — одним сообщением.', 'Айырмашылықтар мен жауап бермегендер — бір хабарда.', 'Discrepancies and silent counterparties in one message.'),
    },
    video: t('Акты сверки за 30 секунд.', 'Салыстыру актілері 30 секундта.', 'Reconciliation statements in 30 seconds.'),
  }),

  pult: entry('pult', {
    tgHeight: 2052,
    // «Закрытие месяца на автопилоте» (ТнкПульт 1.0.0.9) — главная возможность, поэтому первым экраном
    extraScreens: [{
      file: 'screen-close-1c',
      width: CLOSE_SHOT.width,
      height: CLOSE_SHOT.height,
      alt: t(
        'Закрытие месяца в 1С: клиенты бухгалтерской фирмы красные, жёлтые и зелёные, сначала с ошибками; ниже — проблемы первого клиента с объяснением, что сделать, и примерами документов',
        '1С-тегі ай жабу: бухгалтерлік фирма клиенттері қызыл, сары және жасыл, алдымен қателері барлар; төменде — бірінші клиенттің мәселелері түсіндірмесімен, не істеу керегімен және құжат мысалдарымен',
        'Month-end close in 1C: the firm’s clients in red, yellow and green, errors first; below, the first client’s issues with an explanation, what to do and sample documents',
      ),
      caption: t(
        'Закрытие месяца на автопилоте: кто из клиентов готов, у кого замечания и ошибки — и что сделать по каждой.',
        'Айды автопилотпен жабу: қай клиент дайын, кімде ескертулер мен қателер бар — және әрқайсысы бойынша не істеу керек.',
        'Month-end close on autopilot: which clients are ready, who has warnings or errors, and what to do about each.',
      ),
    }],
    screen: {
      alt: t(
        'Пульт бухгалтерской фирмы в 1С: клиенты с ответственным, числом замечаний, суммой под риском, ближайшим сроком и главным',
        '1С-тегі бухгалтерлік фирма пульті: жауаптысы, ескертулер саны, тәуекелдегі сомасы және жақын мерзімі бар клиенттер',
        'Accounting firm console in 1C: clients with owner, issue counts, amount at risk, nearest deadline and the main issue',
      ),
      caption: t(
        'Все клиентские базы на одном экране, горящие сверху.',
        'Барлық клиент базалары бір экранда, жанып тұрғандары жоғарыда.',
        'All client databases on one screen, the urgent ones on top.',
      ),
    },
    telegram: {
      alt: t(
        'Сообщение бота в Telegram: клиенты по важности, молчащие базы и сумма под риском',
        'Telegram-дағы бот хабары: маңыздылығы бойынша клиенттер, жауап бермейтін базалар және тәуекелдегі сома',
        'Bot message in Telegram: clients by severity, silent databases and amount at risk',
      ),
      caption: t('Утренний дайджест руководителю фирмы.', 'Фирма басшысына таңғы дайджест.', 'Morning digest for the head of the firm.'),
    },
    video: t('Пульт бухфирмы за 30 секунд.', 'Бухфирма пульті 30 секундта.', 'Accounting firm console in 30 seconds.'),
  }),
};

/** Подпись на нужном языке; если перевода нет — русская. */
export const pick = (value, lang) => (value && (value[lang] || value.ru)) || '';

export const MEDIA_UI = {
  open: t('Смотреть в работе', 'Жұмыста көру', 'See it in action'),
  title: t('Как это выглядит', 'Бұл қалай көрінеді', 'What it looks like'),
  tabScreen: t('Экран 1С', '1С экраны', '1C screen'),
  tabTelegram: t('Telegram', 'Telegram', 'Telegram'),
  tabVideo: t('Видео', 'Бейне', 'Video'),
  close: t('Закрыть', 'Жабу', 'Close'),
  example: t('Пример · вымышленные данные', 'Мысал · ойдан алынған деректер', 'Example · fictional data'),
  noVideo: t('Ваш браузер не показывает видео MP4.', 'Браузеріңіз MP4 бейнесін көрсетпейді.', 'Your browser cannot play MP4 video.'),
};
