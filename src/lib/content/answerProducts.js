/**
 * Разборы /1c/<slug> → бесплатная проверка и продукт, который решает эту беду.
 *
 * Одна таблица на все 25 разборов. Тексты разборов живут в базе (cms.item,
 * коллекция answer), и править их ради ссылки не нужно: блок в конце статьи
 * собирается отсюда.
 *
 * Ключ — slug разбора: у статей есть только тема (props.topic), и она слишком
 * общая («учёт», «обмен», «НДС»), чтобы по ней выбрать один продукт. Продукт
 * в таблице — тот же, что назван в самом разборе в поле «Когда нужен
 * программист» (миграции 020, 024, 058).
 *
 * check — экспресс-проверка (/proverka) правда находит эту проблему: одна из
 * шести её проверок (ЭСФ, дебиторка, СНТ и ВС, банк, ИИН/БИН, встречные
 * расчёты, src/lib/content/proverka.js). Где не находит — кнопки проверки нет:
 * «Проверить базу на эту проблему» без такой проверки было бы обещанием,
 * которое обработка не выполняет. Тогда остаётся «Обсудить задачу».
 *
 * Разбор, которого нет в таблице (добавили в панели позже), получает только
 * «Обсудить задачу» — ничего не сломается.
 */
import { PRODUCTS } from '@/lib/content/site';

export const PROVERKA_PATH = '/proverka';

export const ANSWER_PRODUCTS = {
  // 020
  'ne-provoditsya-dokument': {},
  'obmen-s-bankom': { product: 'bank-robot', check: true },
  'esf-oshibka': { product: 'esf', check: true },
  '1c-tormozit': {},
  'ne-shodyatsya-ostatki': {},
  'obnovlenie-sneslo-dorabotki': {},
  // 024
  'ne-zakryvaetsya-mesyac': {},
  '1c-ne-zapuskaetsya': {},
  'propali-dokumenty': {},
  'pechatnaya-forma': {},
  'prava-dostupa': {},
  'kaspi-zakazy-v-1c': { product: 'kaspi' },
  'kassa-ne-probivaet': {},
  'fajlovaya-baza-vyrosla': {},
  // 058
  'nds-v-zachete-bez-izvescheniya-esf': { product: 'esf', check: true },
  'sroki-deklaraciy-buhfirmy': { product: 'pult' },
  'postavshchik-snyat-s-nds': { product: 'counterparty' },
  'kameralnyy-kontrol-300': { product: 'antikameralka', check: true },
  'nds-16-vo-vhodyashchih-dokumentah': { product: 'pervichka' },
  'import-eaes-zayavlenie-328': { product: 'eaes-import' },
  'uvedomlenie-kameralnogo-kontrolya': { product: 'antikameralka', check: true },
  'markirovka-otgruzka-bez-akta': { product: 'marking' },
  'akty-sverki-za-god': { product: 'akty-sverki', check: true },
  'raznoska-vypiski-po-knp': { product: 'bank-robot', check: true },
  'virtualnyy-sklad-i-snt': { product: 'vs-snt', check: true },
};

/**
 * Ссылка на продукт: каталог с фильтром по самой узкой метке продукта, чтобы
 * человек оказался рядом с карточкой, а не в начале всего каталога.
 */
export function productHref(product) {
  const narrow = product.categories?.find((c) => c !== '1С') || product.categories?.[0];
  return narrow ? `/products?cat=${encodeURIComponent(narrow)}` : '/products';
}

/** Что показать в конце разбора: { check, product } (product — карточка из каталога или null). */
export function answerFollowUp(slug) {
  const row = ANSWER_PRODUCTS[slug] || {};
  const product = row.product ? PRODUCTS.find((p) => p.id === row.product) || null : null;
  return { check: Boolean(row.check), product };
}
