import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchTickets } from '@/lib/supabase/queries';
import { Badge, Empty, ErrorNote, Panel, Spinner, cx, dateTime, hours, money } from '@/components/admin/ui';

const STATUS_GROUPS = [
  { key: 'open',   label: 'В работе', values: ['new', 'triaged', 'estimated', 'approved', 'in_work'] },
  { key: 'new',    label: 'Новые',    values: ['new'] },
  { key: 'done',   label: 'Закрытые', values: ['done', 'cancelled'] },
  { key: 'all',    label: 'Все',      values: null },
];

export default function Tickets() {
  const [group, setGroup] = useState('open');
  const values = STATUS_GROUPS.find((g) => g.key === group)?.values;
  const { data, error, loading } = useAsync(() => fetchTickets({ status: values }), [group]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_GROUPS.map((g) => (
          <button key={g.key} onClick={() => setGroup(g.key)}
            className={cx('rounded-lg border px-3 py-1.5 text-xs transition',
              group === g.key ? 'border-blue/40 bg-blue/10 text-blue'
                              : 'border-line text-muted-foreground hover:text-foreground')}>
            {g.label}
          </button>
        ))}
      </div>

      <ErrorNote error={error} />

      <Panel title={`Заявки${data ? `: ${data.length}` : ''}`}>
        {loading ? <Spinner /> : !data?.length ? (
          <Empty>Пусто. Заявки приходят с формы сайта, из почты и от бота.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">№</th>
                  <th className="pb-2 font-medium">Тема</th>
                  <th className="pb-2 font-medium">Клиент</th>
                  <th className="pb-2 font-medium">Тип</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 font-medium">Оценка</th>
                  <th className="pb-2 font-medium">Потрачено</th>
                  <th className="pb-2 font-medium">Пришла</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.id} className="border-t border-line/60 hover:bg-white/[0.02]">
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">{t.id}</td>
                    <td className="py-2 pr-3">
                      <Link to={`/admin/tickets/${t.id}`} className="hover:text-blue">{t.subject}</Link>
                      {t.system && <div className="text-[11px] text-muted-foreground">{t.system}</div>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{t.company_title || '—'}</td>
                    <td className="py-2 pr-3">
                      {t.kind ? <Badge>{t.kind}</Badge> : <span className="text-muted-foreground">—</span>}
                      {t.kind_confidence != null && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {Math.round(t.kind_confidence * 100)}%
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3"><Badge tone={t.status}>{t.status}</Badge></td>
                    <td className="py-2 pr-3 tabular-nums">
                      {t.hours_min != null
                        ? <span title={`${t.hours_min}–${t.hours_max} ч`}>{money(t.price)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                      {hours((t.hours_spent || 0) * 60)}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{dateTime(t.created_at)}</td>
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
