/**
 * Документы учёта.
 *
 * Главный экран, где становится видно, откуда взялась каждая цифра в отчёте:
 * у любой суммы есть документ, у документа — проводки, у проводок — автор
 * и время проведения.
 *
 * Проведённый документ не правится. Совсем. Ошибка исправляется сторнирующим
 * документом с собственной датой и причиной. Это неудобно ровно один раз —
 * когда ошибся; и спасает каждый раз, когда нужно объяснить прошлый отчёт.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchEntries, fetchPostings, postEntry, reverseEntry, voidEntry,
} from '@/lib/supabase/queries';
import {
  Badge, Button, ErrorNote, Modal, Panel, Spinner, Stat, StatusBadge, Table,
  Tabs, dateOnly, dateTime, entryStatusLabel, money,
} from '@/components/admin/ui';

const KINDS = {
  invoice: 'счёт клиенту', payment_in: 'оплата от клиента', payment_out: 'платёж поставщику',
  expense: 'расход', payroll: 'оплата труда', tax: 'налоги', transfer: 'перевод',
  owner: 'владелец', opening: 'ввод остатков', reversal: 'сторно', adjustment: 'корректировка',
};

export default function MoneyEntries() {
  const [tab, setTab] = React.useState('draft');
  const list = useAsync(
    () => fetchEntries({ status: tab === 'all' ? undefined : [tab], limit: 300 }),
    [tab],
  );
  const [open, setOpen] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const rows = list.data || [];
  const drafts = rows.filter((r) => r.status === 'draft').length;

  const act = async (fn, id, arg) => {
    setBusy(true); setError(null);
    try { await fn(id, arg); setOpen(null); list.reload(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Документы учёта</h1>
        <span className="text-xs text-muted-foreground">
          Дебет обязан равняться кредиту — иначе документ не проведётся
        </span>
      </div>
      <ErrorNote error={list.error || error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Документов" value={rows.length} />
        <Stat label="Черновиков" value={drafts} tone={drafts > 0 ? 'warn' : 'good'}
              hint="не участвуют в отчётах" />
        <Stat label="Проведено" value={rows.filter((r) => r.status === 'posted').length} />
      </div>

      <Tabs
        value={tab} onChange={setTab}
        items={[
          { value: 'draft', label: 'Черновики' },
          { value: 'posted', label: 'Проведённые' },
          { value: 'void', label: 'Отменённые' },
          { value: 'all', label: 'Все' },
        ]}
      />

      <Panel title="Журнал документов">
        {list.loading ? <Spinner /> : (
          <Table
            onRowClick={(r) => { setOpen(r); setError(null); }}
            empty={tab === 'draft'
              ? 'Черновиков нет: всё разобрано.'
              : 'Документов нет. Они появляются сами, когда вы выставляете счёт или отмечаете оплату.'}
            cols={[
              { key: 'id', title: '№', width: 64,
                render: (r) => <span className="font-mono text-xs">{r.id}</span> },
              { key: 'entry_date', title: 'Дата', render: (r) => dateOnly(r.entry_date) },
              { key: 'kind', title: 'Вид',
                render: (r) => <Badge>{KINDS[r.kind] || r.kind}</Badge> },
              { key: 'memo', title: 'Назначение',
                render: (r) => (
                  <div>
                    <div>{r.memo}</div>
                    {r.reverses && (
                      <div className="text-xs text-amber-400">сторнирует документ №{r.reverses}</div>
                    )}
                    {r.is_reversed && (
                      <div className="text-xs text-amber-400">сторнирован</div>
                    )}
                  </div>
                ) },
              { key: 'company_title', title: 'Клиент',
                render: (r) => r.company_title || <span className="text-muted-foreground">—</span> },
              { key: 'debit', title: 'Дебет', align: 'right', render: (r) => money(r.debit) },
              { key: 'credit', title: 'Кредит', align: 'right',
                render: (r) => (
                  <span className={Number(r.debit) !== Number(r.credit) ? 'text-red-400' : ''}>
                    {money(r.credit)}
                  </span>
                ) },
              { key: 'source', title: 'Откуда',
                render: (r) => <span className="text-xs text-muted-foreground">
                  {{ manual: 'вручную', auto: 'автоматически', agent: 'агент' }[r.source] || r.source}
                </span> },
              { key: 'status', title: 'Состояние',
                render: (r) => <StatusBadge value={r.status} dict={entryStatusLabel} /> },
            ]}
            rows={rows}
          />
        )}
      </Panel>

      {open && (
        <EntryModal entry={open} onClose={() => setOpen(null)} error={error} busy={busy}
                    onPost={() => act(postEntry, open.id)}
                    onVoid={() => {
                      const reason = window.prompt('Почему отменяем черновик?');
                      if (reason === null) return;
                      act(voidEntry, open.id, reason || 'без причины');
                    }}
                    onReverse={() => {
                      const reason = window.prompt('Причина сторно. Она попадёт в назначение нового документа.');
                      if (reason === null) return;
                      if (!reason.trim()) { window.alert('У сторно должна быть причина.'); return; }
                      act(reverseEntry, open.id, reason.trim());
                    }} />
      )}
    </div>
  );
}

function EntryModal({ entry, onClose, onPost, onVoid, onReverse, error, busy }) {
  const postings = useAsync(() => fetchPostings(entry.id), [entry.id]);
  const rows = postings.data || [];
  const dr = rows.filter((p) => p.side === 'dr').reduce((s, p) => s + Number(p.amount), 0);
  const cr = rows.filter((p) => p.side === 'cr').reduce((s, p) => s + Number(p.amount), 0);
  const balanced = dr === cr && rows.length >= 2;

  return (
    <Modal title={`Документ №${entry.id}: ${KINDS[entry.kind] || entry.kind}`} onClose={onClose} wide>
      <div className="space-y-4">
        <ErrorNote error={error} />

        <div className="grid gap-2 rounded-lg border border-line px-3 py-2 text-sm sm:grid-cols-2">
          <Row label="Дата" value={dateOnly(entry.entry_date)} />
          <Row label="Состояние" value={entryStatusLabel(entry.status)} />
          <Row label="Назначение" value={entry.memo} />
          <Row label="Клиент" value={entry.company_title || '—'} />
          {entry.doc_number && <Row label="Счёт" value={entry.doc_number} />}
          {entry.posted_at && (
            <Row label="Проведён"
                 value={`${dateTime(entry.posted_at)}${entry.posted_by_name ? `, ${entry.posted_by_name}` : ''}`} />
          )}
          {entry.reverses && <Row label="Сторнирует" value={`документ №${entry.reverses}`} />}
        </div>

        <Panel title="Проводки">
          {postings.loading ? <Spinner /> : (
            <Table
              empty="Проводок нет. Такой документ провести нельзя: нужно минимум две."
              cols={[
                { key: 'account_code', title: 'Счёт',
                  render: (p) => (
                    <div>
                      <span className="font-mono text-xs">{p.account_code}</span>
                      <div className="text-xs text-muted-foreground">{p.account_title}</div>
                    </div>
                  ) },
                { key: 'dr', title: 'Дебет', align: 'right',
                  render: (p) => p.side === 'dr' ? money(p.amount) : '' },
                { key: 'cr', title: 'Кредит', align: 'right',
                  render: (p) => p.side === 'cr' ? money(p.amount) : '' },
                { key: 'note', title: 'Примечание',
                  render: (p) => p.note || <span className="text-muted-foreground">—</span> },
              ]}
              rows={rows}
              footer={
                <tr>
                  <td className="py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground">Итого</td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums">{money(dr)}</td>
                  <td className={`py-2 pr-3 text-right font-medium tabular-nums ${balanced ? '' : 'text-red-400'}`}>
                    {money(cr)}
                  </td>
                  <td className="py-2 text-xs">
                    {balanced
                      ? <span className="text-emerald-400">сходится</span>
                      : <span className="text-red-400">разница {money(dr - cr)}</span>}
                  </td>
                </tr>
              }
            />
          )}
        </Panel>

        {entry.status === 'draft' && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !balanced} onClick={onPost}>Провести</Button>
            <Button variant="danger" disabled={busy} onClick={onVoid}>Отменить черновик</Button>
            {!balanced && (
              <span className="self-center text-xs text-red-400">
                Пока дебет не равен кредиту, база откажет в проведении — кнопка выключена честно,
                а не для вида.
              </span>
            )}
          </div>
        )}

        {entry.status === 'posted' && (
          <div className="space-y-2">
            {entry.is_reversed ? (
              <p className="rounded-lg border border-line px-3 py-2 text-xs text-muted-foreground">
                Документ уже сторнирован. Второе сторно база не допустит: один документ
                отменяется один раз.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" disabled={busy} onClick={onReverse}>Сторнировать</Button>
                <span className="text-xs text-muted-foreground">
                  Появится новый документ с зеркальными проводками. Этот останется как был.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}
