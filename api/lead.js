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
 * Аварийный канал ВЫКЛЮЧЕН по умолчанию (аудит 07.10.2026): раньше он слал
 * заявку целиком — имя, телефон, текст — в Telegram, то есть ПД за рубеж.
 * Теперь:
 *   LEAD_TELEGRAM_FALLBACK не '1' (по умолчанию) — база не приняла заявку →
 *           посетитель видит честное «не удалось, напишите нам», в журнал
 *           Vercel уходит только метка, ПД никуда не уходят;
 *   LEAD_TELEGRAM_FALLBACK = '1' — в Telegram уходит СИГНАЛ без ПД (метка,
 *           форма, страница), а сама заявка — одной строкой в журнал функции
 *           (Vercel → Logs) с той же меткой. Компромисс: журнал Vercel хранится
 *           недолго и находится в США; заявку надо перенести в панель сразу.
 * Полный текст заявки в Telegram отсюда не уходит ни при каком флаге.
 *
 * Переменные окружения (Vercel → Settings → Environment Variables):
 *   LEAD_TELEGRAM_FALLBACK — '1', чтобы включить сигнал выше; иначе выключен
 *   TELEGRAM_BOT_TOKEN — токен бота от @BotFather. Нужен ТОЛЬКО для сигнала
 *                        выше; в обычной работе не используется
 *   TELEGRAM_CHAT_ID   — id чата для того же сигнала
 *   SUPABASE_URL       — адрес проекта Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — если задан, заявка пишется от имени сервера
 *                        вместе с хэшем IP (предел частоты по адресу, миграция
 *                        062). Не задан — как раньше, публичным ключом:
 *   SUPABASE_ANON_KEY  — публичный ключ; функция public.submit_lead тогда
 *                        сама требует согласие и держит пределы (миграция 062).
 *   IP_HASH_SALT       — соль хэша IP (см. api/_guard.js); без неё хэш не шлётся.
 *   VITE_YM_ID         — номер счётчика Яндекс Метрики (тот же, что у сайта)
 *   YM_MS_TOKEN        — секретный токен Measurement Protocol (Метрика →
 *                        Настройки → Measurement Protocol). Без него цель
 *                        «лид» отправляет браузер.
 *
 * Цель «лид» в Метрику уходит с сервера: браузер может закрыться сразу после
 * отправки формы, а блокировщики режут счётчик. Уходит только ClientID
 * посетителя (если он согласился на счётчик), страница и название цели —
 * ни имени, ни телефона, ни текста заявки.
 */

// Относительный путь, а не «@/…»: у серверных функций нет алиаса сборки сайта.
import { DATA_IN_RK } from '../src/lib/dataResidency.js';
import { clientIp, escapeHtml, ipHash, serviceHeaders } from './_guard.js';

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

/**
 * Цель «лид» в Яндекс Метрику через Measurement Protocol. true — Метрика
 * приняла. Ошибка здесь заявку не роняет: она уже в базе.
 */
