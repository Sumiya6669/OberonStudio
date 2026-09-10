/**
 * Откуда пришёл посетитель.
 *
 * Метки кампании и переход снимаются ОДИН раз — при заходе на сайт. Дальше
 * человек ходит по страницам, адрес меняется, метки из него исчезают, и если
 * снимать их в момент отправки формы, у всех заявок источником окажется
 * страница контактов. Именно так и выглядит большинство «аналитик»:
 * всё пришло из ниоткуда.
 *
 * Хранится в sessionStorage, а не в cookie: это не слежка между визитами,
 * а один визит. Закрыл вкладку — забыли.
 */
const KEY = 'ag_campaign';

const UTM_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
];

export function captureCampaign() {
  if (typeof window === 'undefined') return;
  try {
    // Уже снято в этом визите — не перезаписываем: важно ПЕРВОЕ касание.
    if (sessionStorage.getItem(KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const utm = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) utm[key] = value.slice(0, 200);
    }

    // Переход с другого сайта. Переходы внутри собственного сайта источником
    // не считаются — иначе им окажется он сам.
    let referrer = '';
    if (document.referrer) {
      try {
        const from = new URL(document.referrer);
        if (from.host !== window.location.host) referrer = document.referrer.slice(0, 500);
      } catch { /* мусор в referrer — просто игнорируем */ }
    }

    sessionStorage.setItem(KEY, JSON.stringify({
      utm,
      referrer,
      landing: window.location.pathname,
    }));
  } catch {
    // Приватный режим и запрет хранилища — не повод ломать сайт.
  }
}

export function readCampaign() {
  if (typeof window === 'undefined') return { utm: {}, referrer: '', landing: '' };
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || '{}');
    return { utm: raw.utm || {}, referrer: raw.referrer || '', landing: raw.landing || '' };
  } catch {
    return { utm: {}, referrer: '', landing: '' };
  }
}
