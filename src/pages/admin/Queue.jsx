/**
 * Очередь и журнал. Показывает честное состояние: истёкшие аренды видны
 * отдельной пометкой, мёртвые задания не прячутся.
 *
 * Успешность считается по журналу запусков, а не по списку источников:
 * скрытие строк в интерфейсе не меняет цифру вообще.
 */
import React, { useState } from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchQueue, fetchActionLog } from '@/lib/supabase/queries';
import {
  Badge, Empty, ErrorNote, Panel, Spinner, cx, dateTime,
} from '@/components/admin/ui';

const FILTERS = [
  { key: 'active', label: 'Активные', values: ['queued', 'failed', 'leased', 'awaiting', 'blocked'] },
  { key: 'bad',    label: 'Проблемные', values: ['dead', 'blocked', 'done_empty'] },
  { key: 'done',   label: 'Завершённые', values: ['done', 'done_empty', 'cancelled'] },
  { key: 'all',    label: 'Все', values: null },
];

export default function Queue() {
  const [filter, setFilter] = useState('active');
  const values = FILTERS.find((f) => f.key === filter)?.values;
  const queue = useAsync(() => fetchQueue({ status: values }), [filter]);
  const log = useAsync(() => fetchActionLog(50));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cx('rounded-lg border px-3 py-1.5 text-xs transition',
              filter === f.key ? 'border-blue/40 bg-blue/10 text-blue'
                               : 'border-line text-muted-foreground hover:text-foreground')}>
            {f.label}
          </button>
        ))}
      </div>

      <ErrorNote error={queue.error} />

      <Panel title={`Очередь заданий${queue.data ? `: ${queue.data.length}` : ''}`}>
        {queue.loading ? <Spinner /> : !queue.data?.length ? (
          <Empty>Очередь пуста.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">№</th>
                  <th className="pb-2 font-medium">Задание</th>
                  <th className="pb-2 font-medium">Агент</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 font-medium">Попыток</th>
                  <th className="pb-2 font-medium">Стоимость</th>
                  <th className="pb-2 font-medium">Создано</th>
                  <th className="pb-2 font-medium">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {queue.data.map((j) => (
                  <tr key={j.id} className="border-t border-line/60">
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">{j.id}</td>
                    <td className="py-2 pr-3">{j.job_title}
                      <div className="text-[11px] text-muted-foreground">{j.job_type}</div></td>
                    <td className="py-2 pr-3 text-muted-foreground">{j.agent_title}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={j.status}>{j.status}</Badge>
                      {j.lease_expired && <div className="mt-1"><Badge tone="dead">аренда истекла</Badge></div>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{j.attempts}</td>
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                      ${Number(j.cost_act_usd || 0).toFixed(3)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{dateTime(j.created_at)}</td>
                    <td className="max-w-[240px] truncate py-2 text-xs text-red-300" title={j.error_text || ''}>
                      {j.error_text || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Журнал действий">
        {log.loading ? <Spinner /> : !log.data?.length ? (
          <Empty>Записей пока нет. Журнал только дописывается: правка и удаление запрещены базой.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Когда</th>
                  <th className="pb-2 font-medium">Кто</th>
                  <th className="pb-2 font-medium">Действие</th>
                  <th className="pb-2 font-medium">Объект</th>
                  <th className="pb-2 font-medium">Итог</th>
                  <th className="pb-2 font-medium">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {log.data.map((a) => (
                  <tr key={`${a.id}-${a.at}`} className="border-t border-line/60">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{dateTime(a.at)}</td>
                    <td className="py-2 pr-3 text-xs">{a.actor_ref}</td>
                    <td className="py-2 pr-3">{a.action_type}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {a.target_system}{a.target_ref ? ` · ${a.target_ref}` : ''}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={a.outcome === 'ok' ? 'approved' : a.outcome === 'refused' ? 'failed' : undefined}>
                        {a.outcome}
                      </Badge>
                    </td>
                    <td className="py-2 tabular-nums text-muted-foreground">
                      ${Number(a.cost_usd || 0).toFixed(3)}
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
