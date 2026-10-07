/**
 * Суммы в тенге в одном формате на весь сайт: «1 500 000 ₸».
 *
 * Разделитель тысяч и пробел перед знаком валюты — неразрывные (U+00A0):
 * сумма не разрывается переносом строки. Группировка — вручную, а не через
 * toLocaleString: результат не зависит от ICU в Node (сборка страниц) и в
 * браузере, поэтому собранный HTML и первый кадр совпадают байт в байт.
 * Никаких «1.5M ₸»: так бухгалтер сумму не пишет и не читает.
 */
export const NBSP = '\u00A0';

export function groupThousands(value) {
  const n = Math.round(Number(value) || 0);
  const sign = n < 0 ? '−' : '';
  return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export const tenge = (value) => `${groupThousands(value)}${NBSP}₸`;
