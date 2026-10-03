/**
 * POST /api/review — отзыв с сайта в карантин (cms.review_inbox, миграция 052).
 *
 * На сайт отзыв отсюда НЕ попадает: его публикует человек в панели
 * («Сайт: отзывы» → «Опубликовать»). Функция только принимает и передаёт в
 * public.submit_review, где живут все проверки: длина 40–2000 знаков, без
 * ссылок, не больше 20 отзывов в час, повтор того же текста не дублируется,
 * обязательное согласие на публикацию имени.
 *
 * IP посетителя в базу не пишется — только его SHA-256 с солью дня: этого
 * хватает, чтобы заметить поток с одного адреса, и не хватает, чтобы узнать
 * адрес.
 *
 * Переменные окружения: SUPABASE_URL, SUPABASE_ANON_KEY (те же, что у /api/lead).
 */
import { createHash } from 'node:crypto';

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

const clip = (value, size) => String(value ?? '').trim().slice(0, size);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return response.status(503).json({ error: 'Приём отзывов временно недоступен. Напишите нам в Telegram.' });
  }

  const body = typeof request.body === 'string' ? safeParse(request.body) : request.body || {};
  const ip = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const rating = Number(body.rating);

  const payload = {
    name: clip(body.name, 120),
    role: clip(body.role, 120),
    company: clip(body.company, 160),
    city: clip(body.city, 80),
    product: clip(body.product, 60),
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    body: clip(body.body, 2100),
    contact: clip(body.contact, 200),
    consent: body.consent === true,
    page: clip(body.page, 300),
    ip_hash: ip ? createHash('sha256').update(`${day}|${ip}`).digest('hex') : '',
    user_agent: clip(request.headers['user-agent'], 300),
  };

  try {
    const result = await fetch(`${url}/rest/v1/rpc/submit_review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ payload }),
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) {
      // Сообщения проверок пишет сама база по-русски («расскажите чуть подробнее…») —
      // их и показываем. Остальное (сбой, нет функции) — общий текст, детали в журнал.
      const message = String(data?.message || '');
      const ours = data?.code === 'P0001' && message && message.length < 200;
      if (!ours) console.error('submit_review:', result.status, message.slice(0, 300));
      return response.status(ours ? 400 : 502).json({
        error: ours ? message : 'Не удалось отправить отзыв. Попробуйте позже или напишите нам в Telegram.',
      });
    }
    return response.status(200).json({ ok: true, duplicate: Boolean(data?.duplicate) });
  } catch (error) {
    console.error('submit_review недоступна:', error?.name || error);
    return response.status(502).json({ error: 'Не удалось отправить отзыв. Попробуйте позже или напишите нам в Telegram.' });
  }
}
