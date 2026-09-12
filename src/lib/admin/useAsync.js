/**
 * Загрузка данных без библиотеки состояния: три поля и функция перезагрузки.
 * Отдельный файл, потому что этим пользуются все экраны, а условия одинаковые.
 */
import { useCallback, useEffect, useState } from 'react';

// Часы сервера авторизации и часы базы расходятся на секунду-две. Токен,
// выписанный только что, база какое-то мгновение считает выписанным в
// будущем и отказывает. Это не ошибка прав и не повод показывать её
// человеку: через секунду тот же запрос пройдёт. Повторяем один раз.
const SKEW = /issued at future|jwt.*not yet valid/i;

function once(fn) {
  return fn().catch((err) => {
    if (!SKEW.test(String(err?.message ?? err))) throw err;
    return new Promise((resolve, reject) => {
      setTimeout(() => fn().then(resolve, reject), 1200);
    });
  });
}

export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    once(fn)
      .then((result) => { if (alive) { setData(result); setError(null); } })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // Зависимости приходят от вызывающего: список динамический по замыслу.
  }, [...deps, tick]);

  return { data, error, loading, reload };
}
