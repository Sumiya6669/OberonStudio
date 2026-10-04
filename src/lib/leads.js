/**
 * Отправка заявки. Форма обращается к своей serverless-функции `/api/lead`,
 * которая пишет заявку в базу и пересылает её в Telegram. Токен бота живёт
 * только на сервере и в браузер не попадает.
 *
 * Возвращает расписку: `ref` — номер обращения, `reactBy` — время, до
 * которого обещан ответ. Оба приходят из базы, а не придумываются здесь.
 */
import { readCampaign } from '@/lib/analytics/campaign';
import { clientId, reachGoal } from '@/lib/analytics/metrika';
import { DATA_IN_RK } from '@/lib/dataResidency';

/**
 * Версия текста согласия на обработку ПД (страница /privacy#consent).
 * Меняется при каждой правке текста: сервер пишет её в заявку, и по ней
 * видно, с каким именно текстом человек согласился.
 *
 * Две редакции зависят от переключателя DATA_IN_RK (src/lib/dataResidency.js):
 * до переезда базы в РК — временная, после — без Supabase и зарубежного
 * хранения. Версия поднимается сама вместе с переключателем.
 */
export const CONSENT_VERSION = DATA_IN_RK ? '2026-10-10' : '2026-10-04';

export async function submitLead(values) {
  // Метки снимались при заходе на сайт, а не сейчас: см. campaign.js.
  const campaign = readCampaign();
  // ClientID Метрики — только если посетитель согласился на счётчик; по нему
  // сервер засчитывает цель «лид». Контакты в Метрику не уходят никогда.
  const ymClientId = await clientId();

  const response = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: values.name?.trim() || '',
      phone: values.phone?.trim() || '',
      email: values.email?.trim() || '',
      company: values.company?.trim() || '',
      message: values.message?.trim() || '',
      service: values.service || '',
      source: values.source || 'website',
      // Страница отправки формы и страница входа — разные вещи, и обе
      // нужны: первая говорит, где человек решился, вторая — что его привело.
      page: typeof window !== 'undefined' ? window.location.pathname : '',
      landing: campaign.landing || '',
      referrer: campaign.referrer || '',
      utm: campaign.utm || {},
      ym_client_id: ymClientId,
      // Согласие ставит сама форма (галочка или кнопка в чате) — здесь его
      // не додумываем: без явного true сервер заявку не примет.
      consent: values.consent === true,
      consent_version: CONSENT_VERSION,
    }),
  });

  if (!response.ok) {
    let reason = 'Не удалось отправить заявку. Попробуйте написать в Telegram.';
    try {
      const data = await response.json();
      if (data?.error) reason = data.error;
    } catch {
      // тело ответа может быть пустым — оставляем текст по умолчанию
    }
    throw new Error(reason);
  }

  const receipt = await response.json().catch(() => ({ ok: true }));
  // Сервер не отправил цель сам (нет токена Measurement Protocol или ClientID) —
  // отправляет браузер. Без согласия на счётчик reachGoal ничего не делает.
  if (receipt?.metrika !== 'sent') reachGoal('lead');
  return receipt;
}