async function sendMetrikaGoal(clientIdValue, page) {
  const counter = process.env.VITE_YM_ID;
  const token = process.env.YM_MS_TOKEN;
  if (!counter || !token || !/^\d{6,30}$/.test(clientIdValue || '')) return false;
  const site = process.env.VITE_SITE_URL || 'https://' + (process.env.VERCEL_PROJECT_PRODUCTION_URL || '');
  try {
    // Разбор адреса — внутри try: кривой page или пустой адрес сайта не должны ронять ответ на заявку.
    const params = new URLSearchParams({
      tid: counter, cid: clientIdValue, t: 'event', ea: 'lead', ms: token,
      et: String(Math.floor(Date.now() / 1000)),
      dl: new URL(page || '/', site).toString(),
    });
    const result = await fetch(`https://mc.yandex.ru/collect/?${params}`, { signal: AbortSignal.timeout(3000) });
    if (!result.ok) console.error('Метрика не приняла цель:', result.status, (await result.text()).slice(0, 200));
    return result.ok;
  } catch (error) {
    console.error('Метрика недоступна:', error?.name || error);
    return false;
  }
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
async function saveToDatabase(body, ipHashValue) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  // Ключ сервера, если он есть: тогда база верит хэшу IP из запроса. Иначе — публичный ключ, как раньше.
  const headers = serviceHeaders()
    || (url && anon ? { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` } : null);
  if (!url || !headers) return null;

  const response = await fetch(`${url}/rest/v1/rpc/submit_lead`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(10000),
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
        // Форма и согласие — колонками заявки (миграция 055); до неё база эти поля просто не берёт.
        source: body.source,
        consent: body.consent === true,
        consent_version: body.consent_version,
        channel: 'site',
        received_at: new Date().toISOString(),
        // Хэш IP с солью (база учитывает его только от ключа сервера): предел заявок с одного адреса.
        ip_hash: ipHashValue || undefined,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`submit_lead: ${response.status} ${details.slice(0, 300)}`);
    // Проверки базы (P0001) пишут понятный текст по-русски — его можно показать посетителю.
    try {
      const data = JSON.parse(details);
      if (data?.code === 'P0001' && typeof data.message === 'string' && data.message.length < 200) {
        error.publicMessage = data.message;
      }
    } catch {
      // не JSON — значит не наша проверка
    }
    throw error;
  }
  return response.json();
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof request.body === 'string' ? safeParse(request.body) : request.body || {};

  // Без явного согласия на обработку ПД заявку не принимаем (Закон РК
  // «О персональных данных», ст. 7–8). Проверка здесь, а не только галочкой
  // в форме: форму можно обойти прямым запросом.
  if (body.consent !== true) {
    return response.status(400).json({ error: 'Нужно согласие на обработку персональных данных.' });
  }

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
  // fbclid и yclid — метки клика Meta и Яндекса: по ним конверсия возвращается в кабинет без контактов клиента.
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'yclid'];
  cleaned.utm = Object.fromEntries(
    UTM_KEYS
      .map(key => [key, String(body?.utm?.[key] ?? '').trim().slice(0, 200)])
      .filter(([, value]) => value !== ''),
  );

  // Отметка о согласии — доказательство по ст. 25 Закона о ПД. Колонок под
  // неё в базе нет, поэтому она уходит служебной строкой в конце текста
  // заявки: так она попадает и в базу, и в аварийное сообщение в Telegram.
  // Только дата, без времени: база ловит повтор по началу текста, секунды сделали бы каждую копию «новой».
  const consentVersion = String(body.consent_version || '').trim().slice(0, 40) || 'не указана';
  cleaned.consent = true;
  cleaned.consent_version = consentVersion;
  const consentLine = `Согласие на обработку ПД: да · версия ${consentVersion}`
    + ` · форма ${cleaned.source || 'website'} · ${new Date().toISOString().slice(0, 10)}`;
  cleaned.message = [cleaned.message, consentLine].filter(Boolean).join('\n\n');

  let receipt = null;
  let ticketId = null;
  let stored = false;
  try {
    receipt = await saveToDatabase(cleaned, ipHash(clientIp(request), 'lead'));
    ticketId = receipt?.ticket_id ?? null;
    stored = ticketId !== null;
  } catch (error) {
    // Отказ проверки базы (нет согласия, слишком часто) — не авария: говорим посетителю как есть.
    if (error?.publicMessage) {
      const tooMany = /слишком/i.test(error.publicMessage);
      return response.status(tooMany ? 429 : 400).json({ error: error.publicMessage });
    }
    console.error('Не удалось записать заявку в базу:', error?.message || error);
  }

  // Заявка в базе — дальше дело Вестника. Здесь больше ничего не отправляем.
  if (stored) {
    const metrika = await sendMetrikaGoal(String(body.ym_client_id || ''), cleaned.page) ? 'sent' : 'browser';
    return response.status(200).json({
      ok: true, ticketId, delivered: true,
      ref: receipt?.ref ?? null, reactBy: receipt?.react_by ?? null, metrika,
    });
  }

  // Сюда попадаем, только если база заявку не приняла.
  const mark = `lead-${Date.now().toString(36)}`;
  const failMessage = 'Не удалось принять заявку. Напишите нам в Telegram — ответим сразу.';

  // Аварийный канал выключен по умолчанию: ПД никуда не уходят, посетитель видит честный отказ.
  if (process.env.LEAD_TELEGRAM_FALLBACK !== '1') {
    console.error(`Заявка не записана в базу [${mark}], аварийный канал выключен (LEAD_TELEGRAM_FALLBACK)`);
    return response.status(500).json({ error: failMessage });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error(`Заявка не записана в базу [${mark}], а сигнальный канал не настроен`);
    return response.status(500).json({ error: failMessage });
  }

  // Заявка — только в журнал функции (см. шапку), в Telegram — сигнал без ПД.
  console.error(`Заявка не записана в базу [${mark}]${DATA_IN_RK ? ' (данные в РК)' : ''}:`, JSON.stringify(cleaned));

  const lines = ['<b>⚠ Заявка НЕ записана в базу</b>', ''];
  lines.push('Проверьте журнал Vercel (функция /api/lead): заявка там, по метке ниже.', '');
  lines.push(`<b>Метка:</b> ${escapeHtml(mark)}`);
  if (cleaned.source) lines.push(`<b>Форма:</b> ${escapeHtml(cleaned.source)}`);
  if (cleaned.page) lines.push(`<b>Страница:</b> ${escapeHtml(cleaned.page)}`);
  lines.push('', '<i>Журнал Vercel хранится недолго — перенесите заявку в панель сразу.</i>');
  lines.push('', `<i>${escapeHtml(new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }))}</i>`);

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
      console.error('Telegram API error:', telegram.status, (await telegram.text()).slice(0, 200));
      // Ни базы, ни Telegram. Врать «принято» нельзя: заявки нет нигде.
      return response.status(502).json({
        error: failMessage,
      });
    }

    // Заявка ушла в запасной канал, но в системе её нет. delivered: true
    // здесь было бы обещанием, которого система не держит.
    return response.status(200).json({ ok: true, ticketId: null, delivered: false, ref: null, reactBy: null });
  } catch (error) {
    console.error('Сигнальный канал тоже не сработал:', error?.name || error);
    return response.status(500).json({
      error: failMessage,
    });
  }
}
