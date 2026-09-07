/**
 * Обзор. Показывает честное состояние, а не красивое:
 * зависшие заявки, мёртвые задания и открытые эскалации видны сразу,
 * потому что мёртвый канал, который не видно, живёт незамеченным неделями.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchOverview, fetchEstimateQuality, fetchTickets, fetchEscalations, closeEscalation,
} from '@/lib/supabase/queries';
import { Badge, Button, Empty, ErrorNote, Panel, Spinner, Stat, dateTime, hours } from '@/components/admin/ui';

export default function Overview() {
  const ov = useAsync(fetchOverview);
  const eq = useAsync(fetchEstimateQuality);
  const tickets = useAsync(() => fetchTickets({ limit: 8 }));
  const esc = useAsync(fetchEscalations);

  if (ov.loading) return <Spinner />;

  const o = ov.data || {};
  const q = eq.data || {};

  return (
    <div className="space-y-5">
      <ErrorNote error={ov.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Открытых заявок" value={o.tickets_open ?? 0} hint={`сегодня новых: ${o.tickets_today ?? 0}`} />
        <Stat label="Зависли" value={o.tickets_stuck ?? 0} hint="без движения 2 дня"
              tone={o.tickets_stuck > 0 ? 'warn' : 'good'} />
        <Stat label="Часов за месяц" value={(o.hours_month ?? 0).toFixed(1).replace('.', ',')} />
        <Stat label="В очереди" value={o.jobs_waiting ?? 0} hint={`в работе: ${o.jobs_running ?? 0}`} />
        <Stat label="Мёртвых заданий" value={o.jobs_dead_week ?? 0} hint="за неделю"
              tone={o.jobs_dead_week > 0 ? 'bad' : 'good'} />
        <Stat label="Расход за месяц" value={`$${Number(o.cost_month_usd ?? 0).toFixed(2)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Индексы конфигураций" className="lg:col-span-1">
          <div className="space-y-2 text-sm">
            <Row label="Готовых" value={o.configs_ready ?? 0} />
            <Row label="Устаревших" value={o.configs_stale ?? 0}
                 tone={o.configs_stale > 0 ? 'warn' : 'good'} />
          </div>
          {o.configs_stale > 0 && (
            <p className="mt-3 text-xs text-amber-400">
              Ответы по устаревшему индексу помечаются автоматически, но лучше переиндексировать.
            </p>
          )}
          <Link to="/admin/configs" className="mt-3 inline-block text-xs text-blue hover:underline">
            Открыть конфигурации →
          </Link>
        </Panel>

        <Panel title="Качество оценки" className="lg:col-span-2">
          {q.measured ? (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Замеров" value={q.measured} />
              <Stat label="Медианная ошибка" value={`${q.median_error_pct ?? '—'} %`}
                    hint="норма ≤ 40 %" tone={q.median_error_pct <= 40 ? 'good' : 'warn'} />
              <Stat label="Попадание в вилку" value={`${q.hit_pct ?? '—'} %`}
                    hint="норма ≥ 60 %" tone={q.hit_pct >= 60 ? 'good' : 'warn'} />
            </div>
          ) : (
            <Empty>
              Нет ни одной закрытой заявки с фактическими часами.
              Пока их меньше двадцати, оценка не измеряется — и не считается работающей.
            </Empty>
          )}
        </Panel>
      </div>

      {esc.data?.length > 0 && (
        <Panel title={`Эскалации: ${esc.data.length}`}>
          <ul className="space-y-2">
            {esc.data.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <Badge>{item.kind}</Badge>
                    <span className="text-xs text-muted-foreground">{dateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-1 break-words text-sm">{item.summary}</p>
                </div>
                <Button variant="ghost" onClick={async () => { await closeEscalation(item.id); esc.reload(); }}>
                  Закрыть
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Последние заявки"
             action={<Link to="/admin/tickets" className="text-xs text-blue hover:underline">Все заявки →</Link>}>
        {tickets.loading ? <Spinner /> : !tickets.data?.length ? (
          <Empty>Заявок пока нет. Форма на сайте пишет сюда напрямую.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Заявка</th>
                  <th className="pb-2 font-medium">Клиент</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 font-medium">Часы</th>
                  <th className="pb-2 font-medium">Пришла</th>
                </tr>
              </thead>
              <tbody>
                {tickets.data.map((t) => (
                  <tr key={t.id} className="border-t border-line/60">
                    <td className="py-2 pr-3">
                      <Link to={`/admin/tickets/${t.id}`} className="text-foreground hover:text-blue">
                        {t.subject}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{t.company_title || '—'}</td>
                    <td className="py-2 pr-3"><Badge tone={t.status}>{t.status}</Badge></td>
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

function Row({ label, value, tone }) {
  const color = tone === 'warn' ? 'text-amber-400' : tone === 'good' ? 'text-emerald-400' : 'text-foreground';
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums font-medium ${color}`}>{value}</span>
    </div>
  );
}
