/**
 * POST /api/rebuild — пересобрать сайт после публикации в панели.
 *
 * Зачем через функцию, а не прямо из браузера: адрес пересборки у Vercel —
 * это ключ. Кто его знает, тот запускает сборки в чужом проекте сколько
 * захочет. В браузерном коде секретов не бывает: всё, что попало в сборку,
 * можно прочитать. Поэтому адрес живёт в переменных окружения Vercel и
 * дальше этой функции не уходит.
 *
 * Кому можно и как часто, решает база, а не эта функция. Здесь только
 * доставка: спросить у базы разрешение ОТ ИМЕНИ ТОГО ЖЕ ЧЕЛОВЕКА (его
 * токен приходит в заголовке, ключ service_role не используется нигде),
 * и если разрешила — дёрнуть адрес.
 *
 * Переменные окружения:
 *   DEPLOY_HOOK_URL   — адрес пересборки из Vercel → Settings → Git
 *   SUPABASE_URL      — адрес проекта Supabase
 *   SUPABASE_ANON_KEY — публичный ключ
 */

const json = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(body));
};

/** Вызов функции базы от имени вошедшего человека. */
async function rpc(name, token, body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { error: 'база не настроена' };

  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });

  const text = await response.text();
  if (!response.ok) return { error: text.slice(0, 300), status: response.status };
  try {
    return { data: text ? JSON.parse(text) : null };
  } catch {
    return { data: text };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'только POST' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json(res, 401, { error: 'нужен вход' });

  const hook = process.env.DEPLOY_HOOK_URL;
  if (!hook) return json(res, 501, { error: 'адрес пересборки не задан' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  // 1. Разрешение и след — в базе. Здесь же срабатывает предел частоты.
  const take = await rpc('rebuild_take', token, { p_reason: body.reason || 'publish' });
  if (take.error) return json(res, take.status === 401 ? 401 : 502, { error: take.error });
  if (!take.data?.allowed) {
    return json(res, 429, { error: take.data?.reason || 'пересборка сейчас недоступна',
                            last_at: take.data?.last_at || null });
  }

  // 2. Собственно просьба к Vercel.
  let outcome = 'ok';
  let note = null;
  try {
    const response = await fetch(hook, { method: 'POST' });
    if (!response.ok) {
      outcome = 'failed';
      note = `Vercel ответил ${response.status}`;
    }
  } catch (error) {
    outcome = 'failed';
    note = String(error?.message || error).slice(0, 300);
  }

  // 3. Итог возвращается в базу — иначе «последняя сборка» в панели
  //    показывала бы сборку, которой не было.
  await rpc('rebuild_done', token, { p_id: take.data.id, p_outcome: outcome, p_note: note });

  if (outcome !== 'ok') return json(res, 502, { error: note || 'пересборка не запустилась' });
  return json(res, 202, { ok: true, id: take.data.id });
}
