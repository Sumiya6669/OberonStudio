/**
 * POST /api/chat — ответ консультанта через языковую модель.
 *
 * Работает, только если задан ANTHROPIC_API_KEY. Если ключа нет, отвечает 501,
 * и виджет на сайте молча переключается на встроенную базу знаний —
 * консультант продолжает работать, просто по заранее написанным сценариям.
 *
 * Это платная опция: каждый диалог расходует токены. Ключ берётся здесь:
 * https://console.anthropic.com → API Keys.
 *
 * ── Откуда консультант знает, что мы делаем ────────────────────────────────
 *
 * Раньше знал из строки прямо в этом файле. Строка пережила смену всего:
 * студия называлась Oberon, продавала CRM и онлайн-запись для салонов и
 * ссылалась на «20 проектов в портфолио». Сайт давно про 1С, а консультант
 * на том же сайте предлагал посетителю расписание для косметолога и называл
 * число, которое никто не проверял.
 *
 * Так и должно было случиться: знание, записанное во втором месте, рано или
 * поздно разойдётся с первым. Поэтому теперь оно ровно одно — опубликованное
 * содержимое сайта, то же самое, которое видит посетитель. Опубликовали новую
 * работу в панели — консультант знает о ней со следующего запроса.
 */

const MODEL = 'claude-sonnet-4-6';
const MAX_HISTORY = 12;

/** Содержимое сайта кешируется: дёргать базу на каждую реплику незачем. */
const BRIEF_TTL_MS = 5 * 60 * 1000;
let briefCache = { at: 0, text: null };

async function loadBrief() {
  const now = Date.now();
  if (briefCache.text && now - briefCache.at < BRIEF_TTL_MS) return briefCache.text;

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/site_content`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_locale: 'ru' }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return briefCache.text;

    const text = buildBrief(await response.json());
    briefCache = { at: now, text };
    return text;
  } catch {
    // Сеть подвела — отвечаем по прошлому слепку, если он есть.
    return briefCache.text;
  }
}

const list = (items, render) => (items || [])
  .filter((item) => item?.slug)
  .map(render)
  .filter(Boolean)
  .join('\n');

/** Короткая справка о студии из того, что опубликовано на сайте. */
function buildBrief(content) {
  const settings = content?.settings || {};
  const collections = content?.collections || {};

  const offers = list(collections.offer, (item) => {
    const price = Number(item.props?.price_from) > 0
      ? ` — от ${Number(item.props.price_from).toLocaleString('ru-RU')} ₸${item.props?.unit ? ` ${item.props.unit}` : ''}`
      : ' — цена по запросу';
    return `- ${item.text?.title || item.slug}${price}: ${item.text?.tagline || ''} (/uslugi/${item.slug})`;
  });

  const answers = list(collections.answer, (item) =>
    `- ${item.text?.title || item.slug}: ${item.text?.question || ''} (/1c/${item.slug})`);

  const cases = list(collections.case, (item) =>
    `- ${item.text?.title || item.slug}: ${item.text?.tagline || ''} (/keysy/${item.slug})`);

  const contacts = [
    settings.telegram_url && `Telegram: ${settings.telegram_url}`,
    settings.whatsapp_url && `WhatsApp: ${settings.whatsapp_url}`,
    settings.phone && `Телефон: ${settings.phone}`,
    settings.email && `Почта: ${settings.email}`,
  ].filter(Boolean).join(', ');

  return [
    offers && `РАБОТЫ, КОТОРЫЕ МОЖНО ЗАКАЗАТЬ (цены опубликованы на сайте, называть их можно):\n${offers}`,
    answers && `РАЗБОРЫ ЧАСТЫХ ПРОБЛЕМ 1С (можно сослаться на страницу):\n${answers}`,
    cases && `КЕЙСЫ — работы, которые действительно были:\n${cases}`,
    contacts && `КОНТАКТЫ: ${contacts}`,
  ].filter(Boolean).join('\n\n');
}

/**
 * Правила разговора. Здесь — только они: что студия делает, консультант
 * узнаёт из справки выше, а не отсюда.
 */
const RULES = `Ты — Keen, консультант студии Tinker из Казахстана. Студия занимается 1С: разработка, сопровождение, интеграции, аудит конфигураций. Общаешься на сайте студии с потенциальными клиентами.

КАК ОТВЕЧАТЬ:
- Пиши на языке собеседника (русский, казахский или английский)
- Коротко: 2–4 предложения, без списков и заголовков, живым языком
- Задавай один уточняющий вопрос в конце, чтобы понять задачу — как делает живой менеджер
- Про 1С отвечай по существу: спроси конфигурацию, типовая она или доработанная, какая версия платформы
- Цены называй ТОЛЬКО те, что перечислены в справке ниже, и только как «от». Точную стоимость работы обещать нельзя: она зависит от состояния конкретной базы
- Сроки конкретными датами не обещай, пока задача не разобрана
- НИЧЕГО не выдумывай: ни кейсов, ни имён клиентов, ни числа проектов, ни сроков, ни процентов. Нет в справке — значит, не знаешь; так и скажи
- Если задача вне 1С и автоматизации — честно скажи, что это не к нам
- Когда клиент готов обсуждать предметно, предложи оставить контакт прямо в чате или написать по контактам из справки
- Не обещай гарантий результата и процентов роста`;

async function systemPrompt() {
  const brief = await loadBrief();
  return brief ? `${RULES}\n\n${brief}` : RULES;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Не ошибка, а штатный режим: клиент перейдёт на локальную базу знаний.
    return response.status(501).json({ error: 'LLM is not configured' });
  }

  const body = typeof request.body === 'string' ? safeParse(request.body) : request.body || {};
  const history = Array.isArray(body.messages) ? body.messages : [];

  const messages = history
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim().slice(0, 2000),
    }));

  if (messages.length === 0) {
    return response.status(400).json({ error: 'Empty conversation' });
  }

  try {
    const result = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: await systemPrompt(),
        messages,
      }),
    });

    if (!result.ok) {
      console.error('LLM error:', result.status, await result.text());
      return response.status(502).json({ error: 'LLM request failed' });
    }

    const data = await result.json();
    const reply = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    if (!reply) return response.status(502).json({ error: 'Empty reply' });

    return response.status(200).json({ reply });
  } catch (error) {
    console.error('Chat handler failed:', error);
    return response.status(500).json({ error: 'Chat failed' });
  }
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
