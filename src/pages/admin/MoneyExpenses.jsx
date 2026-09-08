/**
 * Расходы.
 *
 * Расход заводится одной операцией: документ и обе проводки создаются вместе.
 * Документ без проводок — это мусор в журнале, который через месяц никто
 * не опознает, поэтому интерфейс не может его создать даже случайно.
 *
 * Проводится расход отдельным нажатием. Это не лишний шаг: до проведения
 * цифра не попадает ни в прибыль, ни в себестоимость часа, и черновик можно
 * спокойно отменить. После проведения — только сторно.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchEntries, fetchAccounts, fetchCompanies, addExpense, postEntry, voidEntry,
} from '@/lib/supabase/queries';
import {
  Badge, Button, ErrorNote, Field, Modal, Panel, Spinner, Stat, StatusBadge,
  Table, Tabs, dateOnly, entryStatusLabel, inputClass, money,
} from '@/components/admin/ui';

const KINDS = [
  ['expense', 'Расход'],
  ['payroll', 'Оплата труда'],
  ['tax', 'Налоги и сборы'],
];

const today = () => new Date().toISOString().slice(0, 10);

export default function MoneyExpenses() {
  const [tab, setTab] = React.useState('draft');
  const list = useAsync(
    () => fetchEntries({ status: tab === 'all' ? undefined : [tab], limit: 300 }),
    [tab],
  );
  const accounts = useAsync(fetchAccounts);
  const companies = useAsync(fetchCompanies);
  const [form, setForm] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const expenseAccounts = (accounts.data || [])
    .filter((a) => a.kind === 'expense' && !a.is_group && a.is_active);
  const payAccounts = (accounts.data || [])
    .filter((a) => !a.is_group && a.is_active && ['asset', 'liability'].includes(a.kind));

  const rows = (list.data || []).filter((e) => ['expense', 'payroll', 'tax'].includes(e.kind));
  const sum = rows.reduce((s, r) => s + Number(r.debit || 0), 0);

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await addExpense({
        amount: Number(form.amount),
        expense_code: form.expense_code,
        paid_from: form.paid_from,
        entry_date: form.entry_date,
        memo: form.memo.trim(),
        kind: form.kind,
        company_id: form.company_id || null,
      });
      setForm(null); list.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const act = async (fn, id, arg) => {
    setError(null);
    try { await fn(id, arg); list.reload(); } catch (err) { setError(err); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Расходы</h1>
        <Button onClick={() => {
          setError(null);
          setForm({
            kind: 'expense', amount: '', expense_code: expenseAccounts[0]?.code || '7110',
            paid_from: '1030', entry_date: today(), memo: '', company_id: '',
          });
        }}>
          Записать расход
        </Button>
      </div>
      <ErrorNote error={list.error || error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Документов" value={rows.length} />
        <Stat label="На сумму" value={money(sum)} />
        <Stat label="Счетов расхода" value={expenseAccounts.length}
              hint="правятся в плане счетов" />
      </div>

      <Tabs
        value={tab} onChange={setTab}
        items={[
          { value: 'draft', label: 'Черновики' },
          { value: 'posted', label: 'Проведённые' },
          { value: 'all', label: 'Все' },
        ]}
      />

      <Panel title="Расходные документы"
             action={<Link to="/admin/money/entries" className="text-xs text-blue hover:underline">
               Все документы учёта →
             </Link>}>
        {list.loading ? <Spinner /> : (
          <Table
            empty={tab === 'draft'
              ? 'Черновиков расхода нет.'
              : 'Расходов ещё не записано. Пока их нет, себестоимость часа не считается — и прибыль по клиенту тоже.'}
            cols={[
              { key: 'entry_date', title: 'Дата', render: (r) => dateOnly(r.entry_date) },
              { key: 'kind', title: 'Вид',
                render: (r) => <Badge>{(KINDS.find((k) => k[0] === r.kind) || [, r.kind])[1]}</Badge> },
              { key: 'memo', title: 'Назначение' },
              { key: 'company_title', title: 'Клиент',
                render: (r) => r.company_title || <span className="text-muted-foreground">общий</span> },
              { key: 'debit', title: 'Сумма', align: 'right', render: (r) => money(r.debit) },
              { key: 'status', title: 'Состояние',
                render: (r) => <StatusBadge value={r.status} dict={entryStatusLabel} /> },
              { key: 'act', title: '', align: 'right',
                render: (r) => r.status !== 'draft' ? null : (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" onClick={() => act(postEntry, r.id)}>Провести</Button>
                    <Button variant="danger" onClick={() => {
                      const reason = window.prompt('Почему отменяем черновик?');
                      if (reason === null) return;
                      act(voidEntry, r.id, reason || 'без причины');
                    }}>Отменить</Button>
                  </div>
                ) },
            ]}
            rows={rows}
          />
        )}
      </Panel>

      {form && (
        <Modal title="Расход" onClose={() => setForm(null)}>
          <form onSubmit={submit} className="space-y-4">
            <ErrorNote error={error} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Вид">
                <select className={inputClass} value={form.kind}
                        onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {KINDS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </Field>
              <Field label="Дата">
                <input className={inputClass} type="date" required value={form.entry_date}
                       onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
              </Field>
            </div>

            <Field label="Назначение" hint="Обязательно. Без него через месяц не вспомнить, за что платили.">
              <input className={inputClass} required value={form.memo}
                     onChange={(e) => setForm({ ...form, memo: e.target.value })}
                     placeholder="например: Anthropic, подписка за сентябрь" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Статья расхода">
                <select className={inputClass} required value={form.expense_code}
                        onChange={(e) => setForm({ ...form, expense_code: e.target.value })}>
                  {expenseAccounts.map((a) => (
                    <option key={a.code} value={a.code}>{a.code} · {a.title}</option>
                  ))}
                </select>
              </Field>
              <Field label="Откуда платим">
                <select className={inputClass} required value={form.paid_from}
                        onChange={(e) => setForm({ ...form, paid_from: e.target.value })}>
                  {payAccounts.map((a) => (
                    <option key={a.code} value={a.code}>{a.code} · {a.title}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Сумма, ₸">
              <input className={inputClass} type="number" min="0.01" step="0.01" required
                     value={form.amount}
                     onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>

            <Field label="Отнести на клиента"
                   hint="Не обязательно. Подписки и аренда общие, и делить их по клиентам честно не получится.">
              <select className={inputClass} value={form.company_id}
                      onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                <option value="">— общий расход —</option>
                {(companies.data || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </Field>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Создать черновик</Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Отмена</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Создаётся черновик. Он не влияет на отчёты, пока вы его не проведёте.
            </p>
          </form>
        </Modal>
      )}
    </div>
  );
}
