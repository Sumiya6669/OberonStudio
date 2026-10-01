/**
 * Нормы для экрана «Налоги ИП» — копия нескольких чисел из Python-бухгалтера
 * (Products for AI Tinker / ИИ-бухгалтер, `rules.py`). Эталон там: у каждой нормы
 * статья и тест. Здесь только то, без чего экран не может показать цифру; меняется
 * норма — править в обоих местах.
 *
 * Сверено 01.10.2026 по adilet: НК РК 2026 (K2500000214), СК, Закон об ОСМС.
 */
export const CHECKED = '01.10.2026';

export const MRP = { 2025: 3932, 2026: 4325 };
export const MZP = { 2025: 85000, 2026: 85000 };
export const LIMIT_MRP = 600000;        // НК ст. 723 п. 1 пп. 1 — лимит упрощёнки за год
export const BOOKKEEPING_MRP = 135000;  // Закон о бухучёте ст. 2 п. 2
export const ESF_DAYS = 15;             // НК ст. 209 п. 7, ст. 493 п. 1

const OPVR = { 2026: 3.5, 2027: 4.5, 2028: 5 };

/** Соцплатежи ИП за себя в месяц (СК ст. 244, 245, 249, 251; Закон об ОСМС ст. 28). */
export function selfPayments(year, declared = 0) {
  const wage = MZP[year] || MZP[2026];
  const base = declared > wage ? declared : wage;
  const opv = Math.round(Math.min(base, 50 * wage) * 0.10);
  const opvr = Math.round(Math.min(base, 50 * wage) * (OPVR[year] || 3.5) / 100);
  const so = Math.round(Math.min(base, 7 * wage) * 0.05);
  const vosms = Math.round(1.4 * wage * 0.05);
  return [
    { code: 'ОПВ', knp: '010', amount: opv },
    { code: 'ОПВР', knp: '089', amount: opvr },
    { code: 'СО', knp: '012', amount: so },
    { code: 'ВОСМС', knp: '122', amount: vosms },
  ];
}

/** Полугодие, в которое попадает дата: [начало, конец] строками ГГГГ-ММ-ДД. */
export function halfYear(iso) {
  const y = iso.slice(0, 4);
  return Number(iso.slice(5, 7)) <= 6 ? [`${y}-01-01`, `${y}-06-30`] : [`${y}-07-01`, `${y}-12-31`];
}

export const halfLabel = (start) =>
  `${start.slice(5, 7) === '01' ? 'I' : 'II'} полугодие ${start.slice(0, 4)}`;

/** Сроки 910.00 без переноса с выходных: сдать до 15-го, уплатить до 25-го второго месяца (НК ст. 727). */
export function form910Due(start) {
  const y = Number(start.slice(0, 4));
  return start.slice(5, 7) === '01'
    ? { submit: `15.08.${y}`, pay: `25.08.${y}` }
    : { submit: `15.02.${y + 1}`, pay: `25.02.${y + 1}` };
}

export const BUYER_KIND = { ul: 'ТОО / юрлицо', ip: 'ИП', fl: 'физлицо' };

export const PAY_METHOD = {
  transfer: 'перевод по реквизитам',
  qr_card: 'Kaspi QR / карта',
  cash: 'наличные',
};

export const BANK_KIND = {
  client: 'оплата клиента',
  own: 'свой перевод',
  not_income: 'не доход',
  refund_out: 'возврат покупателю',
  social: 'соцплатёж',
  tax: 'налог',
  expense: 'расход',
  unknown: 'непонятно',
};

export const ESF_STATUS = {
  issued: { label: 'выписан', tone: 'approved' },
  due: { label: 'выписать', tone: 'estimated' },
  overdue: { label: 'срок прошёл', tone: 'failed' },
  on_request: { label: 'по требованию', tone: 'done' },
};

/** Что сделать при регистрации ИП — тот же список, что у бота (`rules.PREPARE`). */
export const PREPARE = [
  'В уведомлении о начале деятельности выбрать упрощёнку (СНР на основе упрощённой декларации) — иначе ИП попадёт на общеустановленный режим (НК ст. 716 п. 2).',
  'ОКЭД — из раздела 62. Не указывать консалтинг 70221/70222 и бухучёт 69201–69205: с ними упрощёнка запрещена (ПП № 970).',
  'Сразу зарегистрироваться в ИС ЭСФ: ЭСФ по продаже ТОО и ИП нужен в 15 дней после акта (НК ст. 208, 209, 493).',
  'Если физлица платят Kaspi QR или картой — подключить Kaspi Кассу: это денежные расчёты, нужна ККМ (НК ст. 19, 110).',
  'Утвердить налоговую учётную политику (бот: /policy) и заполнить профиль ниже.',
];
