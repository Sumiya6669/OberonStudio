/**
 * Счета и акты.
 *
 * Счёт из отработанных часов собирается функцией базы, а не этой формой.
 * Причина: защита от повторного выставления — это одна колонка invoiced_in
 * и триггер, а не проверка в интерфейсе. Если бы отбор часов делал браузер,
 * два открытых окна выставили бы один час дважды.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchDocs, fetchCompanies, fetchUnbilled, invoiceFromTime, updateDoc,
} from '@/lib/supabase/queries';
import { Button, ErrorNote, Field, Modal, Panel, Spinner, Stat, StatusBadge,
  Table, Tabs, Toolbar, dateOnly, docStatusLabel, inputClass, money, num,
} from '@/components/admin/ui';

const FILTERS = [
  { value: 'live', label: 'Действующие', statuses: ['draft', 'issued', 'partly_paid', 'overdue'] },
  { value: 'paid', label: 'Оплаченные', statuses: ['paid'] },
  { value: 'all', label: 'Все', statuses: null },
];

const firstOfMonth = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export default function MoneyDocs() {
  const [filter, setFilter] = React.useState('live');
  const statuses = FILTERS.find((f) => f.value === filter)?.statuses;
  const docs = useAsync(() => fetchDocs({ status: statuses || undefined }), [filter]);
  const companies = useAsync(fetchCompanies);
  const unbilled = useAsync(fetchUnbilled);
  const [form, setForm] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const rows = docs.data || [];
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const rest = rows.reduce((s, r) => s + Number(r.rest || 0), 0);
  const late = rows.filter((r) => r.is_late).length;

  const openForm = () => {
    setError(null);
    setForm({ company_id: '', from: firstOfMonth(), to: today(), due_days: 10 });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await invoiceFromTime({
        company_id: form.company_id,
        from: form.from,
        to: form.to,
        due_days: Number(form.due_days),
      });
      setForm(null);
      docs.reload(); unbilled.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const cancelDoc = async (doc) => {
    if (!window.confirm(`Отменить счёт ${doc.number}? Часы вернутся в невыставленные не автоматически — их надо будет пересобрать.`)) return;
    try { await updateDoc(doc.id, { status: 'cancelled' }); docs.reload(); }
    catch (err) { setError(err); }
  };

  const forCompany = (id) => (unbilled.data || []).find((u) => u.company_id === id);
  const picked = form?.company_id ? forCompany(form.company_id) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Счета и акты</h1>
        <Button onClick={openForm}>Счёт из отработанных часов</Button>
      </div>
      <ErrorNote error={docs.error || error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Документов" value={rows.length} />
        <Stat label="На сумму" value={money(total)} />
        <Stat label="Не оплачено" value={money(rest)} tone={rest > 0 ? 'warn' : 'good'} />
        <Stat label="Просрочено" value={late} tone={late > 0 ? 'bad' : 'good'}
              hint="срок оплаты прошёл" />
      </div>

      <Toolbar>
        <Tabs items={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
              value={filter} onChange={setFilter} />
      </Toolbar>

      <Panel title="Документы">
        {docs.loading ? <Spinner /> : (
          <Table
            empty="Счетов нет. Кнопка выше собирает счёт из часов, записанных в разделе «Время»."
            cols={[
              { key: 'number', title: 'Номер',
                render: (r) => (
                  <div>
                    <div className="font-mono text-xs">{r.number}</div>
                    <div className="text-xs text-muted-foreground">
                      {{ invoice: 'счёт', act: 'акт', contract: 'договор' }[r.kind] || r.kind}
                    </div>
                  </div>
                ) },
              { key: 'company_title', title: 'Клиент', render: (r) => r.company_title || '—' },
              { key: 'issued_on', title: 'Выставлен',
                render: (r) => (
                  <div>
                    <div>{dateOnly(r.issued_on)}</div>
                    {r.due_on && (
                      <div className={`text-xs ${r.is_late ? 'text-red-400' : 'text-muted-foreground'}`}>
                        оплатить до {dateOnly(r.due_on)}
                      </div>
                    )}
                  </div>
                ) },
              { key: 'amount', title: 'Сумма', align: 'right', render: (r) => money(r.amount) },
              { key: 'paid', title: 'Оплачено', align: 'right',
                render: (r) => Number(r.paid) > 0 ? money(r.paid) : '—' },
              { key: 'rest', title: 'Остаток', align: 'right',
                render: (r) => Number(r.rest) > 0
                  ? <span className="text-amber-400">{money(r.rest)}</span>
                  : <span className="text-emerald-400">закрыт</span> },
              { key: 'status', title: 'Состояние',
                render: (r) => (
                  <div className="space-y-1">
                    <StatusBadge value={r.status} dict={docStatusLabel} />
                    {Number(r.posted_entries) === 0 && r.status !== 'cancelled' && (
                      <div className="text-xs text-amber-400">проводка не проведена</div>
                    )}
                  </div>
                ) },
              { key: 'tickets', title: 'Заявки',
                render: (r) => !r.ticket_ids?.length ? '—' : (
                  <div className="flex flex-wrap gap-1">
                    {r.ticket_ids.slice(0, 4).map((id) => (
                      <Link key={id} to={`/admin/tickets/${id}`}
                            className="rounded border border-line px-1.5 text-xs text-blue hover:underline">
                        #{id}
                      </Link>
                    ))}
                    {r.ticket_ids.length > 4 && (
                      <span className="text-xs text-muted-foreground">+{r.ticket_ids.length - 4}</span>
                    )}
                  </div>
                ) },
              { key: 'act', title: '', align: 'right',
                render: (r) => r.status === 'cancelled' || r.status === 'paid' ? null : (
                  <Button variant="ghost" onClick={() => cancelDoc(r)}>Отменить</Button>
                ) },
            ]}
            rows={rows}
          />
        )}
      </Panel>

      {form && (
        <Modal title="Счёт из отработанных часов" onClose={() => setForm(null)}>
          <form onSubmit={submit} className="space-y-4">
            <ErrorNote error={error} />
            <Field label="Клиент">
              <select className={inputClass} required value={form.company_id}
                      onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                <option value="">— выберите —</option>
                {(companies.data || []).map((c) => {
                  const u = forCompany(c.id);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.title}{u ? ` — ${num(u.hours, 1)} ч не выставлено` : ' — нечего выставлять'}
                    </option>
                  );
                })}
              </select>
            </Field>

            {picked && (
              <div className="rounded-lg border border-line px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Невыставленных часов</span>
                  <span className="tabular-nums">{num(picked.hours, 1)} ч</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ставка</span>
                  <span className="tabular-nums">{money(picked.hourly_rate)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-line pt-1 font-medium">
                  <span>Итого по всем часам</span>
                  <span className="tabular-nums">{money(picked.amount)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  В счёт попадут только часы из выбранного периода. Отбор делает база.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Часы с">
                <input className={inputClass} type="date" required value={form.from}
                       onChange={(e) => setForm({ ...form, from: e.target.value })} />
              </Field>
              <Field label="по">
                <input className={inputClass} type="date" required value={form.to}
                       onChange={(e) => setForm({ ...form, to: e.target.value })} />
              </Field>
            </div>

            <Field label="Срок оплаты, дней"
                   hint="По истечении срока «Сторож» сам помечает счёт просроченным.">
              <input className={inputClass} type="number" min="0" max="120" required
                     value={form.due_days}
                     onChange={(e) => setForm({ ...form, due_days: e.target.value })} />
            </Field>

            <p className="text-xs text-muted-foreground">
              Счёт на нулевую сумму база не выставит: если за период нет невыставленных
              оплачиваемых часов, вы получите отказ, а не пустой документ.
            </p>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Выставить</Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
