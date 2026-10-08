/**
 * «Статьи экспертов» — авторские материалы длиннее разборов /1c.
 *
 * Где лежат. Одна статья — один файл в src/lib/content/articles/*.js.
 * Файлы подхватываются сами (import.meta.glob): чтобы добавить статью,
 * достаточно положить файл, и следующая сборка соберёт страницу, карту
 * сайта и llms.txt. Шаблон и порядок — README-admin.md, «Статьи экспертов».
 *
 * Почему файлы, а не таблица CMS. Статья длинная, в ней ссылки на нормы и
 * её читает автор до выкладки — удобнее вычитать один файл в репозитории,
 * чем поля в панели. Разборы /1c по-прежнему живут в CMS.
 *
 * Адрес статьи — /stati/<slug>, без языковой приставки: статья на языке
 * оригинала (поле lang), перевода нет, и hreflang у неё не ставится — как
 * у разборов /1c. Список /stati — на трёх языках интерфейса.
 *
 * Поля статьи:
 *   slug        — латиницей через дефис, он же адрес;
 *   lang        — 'ru' | 'kz' | 'en', язык текста;
 *   title       — заголовок;
 *   description — 1–2 предложения: подзаголовок, карточка и описание для поиска;
 *   author      — ключ из src/lib/content/authors.js;
 *   publishedAt — 'ГГГГ-ММ-ДД'; updatedAt — дата последней правки по существу;
 *   tags        — 2–4 коротких метки;
 *   body        — текст в упрощённой разметке (см. ArticleBody.jsx):
 *                 абзацы через пустую строку, «## » и «### » — подзаголовки,
 *                 «- » — список, «1. » — нумерованный, «> » — врезка,
 *                 **жирный**, [текст](/адрес);
 *   sources     — [{ label, url? }] — откуда факты; выводятся под статьёй;
 *   related     — { answers: [slug разборов /1c], products: [id продуктов] };
 *   draft       — true: статья не собирается и не попадает в списки.
 */

const files = import.meta.glob('./articles/*.js', { eager: true });

const REQUIRED = ['slug', 'title', 'description', 'author', 'publishedAt', 'body'];

/** Все опубликованные статьи, новые сверху. */
export const ARTICLES = Object.values(files)
  .map((mod) => mod.default)
  .filter((a) => a && !a.draft && REQUIRED.every((key) => a[key]))
  .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

export const ARTICLES_PATH = '/stati';

export const articlePath = (slug) => `${ARTICLES_PATH}/${slug}`;

export function getArticle(slug) {
  return ARTICLES.find((a) => a.slug === slug) || null;
}

/** Слова текста без разметки — для времени чтения и wordCount в разметке. */
export function wordCount(article) {
  const text = String(article?.body || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*\-–—]/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Минуты чтения. 180 слов в минуту — спокойное чтение текста с нормами
 * и названиями отчётов, а не беглый просмотр. Меньше минуты не бывает.
 */
export function readingMinutes(article) {
  return Math.max(1, Math.round(wordCount(article) / 180));
}

/**
 * «Читайте также»: сначала статьи с общими метками, потом остальные
 * по дате. Сама статья в список не попадает.
 */
export function relatedArticles(article, limit = 3) {
  const tags = new Set(article?.tags || []);
  return ARTICLES
    .filter((a) => a.slug !== article?.slug)
    .map((a) => ({ a, common: (a.tags || []).filter((t) => tags.has(t)).length }))
    .sort((x, y) => y.common - x.common
      || String(y.a.publishedAt).localeCompare(String(x.a.publishedAt)))
    .slice(0, limit)
    .map(({ a }) => a);
}

/** Дата для людей: «9 октября 2026». */
export function formatDate(value, lang = 'ru') {
  if (!value) return '';
  const locale = lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-GB' : 'ru-RU';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
  } catch {
    return value;
  }
}

