/**
 * Отправка заявки. Форма обращается к своей serverless-функции `/api/lead`,
 * которая пишет заявку в базу и пересылает её в Telegram. Токен бота живёт
 * только на сервере и в браузер не попадает.
 *
 * Возвращает расписку: `ref` — номер обращения, `reactBy` — время, до
 * которого обещан ответ. Оба приходят из базы, а не придумываются здесь.
 */
import { readCampaign } from '@/lib/analytics/campaign';

export async function submitLead(values) {
  // Метки снимались при заходе на сайт, а не сейчас: см. campaign.js.
  const campaign = readCampaign();

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

  return response.json().catch(() => ({ ok: true }));
}
