/**
 * POST /api/lead — приём заявки с сайта.
 *
 * Порядок важен: СНАЧАЛА в базу, ПОТОМ в Telegram.
 * Telegram — канал доставки, а не хранилище: если бот недоступен или у него
 * кончился суточный предел, заявка всё равно должна быть в системе.
 * Обратный порядок означает потерянные обращения, о которых никто не узнает.
 *
 * ── Почему отсюда больше не пишут в Telegram в обычном случае ──────────────
 *
 * Уведомлением о новой заявке теперь занимается Вестник: запись в crm.ticket
 * ставит ему задание в той же транзакции, и он доставляет карточку с номером,
 * сроком ответа и экранированным текстом — каждому владельцу, а не в один
 * зашитый чат, с повтором при сбое и с эскалацией, если человек не нажал
 * «Старт» у бота.
 *
 * Пока эта функция слала своё сообщение тоже, на одну заявку приходило два —
 * а два уведомления об одном событии приучают их не читать.
 *
 * Остался ровно один случай, когда писать отсюда всё-таки надо: база не
 * приняла заявку. Тогда о ней не знает никто, включая Вестника, потому что
 * задание ставит как раз запись в базу. Это последняя линия, и она не
 * дублирует Вестника, а закрывает дыру, где заявка исчезла бы совсем.
 *
 * Переменные окружения (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN — токен бота от @BotFather. Нужен ТОЛЬКО для случая
 *                        выше; в обычной работе не используется
 *   TELEGRAM_CHAT_ID   — id чата для того же аварийного случая
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
  landing: 'Страница входа',
  referrer: 'Переход с',
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
 * Запись заявки в базу. Возвращает РАСПИСКУ — номер обращения и время, до
 * которого обещан ответ, — либо null, если Supabase не настроен. Ошибка
 * записи не должна ронять приём: заявка уйдёт хотя бы в Telegram, а
 * расхождение будет видно в журнале Vercel.
 *
 * Время ответа берётся из базы, а не пишется в вёрстке: по этому же полю
 * панель считает просрочку, поэтому сайт и панель не могут разойтись.
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
        // Источник: страница входа, переход и метки кампании. Хранится
        // колонками заявки, а не строкой в тексте, — иначе это нельзя
        // посчитать, а значит нельзя понять, что работает.
        landing: body.landing || body.page,
        referrer: body.referrer,
        utm: body.utm,
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

  // Метки кампании приходят объектом, поэтому через строковую чистку не идут.
  // Берём только известные ключи и только строки: складывать в базу
  // произвольный объект из браузера — значит однажды получить туда мусор.
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  cleaned.utm = Object.fromEntries(
    UTM_KEYS
      .map(key => [key, String(body?.utm?.[key] ?? '').trim().slice(0, 200)])
      .filter(([, value]) => value !== ''),
  );

  let receipt = null;
  let ticketId = null;
  let stored = false;
  try {
    receipt = await saveToDatabase(cleaned);
    ticketId = receipt?.ticket_id ?? null;
    stored = ticketId !== null;
  } catch (error) {
    // Не роняем приём: заявка уйдёт в Telegram, а расхождение видно в журнале.
    console.error('Не удалось записать заявку в базу:', error);
  }

  // Заявка в базе — дальше дело Вестника. Здесь больше ничего не отправляем.
  if (stored) {
    return response.status(200).json({
      ok: true, ticketId, delivered: true,
      ref: receipt?.ref ?? null, reactBy: receipt?.react_by ?? null,
    });
  }

  // Сюда попадаем, только если база заявку не приняла.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('База не приняла заявку, а запасной канал не настроен');
    return response.status(500).json({
      error: 'Не удалось принять заявку. Напишите нам в Telegram — ответим сразу.',
    });
  }

  const lines = ['<b>⚠ Заявка НЕ записана в базу</b>', ''];
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    if (cleaned[key]) lines.push(`<b>${label}:</b> ${escapeHtml(cleaned[key])}`);
  }
  lines.push('', '<i>Это запасной канал: заявки нет ни в панели, ни у Вестника.</i>');
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
      console.error('Telegram API error:', telegram.status, await telegram.text());
      // Ни базы, ни Telegram. Врать «принято» нельзя: заявки нет нигде.
      return response.status(502).json({
        error: 'Не удалось принять заявку. Напишите нам в Telegram — ответим сразу.',
      });
    }

    // Заявка ушла в запасной канал, но в системе её нет. delivered: true
    // здесь было бы обещанием, которого система не держит.
    return response.status(200).json({ ok: true, ticketId: null, delivered: false, ref: null, reactBy: null });
  } catch (error) {
    console.error('Запасной канал тоже не сработал:', error);
    return response.status(500).json({
      error: 'Не удалось принять заявку. Напишите нам в Telegram — ответим сразу.',
    });
  }
}
