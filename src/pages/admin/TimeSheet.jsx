/**
 * Учёт времени. Нужен не ради отчётности, а ради Оценщика: факт часов
 * попадает в crm.estimate.hours_fact и становится обучающей выборкой.
 * Без заполненного факта оценка не измеряется и не считается работающей.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchTimeEntries } from '@/lib/supabase/queries';
import { Empty, ErrorNote, Panel, Spinner, Stat, dateOnly, hours } from '@/components/admin/ui';

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

export default function TimeSheet() {
  const [from] = useState(startOfMonth);
  const { data, error, loading } = useAsync(() => fetchTimeEntries({ from }), [from]);

  const totals = useMemo(() => {
    const rows = data || [];
    const minutes = rows.reduce((sum, r) => sum + (r.minutes || 0), 0);
    const billable = rows.filter((r) => r.billable).reduce((sum, r) => sum + (r.minutes || 0), 0);
    const byDay = new Map();
    rows.forEach((r) => {
      const key = (r.started_at || '').slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + (r.minutes || 0));
    });
    return { minutes, billable, byDay: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
  }, [data]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">Время за текущий месяц</h1>
      <ErrorNote error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Всего" value={hours(totals.minutes)} />
        <Stat label="Оплачиваемых" value={hours(totals.billable)}
              hint={totals.minutes ? `${Math.round(100 * totals.billable / totals.minutes)}% от всего` : null} />
        <Stat label="Записей" value={(data || []).length} />
        <Stat label="Дней с работой" value={totals.byDay.length} />
      </div>

      <Panel title="По дням">
        {!totals.byDay.length ? <Empty>За месяц не записано ни одного часа.</Empty> : (
          <ul className="space-y-1 text-sm">
            {totals.byDay.map(([day, minutes]) => (
              <li key={day} className="flex items-center justify-between border-b border-line/40 py-1.5">
                <span className="text-muted-foreground">{dateOnly(day)}</span>
                <span className="tabular-nums">{hours(minutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Записи">
        {!data?.length ? <Empty>Пусто. Часы записываются из карточки заявки.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Дата</th>
                  <th className="pb-2 font-medium">Заявка</th>
                  <th className="pb-2 font-medium">Что делали</th>
                  <th className="pb-2 font-medium">Часы</th>
                  <th className="pb-2 font-medium">Выставлено</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className="border-t border-line/60">
                    <td className="py-2 pr-3 text-muted-foreground">{dateOnly(r.started_at)}</td>
                    <td className="py-2 pr-3">
                      <Link to={`/admin/tickets/${r.ticket_id}`} className="hover:text-blue">
                        {r.ticket?.subject || `№${r.ticket_id}`}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.note || '—'}</td>
                    <td className="py-2 pr-3 tabular-nums">{hours(r.minutes)}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {r.invoiced_in ? `счёт ${r.invoiced_in}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
