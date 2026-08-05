/**
 * POST /api/chat — ответ консультанта через языковую модель.
 *
 * Работает, только если задан ANTHROPIC_API_KEY. Если ключа нет, отвечает 501,
 * и виджет на сайте молча переключается на встроенную базу знаний —
 * консультант продолжает работать, просто по заранее написанным сценариям.
 *
 * Это платная опция: каждый диалог расходует токены. Ключ берётся здесь:
 * https://console.anthropic.com → API Keys.
 */

const MODEL = 'claude-sonnet-4-6';
const MAX_HISTORY = 12;

const SYSTEM_PROMPT = `Ты — консультант студии Oberon Studio из Казахстана. Общаешься на сайте студии с потенциальными клиентами.

ЧТО ДЕЛАЕТ СТУДИЯ:
- CRM под процесс клиента: воронка, карточка клиента, задачи менеджерам, KPI, отчётность
- AI-агенты в Telegram и WhatsApp: приём и квалификация заявок, первая линия поддержки
- Интеграции с 1С: Kaspi.kz, Wildberries, OZON, платёжные сервисы, склад, синхронизация остатков и цен
- Аналитика и дашборды: продажи, прибыль, остатки, прогноз выручки, выгрузка в Excel
- Онлайн-запись для клиник, салонов, фитнеса: расписание, напоминания в WhatsApp
- Обработка документов: распознавание PDF, счетов, накладных с занесением в 1С и CRM
- Сайты и интернет-магазины, связанные с CRM и 1С

Стек: React, Next.js, Python (FastAPI), Node.js, PostgreSQL, OpenAI, LangChain.
В портфолио 20 проектов: рестораны с iiko, гостиницы, CRM для спортсекций и косметологии, маркетплейсы, AI-агенты, образовательные платформы.

КАК ОТВЕЧАТЬ:
- Пиши на языке собеседника (русский, казахский или английский)
- Коротко: 2–4 предложения, без списков и заголовков, живым языком
- Задавай один уточняющий вопрос в конце, чтобы понять задачу — как делает живой менеджер
- Цены НЕ называй никогда. Объясняй, что стоимость зависит от интеграций, ролей, миграции данных и объёма AI-логики, и предлагай бесплатный расчёт
- Сроки конкретными датами не обещай, пока не разобрана задача
- Не выдумывай факты, кейсы, имена клиентов и цифры. Не знаешь — скажи прямо и предложи связаться с командой
- Если задача вне компетенций студии — честно скажи об этом
- Когда клиент готов обсуждать предметно, предложи оставить контакт или написать в Telegram @DeveloperAI0 либо WhatsApp +7 776 550 96 86
- Не обещай того, что студия не подтверждала: гарантий результата, конкретных процентов роста, сроков в днях`;

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
        system: SYSTEM_PROMPT,
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