/** Подписи интерфейса раздела на трёх языках. */
export const ARTICLES_UI = {
  ru: {
    label: 'Статьи экспертов',
    title: 'Статьи экспертов',
    sub: 'Авторские материалы о 1С и учёте в Казахстане: подробнее, чем разборы отдельных ошибок, — с нормами, которые сверены с источником, и тем, что проверить в своей базе.',
    by: 'Автор',
    minutes: (n) => `${n} мин чтения`,
    read: 'Читать',
    empty: 'Статьи готовятся.',
    origLang: '',
    becomeTitle: 'Пишете о бухгалтерии и 1С в Казахстане?',
    becomeText: 'Станьте автором раздела. Нужны практические тексты: что изменилось, где это видно в 1С и что проверить. Факты — со ссылкой на норму или источник; перед публикацией текст вычитывается вместе с вами.',
    becomeCta: 'Предложить статью',
    answersTitle: 'Разборы конкретных ошибок 1С',
    answersText: 'Короткие ответы на один вопрос: не проводится документ, не грузится выписка, ошибка ЭСФ.',
    answersCta: 'Ответы по 1С',
    home: 'Главная',
    alsoRead: 'Читайте также',
    alsoAnswers: 'Разборы по теме',
    sources: 'Источники',
    updated: 'обновлено',
    ctaTitle: 'Проверить свою базу',
    ctaText: 'Бесплатная экспресс-проверка — внешняя обработка .epf для БухКз 3.0 и КА 2.4. Только читает базу, в интернет не выходит и за пару минут показывает ЭСФ без выписки, просроченную дебиторку, ошибки СНТ и ВС, неразнесённый банк.',
    ctaCheck: 'Проверить базу бесплатно',
    ctaProducts: 'Продукты для 1С',
    products: 'Постоянно это берут на себя',
    disclaimer: 'Статья — не налоговая консультация. Спорные случаи решает главный бухгалтер; редакцию норм проверяйте на adilet.zan.kz.',
  },
  kz: {
    label: 'Сарапшылар мақалалары',
    title: 'Сарапшылар мақалалары',
    sub: 'Қазақстандағы 1С және есеп туралы авторлық материалдар: жеке қателерді талдаудан толығырақ — дереккөзбен салыстырылған нормалармен және өз базаңызда нені тексеру керектігімен. Мақалалар түпнұсқа тілінде.',
    by: 'Автор',
    minutes: (n) => `${n} мин оқу`,
    read: 'Оқу',
    empty: 'Мақалалар дайындалуда.',
    origLang: 'орысша',
    becomeTitle: 'Қазақстандағы бухгалтерия және 1С туралы жазасыз ба?',
    becomeText: 'Бөлімнің авторы болыңыз. Практикалық мәтіндер керек: не өзгерді, оны 1С-те қайдан көруге болады және нені тексеру керек. Деректер — нормаға немесе дереккөзге сілтемемен; жариялау алдында мәтін сізбен бірге тексеріледі.',
    becomeCta: 'Мақала ұсыну',
    answersTitle: '1С-тегі нақты қателерді талдау',
    answersText: 'Бір сұраққа қысқа жауаптар: құжат өткізілмейді, үзінді жүктелмейді, ЭШФ қатесі. Орыс тілінде.',
    answersCta: '1С бойынша жауаптар',
    home: 'Басты бет',
  },
  en: {
    label: 'Expert articles',
    title: 'Expert articles',
    sub: 'In-depth pieces on 1C and accounting in Kazakhstan: longer than our single-issue fixes, with rules checked against the source and what to verify in your own database. Articles are published in their original language.',
    by: 'Author',
    minutes: (n) => `${n} min read`,
    read: 'Read',
    empty: 'Articles are on the way.',
    origLang: 'in Russian',
    becomeTitle: 'Do you write about accounting and 1C in Kazakhstan?',
    becomeText: 'Become an author. We are looking for practical texts: what changed, where it shows up in 1C and what to check. Facts come with a reference to the rule or source; the text is proofread together with you before publication.',
    becomeCta: 'Propose an article',
    answersTitle: 'Fixes for specific 1C problems',
    answersText: 'Short answers to one question each: a document will not post, a bank statement will not load, an e-invoice error. In Russian.',
    answersCta: '1C answers',
    home: 'Home',
  },
};

/** Подписи страницы статьи — по языку самой статьи, с русскими по умолчанию. */
export const articleUi = (lang) => ({ ...ARTICLES_UI.ru, ...(ARTICLES_UI[lang] || {}) });
