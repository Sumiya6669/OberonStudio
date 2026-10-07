/**
 * Тексты и расчёт страницы /kalkulyator — «сколько вы теряете».
 *
 * Что здесь можно и чего нельзя. Можно — только сверенное правило продуктов:
 * ЭСФ выписывается не позднее 15 календарных дней после даты оборота (НК РК
 * в редакции с 01.01.2026; так считает ЭСФ-контролёр, esf_control/deadlines.py,
 * ESF_ISSUE_DAYS = 15). Нельзя — суммы штрафов, пени и номера статей: их нет
 * в сверенных нормах продуктов, а калькулятор, который пугает выдуманным
 * штрафом, — недостоверная реклама.
 *
 * Поэтому «сумма под риском» — это не штраф, а оборот: сумма реализаций, по
 * которым ЭСФ может опоздать. Долю таких реализаций и минуты на операцию
 * знает только сам человек — это поля «ваша оценка» с умолчанием.
 *
 * Расчёт идёт в браузере. Данные никуда не отправляются: на странице нет ни
 * формы, ни запроса к серверу.
 *
 * Казахский текст — первый вариант, требует вычитки носителем.
 */

export const ESF_ISSUE_DAYS = 15;

/** Значения по умолчанию: средняя небольшая компания, а не рекорд. */
export const CALC_DEFAULTS = {
  sales: 120,
  avgCheck: 250000,
  bank: 300,
  counterparties: 40,
  minutes: 3,
  lateShare: 5,
};

/** Число из поля ввода: пробелы и запятая допускаются, отрицательное и мусор — 0. */
export function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[\s ]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function calculate(input) {
  const sales = toNumber(input.sales);
  const avgCheck = toNumber(input.avgCheck);
  const bank = toNumber(input.bank);
  const counterparties = toNumber(input.counterparties);
  const minutes = toNumber(input.minutes);
  const share = Math.min(toNumber(input.lateShare), 100) / 100;

  const lateSales = sales * share;
  const atRisk = lateSales * avgCheck;

  const parts = [
    { key: 'sales', ops: sales, hours: (sales * minutes) / 60 },
    { key: 'bank', ops: bank, hours: (bank * minutes) / 60 },
    { key: 'counterparties', ops: counterparties, hours: (counterparties * minutes) / 60 },
  ];
  const hours = parts.reduce((sum, p) => sum + p.hours, 0);

  return { lateSales, atRisk, hours, parts };
}

/** Часы с одной цифрой после запятой: «12,5». */
export const formatHours = (h, lang = 'ru') => {
  const v = Math.round(h * 10) / 10;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return lang === 'en' ? s : s.replace('.', ',');
};

const ru = {
  label: 'Калькулятор · считается у вас в браузере',
  title: 'Сколько вы теряете на ЭСФ и рутине',
  sub: 'Шесть цифр о вашем учёте — и видно, какой оборот под риском из-за ЭСФ, выписанных не вовремя, и сколько часов в месяц уходит на ручную работу.',
  privacy: 'Данные никуда не отправляются: расчёт идёт на этой странице, формы и запроса к серверу здесь нет.',
  inputsTitle: 'Ваши цифры',
  estimate: 'ваша оценка',
  fields: {
    sales: { label: 'Реализаций в месяц', hint: 'документов реализации товаров и услуг' },
    avgCheck: { label: 'Средний чек, ₸', hint: 'средняя сумма одной реализации' },
    bank: { label: 'Банковских платежей в месяц', hint: 'поступления и списания по выписке' },
    counterparties: { label: 'Контрагентов для сверки', hint: 'с кем сверяете расчёты' },
    minutes: { label: 'Минут на одну операцию', hint: 'выписать ЭСФ, разнести платёж, сверить контрагента' },
    lateShare: { label: 'Доля реализаций с ЭСФ не в срок, %', hint: 'какая часть реализаций, по-вашему, остаётся без ЭСФ дольше срока' },
  },
  resultsTitle: 'Результат',
  atRisk: {
    title: 'Сумма под риском',
    unit: '₸ в месяц',
    lateSales: (n) => `≈ ${n} реализаций в месяц без своевременного ЭСФ`,
    note: `Это сумма реализаций, по которым ЭСФ может быть выписан позже ${ESF_ISSUE_DAYS} календарных дней после даты оборота — такой срок установлен Налоговым кодексом РК в редакции с 01.01.2026. Это не штраф и не налог, а оборот, который стоит проверить.`,
  },
  hours: {
    title: 'Часы рутины',
    unit: 'ч в месяц',
    parts: {
      sales: 'ЭСФ по реализациям',
      bank: 'разноска выписки',
      counterparties: 'сверка с контрагентами',
    },
    note: 'Число операций × минуты на операцию. Сколько из этого заберёт автоматизация, зависит от вашей базы — это видно после проверки.',
  },
  formula: 'Как считается: реализации × доля × средний чек; (реализации + платежи + контрагенты) × минуты ÷ 60.',
  ctaCheck: 'Проверить базу бесплатно',
  ctaProducts: 'Подобрать продукт',
  ctaNote: 'Экспресс-проверка покажет не оценку, а настоящие реализации без ЭСФ в вашей базе — с суммами и документами.',
};

