/**
 * Отчёты.
 *
 * Про себестоимость часа стоит сказать прямо: она считается как все расходы
 * месяца, поделённые на оплачиваемые часы месяца. Это грубо. Подписки, связь
 * и обучение не делятся по клиентам честно — и попытка разложить их точнее
 * даст красивую, но выдуманную цифру. Грубая правда полезнее точной выдумки:
 * по этой цифре видно, ниже какой ставки работать нельзя.
 *
 * Прибыль по клиенту опирается на неё же, поэтому в месяцах без расходов
 * себестоимость пустая, а не нулевая: «расходов не записано» и «расходов нет» —
 * разные утверждения.
 */
import React from 'react';
import {
  Bar as RBar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchPnl, fetchPnlLines, fetchBalance, fetchClientProfit, fetchHourCost, fetchCashMonths,
} from '@/lib/supabase/queries';
import {
  Badge, Empty, ErrorNote, Panel, Spinner, Stat, Table, Tabs, money, num, pct,
} from '@/components/admin/ui';

const monthLabel = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
};

export default function MoneyReports() {
  const [tab, setTab] = React.useState('pnl');
  const pnl = useAsync(fetchPnl);
  const lines = useAsync(() => fetchPnlLines());
  const balance = useAsync(fetchBalance);
  const clients = useAsync(fetchClientProfit);
  const hourCost = useAsync(fetchHourCost);
  const cash = useAsync(fetchCashMonths);

  if (pnl.loading) return <Spinner />;

  const months = (pnl.data || []).slice().reverse().map((m) => ({
    ...m,
    label: monthLabel(m.month),
    income: Number(m.income),
    expenses: Number(m.expenses),
    profit: Number(m.profit),
  }));

  const totals = (pnl.data || []).reduce(
    (acc, m) => ({
      income: acc.income + Number(m.income || 0),
      expenses: acc.expenses + Number(m.expenses || 0),
      profit: acc.profit + Number(m.profit || 0),
    }), { income: 0, expenses: 0, profit: 0 },
  );

  const accounts = balance.data || [];
  const trialDr = accounts.reduce((s, a) => s + Number(a.debit || 0), 0);
  const trialCr = accounts.reduce((s, a) => s + Number(a.credit || 0), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Отчёты</h1>
      <ErrorNote error={pnl.error || balance.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Доход всего" value={money(totals.income)} />
        <Stat label="Расход всего" value={money(totals.expenses)} />
        <Stat label="Прибыль всего" value={money(totals.profit)}
              tone={totals.profit > 0 ? 'good' : totals.profit < 0 ? 'bad' : 'default'}
              hint={totals.income ? `рентабельность ${num(100 * totals.profit / totals.income, 1)} %` : undefined} />
        <Stat label="Оборотка" value={trialDr === trialCr ? 'сходится' : 'не сходится'}
              tone={trialDr === trialCr ? 'good' : 'bad'}
              hint={`дебет ${money(trialDr)} / кредит ${money(trialCr)}`} />
      </div>

      <Tabs
        value={tab} onChange={setTab}
        items={[
          { value: 'pnl', label: 'Прибыль по месяцам' },
          { value: 'trial', label: 'Оборотно-сальдовая' },
          { value: 'clients', label: 'Прибыль по клиентам' },
          { value: 'hour', label: 'Себестоимость часа' },
          { value: 'cash', label: 'Движение денег' },
        ]}
      />

      {tab === 'pnl' && (
        <>
          <Panel title="Доход, расход и прибыль по месяцам">
            {!months.length ? (
              <Empty>Проведённых документов нет — считать нечего.</Empty>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} width={70}
                           tickFormatter={(v) => num(v / 1000) + 'к'} />
                    <Tooltip formatter={(v, n) => [money(v), n]}
                             contentStyle={{ background: 'rgba(12,14,20,0.95)',
                                             border: '1px solid rgba(255,255,255,0.12)',
                                             borderRadius: 12, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <RBar name="доход" dataKey="income" fill="#10d4a8" radius={[4, 4, 0, 0]} />
                    <RBar name="расход" dataKey="expenses" fill="#f0a020" radius={[4, 4, 0, 0]} />
                    <RBar name="прибыль" dataKey="profit" fill="#4d7fff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="По месяцам">
            <Table
              empty="Нет данных."
              rowKey={(r) => r.month}
              cols={[
                { key: 'month', title: 'Месяц', render: (r) => monthLabel(r.month) },
                { key: 'income', title: 'Доход', align: 'right', render: (r) => money(r.income) },
                { key: 'expenses', title: 'Расход', align: 'right', render: (r) => money(r.expenses) },
                { key: 'profit', title: 'Прибыль', align: 'right',
                  render: (r) => (
                    <span className={Number(r.profit) < 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {money(r.profit)}
                    </span>
                  ) },
                { key: 'margin_pct', title: 'Рентабельность', align: 'right',
                  render: (r) => pct(r.margin_pct) },
              ]}
              rows={pnl.data || []}
            />
          </Panel>

          <Panel title="Из чего сложилось">
            {lines.loading ? <Spinner /> : (
              <Table
                empty="Нет проведённых доходов и расходов."
                rowKey={(r) => `${r.month}-${r.code}`}
                cols={[
                  { key: 'month', title: 'Месяц', render: (r) => monthLabel(r.month) },
                  { key: 'kind', title: 'Вид',
                    render: (r) => <Badge tone={r.kind === 'income' ? 'approved' : undefined}>
                      {r.kind === 'income' ? 'доход' : 'расход'}
                    </Badge> },
                  { key: 'code', title: 'Счёт',
                    render: (r) => <span className="font-mono text-xs">{r.code}</span> },
                  { key: 'title', title: 'Статья' },
                  { key: 'amount', title: 'Сумма', align: 'right', render: (r) => money(r.amount) },
                ]}
                rows={lines.data || []}
              />
            )}
          </Panel>
        </>
      )}

      {tab === 'trial' && (
        <Panel title="Оборотно-сальдовая"
               action={<span className={`text-xs ${trialDr === trialCr ? 'text-emerald-400' : 'text-red-400'}`}>
                 {trialDr === trialCr
                   ? 'дебет равен кредиту'
                   : `расхождение ${money(trialDr - trialCr)} — это ошибка данных, а не округление`}
               </span>}>
          <Table
            empty="План счетов пуст."
            rowKey={(r) => r.code}
            cols={[
              { key: 'code', title: 'Счёт', width: 80,
                render: (r) => <span className="font-mono text-xs">{r.code}</span> },
              { key: 'title', title: 'Название',
                render: (r) => (
                  <span className={r.is_group ? 'font-medium' : 'pl-4 text-muted-foreground'}>
                    {r.title}
                  </span>
                ) },
              { key: 'debit', title: 'Дебет', align: 'right',
                render: (r) => Number(r.debit) ? money(r.debit) : '—' },
              { key: 'credit', title: 'Кредит', align: 'right',
                render: (r) => Number(r.credit) ? money(r.credit) : '—' },
              { key: 'saldo', title: 'Сальдо', align: 'right',
                render: (r) => Number(r.postings) ? money(r.saldo) : '—' },
            ]}
            rows={accounts}
            footer={
              <tr>
                <td colSpan={2} className="py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Итого
                </td>
                <td className="py-2 pr-3 text-right font-medium tabular-nums">{money(trialDr)}</td>
                <td className="py-2 pr-3 text-right font-medium tabular-nums">{money(trialCr)}</td>
                <td />
              </tr>
            }
          />
        </Panel>
      )}

      {tab === 'clients' && (
        <Panel title="Прибыль по клиентам">
          {clients.loading ? <Spinner /> : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Себестоимость клиента = его часы × себестоимость часа того месяца.
                Общие расходы честно по клиентам не делятся, поэтому цифра приблизительная —
                но её достаточно, чтобы увидеть клиента, на котором вы теряете.
              </p>
              <Table
                empty="Компаний нет."
                rowKey={(r) => r.company_id}
                cols={[
                  { key: 'company_title', title: 'Клиент' },
                  { key: 'hourly_rate', title: 'Ставка', align: 'right',
                    render: (r) => money(r.hourly_rate) },
                  { key: 'hours', title: 'Часы', align: 'right',
                    render: (r) => (
                      <div>
                        <div>{num(r.hours, 1)}</div>
                        <div className="text-xs text-muted-foreground">
                          оплачиваемых {num(r.hours_billable, 1)}
                        </div>
                      </div>
                    ) },
                  { key: 'income', title: 'Доход', align: 'right', render: (r) => money(r.income) },
                  { key: 'cost', title: 'Себестоимость', align: 'right',
                    render: (r) => Number(r.cost) ? money(r.cost) : '—' },
                  { key: 'profit', title: 'Прибыль', align: 'right',
                    render: (r) => (
                      <span className={Number(r.profit) < 0 ? 'text-red-400'
                        : Number(r.profit) > 0 ? 'text-emerald-400' : ''}>
                        {money(r.profit)}
                      </span>
                    ) },
                  { key: 'margin_pct', title: 'Рентабельность', align: 'right',
                    render: (r) => pct(r.margin_pct) },
                ]}
                rows={(clients.data || []).filter(
                  (r) => Number(r.income) || Number(r.hours),
                )}
              />
            </>
          )}
        </Panel>
      )}

      {tab === 'hour' && (
        <Panel title="Себестоимость часа по месяцам">
          {hourCost.loading ? <Spinner /> : !hourCost.data?.length ? (
            <Empty>
              Ни расходов, ни записанного времени. Пока нет ни того, ни другого,
              себестоимость часа не существует — и это честнее нуля.
            </Empty>
          ) : (
            <>
              <div className="mb-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourCost.data.slice().reverse().map((r) => ({
                    ...r, label: monthLabel(r.month), cost: Number(r.cost_per_hour || 0),
                  }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} width={70}
                           tickFormatter={(v) => num(v / 1000) + 'к'} />
                    <Tooltip formatter={(v) => [money(v), 'себестоимость часа']}
                             contentStyle={{ background: 'rgba(12,14,20,0.95)',
                                             border: '1px solid rgba(255,255,255,0.12)',
                                             borderRadius: 12, fontSize: 12 }} />
                    <Line type="monotone" dataKey="cost" stroke="#f0a020" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Table
                rowKey={(r) => r.month}
                cols={[
                  { key: 'month', title: 'Месяц', render: (r) => monthLabel(r.month) },
                  { key: 'expenses', title: 'Расходы', align: 'right', render: (r) => money(r.expenses) },
                  { key: 'hours_billable', title: 'Оплачиваемых часов', align: 'right',
                    render: (r) => num(r.hours_billable, 1) },
                  { key: 'hours_total', title: 'Всего часов', align: 'right',
                    render: (r) => num(r.hours_total, 1) },
                  { key: 'cost_per_hour', title: 'Себестоимость часа', align: 'right',
                    render: (r) => r.cost_per_hour
                      ? money(r.cost_per_hour)
                      : <span className="text-muted-foreground">нет данных</span> },
                ]}
                rows={hourCost.data}
              />
            </>
          )}
        </Panel>
      )}

      {tab === 'cash' && (
        <Panel title="Движение денег по месяцам">
          {cash.loading ? <Spinner /> : (
            <Table
              empty="Проведённых денежных документов нет."
              rowKey={(r) => r.month}
              cols={[
                { key: 'month', title: 'Месяц', render: (r) => monthLabel(r.month) },
                { key: 'money_in', title: 'Пришло', align: 'right',
                  render: (r) => <span className="text-emerald-400">{money(r.money_in)}</span> },
                { key: 'money_out', title: 'Ушло', align: 'right',
                  render: (r) => <span className="text-amber-400">{money(r.money_out)}</span> },
                { key: 'net', title: 'Итого', align: 'right',
                  render: (r) => (
                    <span className={Number(r.net) < 0 ? 'text-red-400' : ''}>{money(r.net)}</span>
                  ) },
              ]}
              rows={cash.data || []}
            />
          )}
        </Panel>
      )}
    </div>
  );
}
