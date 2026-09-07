/**
 * POST /api/lead — приём заявки с сайта.
 *
 * Порядок важен: СНАЧАЛА в базу, ПОТОМ в Telegram.
 * Telegram — канал доставки, а не хранилище: если бот недоступен или у него
 * кончился суточный предел, заявка всё равно должна быть в системе.
 * Обратный порядок означает потерянные обращения, о которых никто не узнает.
 *
 * Переменные окружения (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN — токен бота от @BotFather
 *   TELEGRAM_CHAT_ID   — id чата, куда слать заявки
 *   SUPABASE_URL       — адрес проекта Supabase
 *   SUPABASE_ANON_KEY  — публичный ключ. Ключ service_role здесь НЕ НУЖЕН:
 *                        запись идёт через функцию public.submit_lead
 *                        с ограниченными правами.
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

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/**
 * Запись заявки в базу. Возвращает id заявки либо null, если Supabase
 * не настроен. Ошибка записи не должна ронять приём: заявка уйдёт хотя бы
 * в Telegram, а расхождение будет видно в журнале Vercel.
 */
async function saveToDatabase(body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const response = await fetch(`${url}/rest/v1/rpc/submit_lead`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      payload: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        company: body.company,
        message: body.message,
        service: body.service,
        page: body.page,
        channel: 'site',
        received_at: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`submit_lead: ${response.status} ${details}`);
  }
  return response.json();
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof request.body === 'string' ? safeParse(request.body) : request.body || {};

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();

  if (!name || (!phone && !email)) {
    return response.status(400).json({ error: 'Укажите имя и контакт для связи.' });
  }

  // Ограничиваем длину, чтобы форму нельзя было использовать для спама.
  const clean = value => String(value || '').trim().slice(0, 1000);
  const cleaned = Object.fromEntries(
    Object.keys(FIELD_LABELS).map(key => [key, clean(body[key])]),
  );

  let ticketId = null;
  let stored = false;
  try {
    ticketId = await saveToDatabase(cleaned);
    stored = ticketId !== null;
  } catch (error) {
    // Не роняем приём: заявка уйдёт в Telegram, а расхождение видно в журнале.
    console.error('Не удалось записать заявку в базу:', error);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    if (stored) return response.status(200).json({ ok: true, ticketId, delivered: false });
    console.error('Telegram credentials are not configured');
    return response.status(500).json({ error: 'Форма не настроена. Напишите нам в Telegram.' });
  }

  const lines = [
    ticketId ? `<b>Новая заявка №${ticketId}</b>` : '<b>Новая заявка с сайта</b>',
    '',
  ];
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    if (cleaned[key]) lines.push(`<b>${label}:</b> ${escapeHtml(cleaned[key])}`);
  }
  if (!stored) lines.push('', '<i>⚠ В базу не записана — проверьте настройки Supabase</i>');
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
      // Заявка в базе — значит она не потеряна, и клиенту не за что извиняться.
      if (stored) return response.status(200).json({ ok: true, ticketId, delivered: false });
      return response.status(502).json({ error: 'Не удалось доставить заявку. Напишите нам в Telegram.' });
    }

    return response.status(200).json({ ok: true, ticketId, delivered: true });
  } catch (error) {
    console.error('Lead delivery failed:', error);
    if (stored) return response.status(200).json({ ok: true, ticketId, delivered: false });
    return response.status(500).json({ error: 'Не удалось отправить заявку. Попробуйте позже.' });
  }
}