const kz = {
  label: 'Калькулятор · есеп сіздің браузеріңізде жүреді',
  title: 'ЭШФ мен күнделікті жұмысқа қанша жоғалтасыз',
  sub: 'Есеп туралы алты сан — және уақытында жазылмаған ЭШФ салдарынан қандай айналым тәуекелде екені, айына қолмен жұмысқа қанша сағат кететіні көрінеді.',
  privacy: 'Деректер ешқайда жіберілмейді: есеп осы бетте жүреді, мұнда форма да, серверге сұрау да жоқ.',
  inputsTitle: 'Сіздің сандарыңыз',
  estimate: 'сіздің бағаңыз',
  fields: {
    sales: { label: 'Айына өткізу саны', hint: 'тауарлар мен қызметтерді өткізу құжаттары' },
    avgCheck: { label: 'Орташа чек, ₸', hint: 'бір өткізудің орташа сомасы' },
    bank: { label: 'Айына банк төлемдері', hint: 'үзінді көшірме бойынша түсімдер мен шығыстар' },
    counterparties: { label: 'Салыстыруға арналған контрагенттер', hint: 'есеп айырысуды кіммен салыстырасыз' },
    minutes: { label: 'Бір операцияға минут', hint: 'ЭШФ жазу, төлемді тарату, контрагентпен салыстыру' },
    lateShare: { label: 'ЭШФ мерзімінде жазылмаған өткізу үлесі, %', hint: 'сіздің ойыңызша, өткізудің қандай бөлігі мерзімнен ұзақ ЭШФ-сыз қалады' },
  },
  resultsTitle: 'Нәтиже',
  atRisk: {
    title: 'Тәуекелдегі сома',
    unit: '₸ айына',
    lateSales: (n) => `≈ айына ${n} өткізу уақтылы ЭШФ-сыз`,
    note: `Бұл айналым күнінен кейін ${ESF_ISSUE_DAYS} күнтізбелік күннен кеш ЭШФ жазылуы мүмкін өткізулердің сомасы — бұл мерзім 01.01.2026 бастап қолданылатын ҚР Салық кодексінде белгіленген. Бұл айыппұл да, салық та емес, тексеруге тұрарлық айналым.`,
  },
  hours: {
    title: 'Күнделікті жұмыс сағаттары',
    unit: 'сағ айына',
    parts: {
      sales: 'өткізу бойынша ЭШФ',
      bank: 'үзінді көшірмені тарату',
      counterparties: 'контрагенттермен салыстыру',
    },
    note: 'Операциялар саны × бір операцияға минут. Автоматтандыру мұның қаншасын алатыны базаңызға байланысты — бұл тексеруден кейін көрінеді.',
  },
  formula: 'Есептеу: өткізу × үлес × орташа чек; (өткізу + төлемдер + контрагенттер) × минут ÷ 60.',
  ctaCheck: 'Базаны тегін тексеру',
  ctaProducts: 'Өнімді таңдау',
  ctaNote: 'Жедел тексеру бағаны емес, базаңыздағы ЭШФ-сыз нақты өткізулерді сомалары мен құжаттарымен көрсетеді.',
};

const en = {
  label: 'Calculator · runs in your browser',
  title: 'How much you lose on e-invoices and routine',
  sub: 'Six numbers about your accounting show how much turnover is at risk from e-invoices (ESF) issued late, and how many hours a month go into manual work.',
  privacy: 'Nothing is sent anywhere: the calculation runs on this page; there is no form and no server request here.',
  inputsTitle: 'Your numbers',
  estimate: 'your estimate',
  fields: {
    sales: { label: 'Sales documents per month', hint: 'sales of goods and services' },
    avgCheck: { label: 'Average sale, ₸', hint: 'average amount of one sale' },
    bank: { label: 'Bank payments per month', hint: 'receipts and payments in the statement' },
    counterparties: { label: 'Counterparties to reconcile', hint: 'whom you reconcile balances with' },
    minutes: { label: 'Minutes per operation', hint: 'issue an ESF, post a payment, reconcile a counterparty' },
    lateShare: { label: 'Share of sales with a late ESF, %', hint: 'what part of sales, in your view, stays without an ESF past the deadline' },
  },
  resultsTitle: 'Result',
  atRisk: {
    title: 'Amount at risk',
    unit: '₸ per month',
    lateSales: (n) => `≈ ${n} sales a month without a timely ESF`,
    note: `This is the amount of sales whose ESF may be issued later than ${ESF_ISSUE_DAYS} calendar days after the turnover date — the deadline set by the Tax Code of Kazakhstan as in force from 01.01.2026. It is not a fine and not a tax, but turnover worth checking.`,
  },
  hours: {
    title: 'Hours of routine',
    unit: 'h per month',
    parts: {
      sales: 'ESF for sales',
      bank: 'posting the bank statement',
      counterparties: 'reconciling counterparties',
    },
    note: 'Number of operations × minutes per operation. How much of it automation takes over depends on your database — the check shows it.',
  },
  formula: 'How it is calculated: sales × share × average sale; (sales + payments + counterparties) × minutes ÷ 60.',
  ctaCheck: 'Check your database for free',
  ctaProducts: 'Find a product',
  ctaNote: 'The express check shows not an estimate but the actual sales without an ESF in your database — with amounts and documents.',
};

export const CALC_TEXT = { ru, kz, en };
