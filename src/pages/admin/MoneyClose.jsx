/**
 * Закрытие месяца.
 *
 * Месяц закрывается не одним действием, а пятью, и они на разных экранах.
 * Пока список держится в голове, каждый месяц что-то забывается — обычно
 * счёт, потому что он единственный, о ком никто не напомнит.
 *
 * Главное правило: НИ ОДИН СЧЁТ ЗДЕСЬ НЕ ВЫСТАВЛЯЕТСЯ САМ. Сумма
 * показывается до нажатия, нажимает человек. Автоматически выставленный
 * счёт с ошибкой — это разговор с клиентом, который дороже сэкономленной
 * минуты.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchMonthClose, fetchMonthCloseSubs, fetchMonthCloseHours, invoiceSubscription,
} from '@/lib/supabase/queries';
import {
  Badge, Button, Empty, ErrorNote, Panel, Spinner, Stat, Table,
  cx, docStatusLabel, hours, money, num,
} from '@/components/admin/ui';

/** Первое число месяца, сдвинутое на delta месяцев от прошлого. */
const monthOf = (delta) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

const monthName = (iso) => {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

export default function MoneyClose() {
  const [delta, setDelta] = React.useState(0);
  const month = monthOf(delta);

  const close = useAsync(() => fetchMonthClose(month), [month]);
  const subs = useAsync(() => fetchMonthCloseSubs(month), [month]);
  const hoursOnly = useAsync(() => fetchMonthCloseHours(month), [month]);
  const [busy, setBusy] = React.useState(null);
  const [failed, setFailed] = React.useState(null);

  const c = close.data || {};

  const invoice = async (row) => {
    setBusy(row.subscription_id);
    setFailed(null);
    try {
      await invoiceSubscription(row.subscription_id, month);
      await Promise.all([close.reload(), subs.reload(), hoursOnly.reload()]);
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(null);
    }
  };

  const steps = [
    {
      title: 'Черновики учёта проведены',
      done: Number(c.acc_drafts || 0) === 0,
      ok: 'ни одного непроведённого документа',
      bad: `${num(c.acc_drafts)} — непроведённый документ в расходы месяца не попадает, и ставка врёт`,
      to: '/admin/money/entries',
    },
    {
      title: 'Расходы месяца внесены',
      done: Number(c.expenses_amount || 0) > 0,
      ok: `${money(c.expenses_amount)} за месяц`,
      bad: 'ноль расходов за месяц — так не бывает. Пока их нет, себестоимость часа не считается',
      to: '/admin/money/expenses',
    },
    {
      title: 'Счета по абонементам выставлены',
      done: Number(c.subs_pending || 0) === 0,
      ok: c.subs_active ? `все ${num(c.subs_active)}` : 'абонементов в этом месяце не было',
      bad: `осталось ${num(c.subs_pending)} из ${num(c.subs_active)}`,
    },
    {
      title: 'Часы закрыты счетами',
      done: Number(c.hours_unbilled || 0) === 0,
      ok: 'неоплаченных часов не осталось',
      bad: `${hours(Number(c.hours_unbilled || 0) * 60)} отработано и не выставлено`,
      to: '/admin/money/docs',
    },
    {
      title: 'Ставка пересчитана',
      done: Number(c.cost_per_hour || 0) > 0,
      ok: `себестоимость часа ${money(c.cost_per_hour)}${
        c.actual_rate ? `, фактическая ставка ${money(c.actual_rate)}` : ''}`,
      bad: 'нечего считать: нет расходов или проданных часов',
      to: '/admin/money/rate',
    },
  ];

  // Заголовок считается по этому же списку, а не по признаку `ready` из
  // базы: там учитываются только счета, часы и черновики, а на экране пять
  // шагов. Иначе панель писала бы «месяц закрыт» над двумя незакрытыми
  // строками — ровно та диагностика, которая врёт.
  const allDone = steps.every((s) => s.done);

  if (close.loading && !close.data) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Закрытие месяца: {monthName(c.month || month)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Пять шагов в одном списке. Суммы показаны до выставления — нажимаете вы.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => setDelta((d) => d - 1)} title="Месяцем раньше">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm text-muted-foreground">
            {monthName(month)}
          </span>
          <Button variant="ghost" disabled={delta >= 1} onClick={() => setDelta((d) => d + 1)}
                  title="Месяцем позже">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ErrorNote error={close.error || subs.error || hoursOnly.error} />
      {failed && <ErrorNote error={new Error(failed)} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Расходы месяца" value={money(c.expenses_amount)} />
        <Stat label="Продано часов" value={hours(Number(c.hours_billable || 0) * 60)}
              hint={`всего отработано: ${hours(Number(c.hours_total || 0) * 60)}`} />
        <Stat label="Себестоимость часа" value={c.cost_per_hour ? money(c.cost_per_hour) : '—'}
              hint="ниже неё работать нельзя" />
        <Stat label="Не оплачено по месяцу" value={money(c.docs_unpaid_amount)}
              hint={`счетов: ${num(c.docs_unpaid)}`}
              tone={Number(c.docs_unpaid || 0) > 0 ? 'warn' : 'default'} />
      </div>

      <Panel title={allDone ? 'Месяц закрыт' : 'Что осталось сделать'}>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.title}
                className={cx('flex items-start gap-3 rounded-lg border px-3 py-2.5',
                  s.done ? 'border-line' : 'border-amber-500/40 bg-amber-500/5')}>
              {s.done
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground">{s.done ? s.ok : s.bad}</div>
              </div>
              {s.to && !s.done && (
                <Link to={s.to} className="shrink-0 text-xs text-blue hover:underline">Открыть →</Link>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Абонементы месяца"
             action={<span className="text-xs text-muted-foreground">
               сумма считается тем же способом, что и в счёте
             </span>}>
        {subs.loading ? <Spinner /> : !subs.data?.length ? (
          <Empty>В этом месяце не действовало ни одного абонемента.</Empty>
        ) : (
          <Table
            cols={[
              { key: 'company', title: 'Клиент' },
              { key: 'title', title: 'Тариф' },
              { key: 'used', title: 'Расход', render: (r) => (
                <span className="tabular-nums">
                  {hours(r.used_minutes)} из {hours(r.included_minutes)}
                  {r.over_minutes > 0 && (
                    <span className="text-amber-400"> +{hours(r.over_minutes)} сверх</span>
                  )}
                </span>
              ) },
              { key: 'amount', title: 'Сумма', render: (r) => (
                <span className="tabular-nums font-medium">{money(r.amount_preview)}</span>
              ) },
              { key: 'state', title: 'Счёт', render: (r) => (
                r.invoice_id
                  ? <Badge tone={r.invoice_status}>{docStatusLabel(r.invoice_status)}</Badge>
                  : <span className="text-xs text-muted-foreground">не выставлен</span>
              ) },
              { key: 'act', title: '', render: (r) => (
                r.invoice_id ? (
                  <Link to="/admin/money/docs" className="text-xs text-blue hover:underline">
                    Открыть →
                  </Link>
                ) : (
                  <Button variant="ghost" disabled={busy === r.subscription_id}
                          onClick={() => invoice(r)}>
                    {busy === r.subscription_id ? 'Выставляю…' : 'Выставить счёт'}
                  </Button>
                )
              ) },
            ]}
            rows={subs.data}
            rowKey={(r) => r.subscription_id}
          />
        )}
      </Panel>

      <Panel title="Часы без абонемента"
             action={<Link to="/admin/money/docs" className="text-xs text-blue hover:underline">
               Счета и акты →
             </Link>}>
        {hoursOnly.loading ? <Spinner /> : !hoursOnly.data?.length ? (
          <Empty>Неоплаченных часов у клиентов без абонемента нет.</Empty>
        ) : (
          <>
            <Table
              cols={[
                { key: 'company', title: 'Клиент' },
                { key: 'hours', title: 'Часы', render: (r) => (
                  <span className="tabular-nums">{hours(r.minutes)}</span>
                ) },
                { key: 'rate', title: 'Ставка', render: (r) => (
                  r.hourly_rate ? money(r.hourly_rate) : (
                    <span className="text-amber-400">не задана</span>
                  )
                ) },
                { key: 'amount', title: 'Выйдет', render: (r) => (
                  <span className="tabular-nums font-medium">{money(r.amount_preview)}</span>
                ) },
              ]}
              rows={hoursOnly.data}
              rowKey={(r) => r.company_id}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Счёт по часам выставляется на экране «Счета и акты»: там выбираются
              конкретные заявки, и это правильно — в счёт должно попадать то,
              о чём договаривались, а не всё подряд.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
