/**
 * Опрос вместо websocket.
 *
 * Почему опрос. Supabase Realtime даёт мгновенность, но при обрыве связи экран
 * молча замирает: последние данные на месте, новых нет, и никто не знает, что
 * поток отвалился. Живая лента, которая соврала о том, что она живая, хуже
 * ленты, которая честно обновляется раз в три секунды.
 *
 * Здесь три правила:
 *   1. Вкладка не на экране — опрос останавливается. Панель, забытая в фоне
 *      на выходные, не должна к утру выбрать месячную квоту запросов.
 *   2. Ошибка не стирает данные. Прежние остаются, но экран говорит, что
 *      связь потеряна и с какого момента.
 *   3. Задержка обновления видна: если ответа нет дольше трёх периодов,
 *      экран помечается устаревшим, а не притворяется свежим.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePoll(fn, { interval = 3000, enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [at, setAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(
    typeof document !== 'undefined' ? document.hidden : false,
  );
  const busy = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    // Пропускаем такт, если предыдущий ответ ещё не пришёл: иначе на медленной
    // связи запросы начнут накладываться и обгонять друг друга.
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await fnRef.current();
      setData(result);
      setAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return undefined; }
    run();
    if (paused) return undefined;
    const id = setInterval(run, interval);
    return () => clearInterval(id);
    // Зависимости приходят от вызывающего: набор динамический по замыслу.
  }, [enabled, paused, interval, run, ...deps]);

  const ageMs = at ? Date.now() - new Date(at).getTime() : null;

  return {
    data, error, loading, at, paused, reload: run,
    stale: Boolean(at) && ageMs > interval * 3,
  };
}

/**
 * Склейка ленты шагов по id.
 *
 * Пульс отдаёт шаги с запасом по времени (см. комментарий в миграции 016:
 * строка журнала получает время начала своей транзакции, а видимой становится
 * позже, поэтому честное «строго новее» теряло бы шаги навсегда). Значит
 * повторы приходят по замыслу, и убирать их — работа этой функции.
 */
export function mergeSteps(previous, incoming, limit = 300) {
  if (!incoming?.length) return previous || [];
  const seen = new Set();
  const all = [...incoming, ...(previous || [])];
  const out = [];
  for (const step of all) {
    if (seen.has(step.id)) continue;
    seen.add(step.id);
    out.push(step);
  }
  out.sort((a, b) => new Date(b.at) - new Date(a.at));
  return out.slice(0, limit);
}
