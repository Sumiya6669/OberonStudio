/**
 * Деньги: обзор.
 *
 * Здесь четыре вопроса, на которые студия должна отвечать не по памяти:
 * сколько денег есть, кто сколько должен, сколько часов отработано и ещё не
 * выставлено, зарабатываю я или проедаю.
 *
 * Отдельно про «неоплачиваемые часы» и «невыставленное»: это самая частая
 * дыра в мелкой студии. Работа сделана, время записано, счёт не выставлен —
 * и через два месяца никто уже не помнит, за что просить деньги.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchBalance, fetchPnl, fetchReceivables, fetchUnbilled, fetchHourCost, fetchEntries,
} from '@/lib/supabase/queries';
import {
  Badge, Empty, ErrorNote, Panel, Spinner, Stat, StatusBadge, Table,
  dateOnly, entryStatusLabel, money, num,
} from '@/components/admin/ui';

export default function MoneyOverview() {
  const balance = useAsync(fetchBalance);
  const pnl = useAsync(fetchPnl);
  const ar = useAsync(fetchReceivables);
  const unbilled = useAsync(fetchUnbilled);
  const hourCost = useAsync(fetchHourCost);
  const drafts = useAsync(() => fetchEntries({ status: ['draft'], limit: 20 }));

  if (balance.loading) return <Spinner />;

  const accounts = balance.data || [];
  const cash = accounts
    .filter((a) => a.is_cash)
    .reduce((sum, a) => sum + Number(a.saldo || 0), 0);
  const thisMonth = (pnl.data || [])[0];
  const hc = (hourCost.data || [])[0];
  const debt = (ar.data || []).reduce((s, r) => s + Number(r.debt || 0), 0);
  const overdue = (ar.data || []).reduce((s, r) => s + Number(r.overdue || 0), 0);
  const unbilledSum = (unbilled.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const unbilledHours = (unbilled.data || []).reduce((s, r) => s + Number(r.hours || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Деньги</h1>
        <span className="text-xs text-muted-foreground">
          Управленческий учёт. Налоговая отчётность и ЭСФ здесь не ведутся — это дело 1С.
        </span>
      </div>
      <ErrorNote error={balance.error || pnl.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="На счетах и в кассе" value={money(cash)}
              tone={cash > 0 ? 'good' : cash < 0 ? 'bad' : 'default'} />
        <Stat label="Должны нам" value={money(debt)}
              hint={overdue > 0 ? `просрочено ${money(overdue)}` : 'без просрочки'}
              tone={overdue > 0 ? 'warn' : 'default'} />
        <Stat label="Отработано, не выставлено" value={money(unbilledSum)}
              hint={`${num(unbilledHours, 1)} ч`}
              tone={unbilledSum > 0 ? 'warn' : 'good'} />
        <Stat label="Доход за месяц" value={money(thisMonth?.income || 0)} />
        <Stat label="Прибыль за месяц" value={money(thisMonth?.profit || 0)}
              hint={thisMonth?.margin_pct != null ? `рентабельность ${num(thisMonth.margin_pct, 1)} %` : undefined}
              tone={Number(thisMonth?.profit || 0) > 0 ? 'good'
                  : Number(thisMonth?.profit || 0) < 0 ? 'bad' : 'default'} />
        <Stat label="Себестоимость часа" value={hc?.cost_per_hour ? money(hc.cost_per_hour) : '—'}
              hint={hc?.hours_billable ? `${num(hc.hours_billable, 1)} оплачиваемых ч` : 'нет оплачиваемых часов'} />
      </div>

      {Number(drafts.data?.length) > 0 && (
        <Panel title={`Черновики учёта: ${drafts.data.length}`}
               action={<Link to="/admin/money/entries" className="text-xs text-blue hover:underline">
                 Разобрать →
               </Link>}>
          <p className="mb-3 text-xs text-muted-foreground">
            Счета и оплаты создают черновики проводок сами. Пока черновик не проведён,
            он не участвует ни в прибыли, ни в сальдо: цифры в отчётах складываются
            только из проведённого.
          </p>
          <Table
            empty="Черновиков нет."
            cols={[
              { key: 'entry_date', title: 'Дата', render: (r) => dateOnly(r.entry_date) },
              { key: 'memo', title: 'Назначение' },
              { key: 'company_title', title: 'Клиент', render: (r) => r.company_title || '—' },
              { key: 'debit', title: 'Сумма', align: 'right', render: (r) => money(r.debit) },
              { key: 'status', title: '', render: (r) => (
                <StatusBadge value={r.status} dict={entryStatusLabel} />
              ) },
            ]}
            rows={drafts.data.slice(0, 8)}
          />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Кто сколько должен"
               action={<Link to="/admin/money/docs" className="text-xs text-blue hover:underline">Счета →</Link>}>
          <Table
            empty="Счетов ещё не выставлено."
            rowKey={(r) => r.company_id}
            cols={[
              { key: 'company_title', title: 'Клиент' },
              { key: 'invoiced', title: 'Выставлено', align: 'right', render: (r) => money(r.invoiced) },
              { key: 'paid', title: 'Оплачено', align: 'right', render: (r) => money(r.paid) },
              { key: 'debt', title: 'Долг', align: 'right',
                render: (r) => (
                  <span className={Number(r.debt) > 0 ? 'text-amber-400' : 'text-muted-foreground'}>
                    {money(r.debt)}
                  </span>
                ) },
              { key: 'overdue', title: 'Просрочено', align: 'right',
                render: (r) => Number(r.overdue) > 0
                  ? <span className="text-red-400">{money(r.overdue)}</span>
                  : '—' },
            ]}
            rows={(ar.data || []).filter((r) => Number(r.invoiced) > 0)}
          />
        </Panel>

        <Panel title="Отработано, но не выставлено"
               action={<Link to="/admin/money/docs" className="text-xs text-blue hover:underline">
                 Выставить счёт →
               </Link>}>
          {!unbilled.data?.length ? (
            <Empty>
              Невыставленных оплачиваемых часов нет. Это редкое и хорошее состояние.
            </Empty>
          ) : (
            <Table
              rowKey={(r) => r.company_id}
              cols={[
                { key: 'company_title', title: 'Клиент' },
                { key: 'hours', title: 'Часы', align: 'right', render: (r) => num(r.hours, 1) },
                { key: 'hourly_rate', title: 'Ставка', align: 'right', render: (r) => money(r.hourly_rate) },
                { key: 'amount', title: 'Сумма', align: 'right', render: (r) => money(r.amount) },
                { key: 'oldest_at', title: 'Самый старый', align: 'right',
                  render: (r) => <span className="text-xs text-muted-foreground">{dateOnly(r.oldest_at)}</span> },
              ]}
              rows={unbilled.data}
            />
          )}
        </Panel>
      </div>

      <Panel title="Сальдо по счетам"
             action={<Link to="/admin/money/reports" className="text-xs text-blue hover:underline">
               Оборотно-сальдовая →
             </Link>}>
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
            { key: 'kind', title: 'Вид',
              render: (r) => <Badge>{
                { asset: 'актив', liability: 'обязательство', equity: 'капитал',
                  income: 'доход', expense: 'расход' }[r.kind] || r.kind
              }</Badge> },
            { key: 'saldo', title: 'Сальдо', align: 'right',
              render: (r) => Number(r.postings) === 0
                ? <span className="text-muted-foreground">—</span>
                : money(r.saldo) },
          ]}
          rows={accounts.filter((a) => !a.is_group || Number(a.postings) > 0)}
        />
      </Panel>
    </div>
  );
}
