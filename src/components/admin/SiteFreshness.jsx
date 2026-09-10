/**
 * Полоска «сайт отстал от панели».
 *
 * Самая коварная поломка CMS — та, где всё «работает»: человек нажал
 * «Опубликовать», панель написала «опубликовано», а на сайте прежний текст.
 * Так происходит потому, что страницы собираются заранее, и правка попадает
 * туда только со сборкой.
 *
 * Поэтому панель говорит об этом сама и до вопроса: пока есть правки, до
 * сайта не доехавшие, здесь висит полоска с кнопкой. Когда всё совпадает —
 * тихая строчка с временем последней сборки, без призывов нажимать.
 */
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchSiteFreshness, requestRebuild } from '@/lib/supabase/queries';
import { Button, ago, cx, dateTime } from './ui';

export default function SiteFreshness({ reason = 'publish', compact = false }) {
  const [state, setState] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState(null);
  const [error, setError] = React.useState(null);

  const load = React.useCallback(() => {
    fetchSiteFreshness().then(setState).catch((e) => setError(e.message));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const run = async () => {
    setBusy(true); setError(null); setNote(null);
    try {
      await requestRebuild(reason);
      // Сборка занимает около минуты. Обещать «готово» сразу нельзя —
      // это была бы ровно та же неправда, от которой мы уходим.
      setNote('Сборка запущена. Через минуту-полторы обновите сайт.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !state) return null;

  const stale = Boolean(state?.stale);
  const built = state?.built_at;

  return (
    <div className={cx(
      'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm',
      stale ? 'border-amber-500/30 bg-amber-500/5' : 'border-line bg-surface/40',
      compact && 'px-3 py-2',
    )}>
      <div className="min-w-0 flex-1">
        {stale ? (
          <span className="text-amber-300">
            На сайте ещё старая версия: правки есть, сборки после них не было.
          </span>
        ) : (
          <span className="text-muted-foreground">
            Сайт собран {built ? `${dateTime(built)} · ${ago(built)}` : '— сборок ещё не было'}
          </span>
        )}
        {note && <div className="mt-1 text-xs text-blue">{note}</div>}
        {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
      </div>
      <Button variant={stale ? 'primary' : 'ghost'} onClick={run} disabled={busy}>
        <RefreshCw className={cx('mr-1.5 inline h-3.5 w-3.5', busy && 'animate-spin')} />
        {busy ? 'Запускаю…' : 'Обновить сайт'}
      </Button>
    </div>
  );
}
