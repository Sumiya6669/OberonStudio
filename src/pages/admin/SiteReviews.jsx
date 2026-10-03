/**
 * Сайт: отзывы — карантин отзывов, пришедших с сайта (миграция 052).
 *
 * Отзыв из формы на сайте попадает сюда, а не на сайт. Опубликовать его может
 * только человек: «Опубликовать» создаёт обычную запись справочника отзывов
 * (cms.item, коллекция review), и сайт показывает её после пересборки. Другого
 * пути на сайт у отзыва нет.
 *
 * Контакт автора нужен, чтобы проверить, что человек существует и действительно
 * работал с нами. На сайт он не уходит никогда.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { decideReview, fetchReviewInbox, requestRebuild } from '@/lib/supabase/queries';
import { PRODUCTS } from '@/lib/content/site';
import {
  Badge, Button, Empty, ErrorNote, Field, Modal, Spinner, Tabs, ago, inputClass,
} from '@/components/admin/ui';

const TABS = [
  { value: 'pending', label: 'На проверке' },
  { value: 'approved', label: 'Опубликованные' },
  { value: 'rejected', label: 'Отклонённые' },
  { value: 'spam', label: 'Спам' },
];
const productName = (code) => (code ? PRODUCTS.find((p) => p.id === code)?.name || code : 'студия в целом');

export default function SiteReviews() {
  const [status, setStatus] = React.useState('pending');
  const list = useAsync(() => fetchReviewInbox(status), [status]);
  const [reject, setReject] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState('');

  const decide = async (review, verdict, reason = null) => {
    setError(null); setBusy(true); setDone('');
    try {
      await decideReview(review.id, verdict, reason);
      if (verdict === 'approved') {
        // Страницы сайта собираются заранее: без пересборки отзыв не появится.
        try {
          await requestRebuild('review');
          setDone('Опубликовано. Сайт пересобирается — отзыв появится через пару минут.');
        } catch (err) {
          setDone(`Опубликовано, но пересборка не запустилась (${err.message}). Нажмите «Опубликовать» в «Сайт: страницы».`);
        }
      }
      setReject(null); setNote('');
      list.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const rows = list.data || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Сайт: отзывы</h1>
        <span className="text-xs text-muted-foreground">
          Публикуйте только отзывы людей, которые действительно работали с вами. Контакт автора на сайт не уходит.
        </span>
      </div>

      <Tabs items={TABS} value={status} onChange={setStatus} />
      <ErrorNote error={error || list.error} />
      {done && <p className="text-sm text-emerald-400">{done}</p>}

      {list.loading ? <Spinner /> : rows.length === 0 ? (
        <Empty>{status === 'pending' ? 'Новых отзывов нет.' : 'Здесь пусто.'}</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-surface p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{r.author_name}</span>
                {r.author_role && <span className="text-muted-foreground">{r.author_role}</span>}
                {(r.company || r.city) && (
                  <span className="text-muted-foreground">· {[r.company, r.city].filter(Boolean).join(', ')}</span>
                )}
                {r.rating && <Badge>{'★'.repeat(r.rating)}</Badge>}
                <Badge>{productName(r.product_code)}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{ago(r.created_at)}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{r.body}</p>
              <div className="text-xs text-muted-foreground">
                Контакт для проверки (не публикуется): <span className="text-foreground">{r.contact}</span>
                {r.page && <> · отправлен со страницы {r.page}</>}
              </div>
              {r.decision_note && <div className="text-xs text-muted-foreground">Причина: {r.decision_note}</div>}
              {status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => decide(r, 'approved')}>Опубликовать</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => { setReject(r); setNote(''); }}>
                    Отклонить
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => decide(r, 'spam')}>Это спам</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reject && (
        <Modal title="Отклонить отзыв" onClose={() => setReject(null)}>
          <div className="space-y-4 p-5">
            <Field label="Причина" hint="Видна только в панели. Например: «не наш клиент», «не подтвердил по телефону».">
              <textarea className={inputClass} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReject(null)}>Отмена</Button>
              <Button disabled={busy} onClick={() => decide(reject, 'rejected', note.trim() || null)}>Отклонить</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
