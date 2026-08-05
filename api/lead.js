/**
 * POST /api/lead — приём заявки с сайта и отправка в Telegram.
 *
 * Переменные окружения (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN — токен бота от @BotFather
 *   TELEGRAM_CHAT_ID   — id чата или канала, куда слать заявки
 *
 * Без префикса VITE_ — эти значения нужны только на сервере
 * и в клиентский бандл не попадают.
 */

const FIELD_LABELS = {
  name: 'Имя',
  phone: 'Телефон / Telegram',
  email: 'Email',
  company: 'Компания',
  service: 'Продукт / услуга',
  message: 'Сообщение',
  source: 'Источник',
  page: 'Страница',
};

/** Экранирование под parse_mode: HTML. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Telegram credentials are not configured');
    return response.status(500).json({ error: 'Форма не настроена. Напишите нам в Telegram.' });
  }

  const body = typeof request.body === 'string' ? safeParse(request.body) : request.body || {};

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();

  if (!name || !phone) {
    return response.status(400).json({ error: 'Укажите имя и контакт для связи.' });
  }

  // Ограничиваем длину, чтобы форму нельзя было использовать для спама.
  const clean = value => String(value || '').trim().slice(0, 1000);

  const lines = ['<b>Новая заявка с сайта</b>', ''];
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const value = clean(body[key]);
    if (value) lines.push(`<b>${label}:</b> ${escapeHtml(value)}`);
  }
  lines.push('', `<i>${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}</i>`);

  try {
    const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!telegram.ok) {
      const details = await telegram.text();
      console.error('Telegram API error:', telegram.status, details);
      return response.status(502).json({ error: 'Не удалось доставить заявку. Напишите нам в Telegram.' });
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Lead delivery failed:', error);
    return response.status(500).json({ error: 'Не удалось отправить заявку. Попробуйте позже.' });
  }
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
