/**
 * Оплаты.
 *
 * Статус счёта после оплаты считает база, а не человек глазами: оплатили
 * половину — «оплачен частично», всю сумму — «оплачен». Руками этот статус
 * не ставится, поэтому «оплачен» в панели всегда означает «деньги пришли».
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchPayments, fetchDocs, fetchCompanies, addPayment,
} from '@/lib/supabase/queries';
import {
  Badge, Button, ErrorNote, Field, Modal, Panel, Spinner, Stat, Table,
  dateOnly, inputClass, money,
} from '@/components/admin/ui';

const today = () => new Date().toISOString().slice(0, 10);

export default function MoneyPayments() {
  const { person } = useAuth();
  const list = useAsync(fetchPayments);
  const docs = useAsync(() => fetchDocs({ status: ['issued', 'partly_paid', 'overdue'] }));
  const companies = useAsync(fetchCompanies);
  const [form, setForm] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (list.loading) return <Spinner />;

  const rows = list.data || [];
  const monthStart = today().slice(0, 8) + '01';
  const monthSum = rows
    .filter((r) => r.paid_on >= monthStart)
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      const doc = (docs.data || []).find((d) => String(d.id) === String(form.doc_id));
      await addPayment({
        tenant_id: person.tenant_id,
        doc_id: form.doc_id ? Number(form.doc_id) : null,
        company_id: form.doc_id ? doc.company_id : form.company_id,
        paid_on: form.paid_on,
        amount: Number(form.amount),
        source: 'manual',
        note: form.note?.trim() || null,
      });
      setForm(null);
      list.reload(); docs.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const doc = form?.doc_id
    ? (docs.data || []).find((d) => String(d.id) === String(form.doc_id))
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Оплаты</h1>
        <Button onClick={() => { setError(null); setForm({ doc_id: '', company_id: '', paid_on: today(), amount: '', note: '' }); }}>
          Отметить оплату
        </Button>
      </div>
      <ErrorNote error={list.error || error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Оплат всего" value={rows.length} />
        <Stat label="Поступило за месяц" value={money(monthSum)} tone="good" />
        <Stat label="Счетов ждут оплаты" value={(docs.data || []).length}
              tone={(docs.data || []).length ? 'warn' : 'good'} />
      </div>

      <Panel title="Поступления">
        <Table
          empty="Оплат ещё не было. Каждая отмеченная оплата создаёт черновик проводки: деньги приходят, дебиторка гасится."
          cols={[
            { key: 'paid_on', title: 'Дата', render: (r) => dateOnly(r.paid_on) },
            { key: 'company', title: 'Клиент', render: (r) => r.company?.title || '—' },
            { key: 'doc', title: 'Счёт',
              render: (r) => r.doc
                ? <span className="font-mono text-xs">{r.doc.number}</span>
                : <span className="text-xs text-muted-foreground">без счёта</span> },
            { key: 'amount', title: 'Сумма', align: 'right', render: (r) => money(r.amount) },
            { key: 'source', title: 'Источник',
              render: (r) => <Badge>{r.source === 'manual' ? 'вручную' : 'выписка'}</Badge> },
            { key: 'note', title: 'Примечание',
              render: (r) => r.note || <span className="text-muted-foreground">—</span> },
          ]}
          rows={rows}
        />
      </Panel>

      {form && (
        <Modal title="Оплата" onClose={() => setForm(null)}>
          <form onSubmit={submit} className="space-y-4">
            <ErrorNote error={error} />
            <Field label="Счёт" hint="Оплата без счёта возможна — тогда укажите клиента вручную.">
              <select className={inputClass} value={form.doc_id}
                      onChange={(e) => {
                        const d = (docs.data || []).find((x) => String(x.id) === e.target.value);
                        setForm({ ...form, doc_id: e.target.value,
                                  amount: d ? String(d.rest) : form.amount });
                      }}>
                <option value="">— без счёта —</option>
                {(docs.data || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.number} · {d.company_title} · остаток {money(d.rest)}
                  </option>
                ))}
              </select>
            </Field>

            {!form.doc_id && (
              <Field label="Клиент">
                <select className={inputClass} required value={form.company_id}
                        onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                  <option value="">— выберите —</option>
                  {(companies.data || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </Field>
            )}

            {doc && (
              <div className="rounded-lg border border-line px-3 py-2 text-xs text-muted-foreground">
                По счёту {doc.number} выставлено {money(doc.amount)},
                уже оплачено {money(doc.paid)}, остаток {money(doc.rest)}.
                Если внесёте больше остатка, счёт станет оплаченным, а переплата
                останется видна в сальдо расчётов.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Дата">
                <input className={inputClass} type="date" required value={form.paid_on}
                       onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
              </Field>
              <Field label="Сумма, ₸">
                <input className={inputClass} type="number" min="1" step="0.01" required
                       value={form.amount}
                       onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
            </div>

            <Field label="Примечание">
              <input className={inputClass} value={form.note}
                     onChange={(e) => setForm({ ...form, note: e.target.value })}
                     placeholder="например: платёж по Kaspi" />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Записать</Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
