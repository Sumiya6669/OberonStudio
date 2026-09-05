/**
 * Загрузка данных без библиотеки состояния: три поля и функция перезагрузки.
 * Отдельный файл, потому что этим пользуются все экраны, а условия одинаковые.
 */
import { useCallback, useEffect, useState } from 'react';

export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((result) => { if (alive) { setData(result); setError(null); } })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // Зависимости приходят от вызывающего: список динамический по замыслу.
  }, [...deps, tick]);

  return { data, error, loading, reload };
}
