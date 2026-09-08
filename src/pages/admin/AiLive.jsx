/**
 * Живой экран раздела «ИИ».
 *
 * Одно правило определило весь экран: он обязан говорить, насколько он живой.
 * Панель, которая молча показывает данные пятиминутной давности как текущие,
 * опаснее панели, которой нет: по ней принимают решения.
 *
 * Опрос — раз в три секунды, одним вызовом ai_pulse(). Вкладка в фоне —
 * опрос останавливается. Связь потеряна — прежние данные остаются на месте,
 * но сверху написано, с какого момента они прежние.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Pause, ShieldQuestion } from 'lucide-react';
import { usePoll, mergeSteps } from '@/lib/admin/usePoll';
import { useAuth } from '@/lib/auth/AuthContext';
import { fetchPulse, closeEscalation, decideApproval } from '@/lib/supabase/queries';
import {
  Badge, Bar, Button, Empty, ErrorNote, Freshness, Modal, Outcome, Panel, Spinner,
  Stat, Table, ago, cx, dateTime, duration, num, usd,
} from '@/components/admin/ui';

const JOB_TILES = [
  ['leased', 'В работе'],
  ['queued', 'В очереди'],
  ['failed', 'Ждут повтора'],
  ['blocked', 'Заблокированы'],
  ['awaiting', 'Ждут человека'],
  ['dead', 'Мёртвые'],
];

export default function AiLive() {
  const { person } = useAuth();
  const [steps, setSteps] = React.useState([]);
  const sinceRef = React.useRef(null);
  const [approval, setApproval] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState(null);

  const pulse = usePoll(
    React.useCallback(async () => {
      const data = await fetchPulse(sinceRef.current, 60);
      sinceRef.current = data.at;
      // Повторы приходят по замыслу: пульс отдаёт шаги с запасом по времени,
      // чтобы ни один не потерялся. Отбрасываем их здесь, по id.
      setSteps((prev) => mergeSteps(prev, data.steps));
      return data;
    }, []),
    { interval: 3000 },
  );

  if (pulse.loading && !pulse.data) return <Spinner />;

  const p = pulse.data || {};
  const jobs = p.jobs || {};
  const agents = p.agents || [];
  const quotas = p.quotas || [];
  const escalations = p.escalations || [];
  const approvals = p.approvals || [];
  const runnerAge = p.runner_last_seen
    ? (Date.now() - new Date(p.runner_last_seen).getTime()) / 1000
    : null;

  const decide = async (status, extra) => {
    setBusy(true); setActionError(null);
    try {
      await decideApproval(approval.id, status, person.id, extra);
      setApproval(null);
      pulse.reload();
    } catch (err) { setActionError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Что происходит сейчас</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Freshness at={pulse.at} stale={pulse.stale} error={pulse.error} />
            {pulse.paused && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Pause className="h-3 w-3" /> вкладка в фоне, опрос остановлен
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Раннер на ПК:{' '}
            {runnerAge === null ? (
              <span className="text-muted-foreground">не отмечался ни разу</span>
            ) : runnerAge < 900 ? (
              <span className="text-emerald-400">на связи, {ago(p.runner_last_seen)}</span>
            ) : (
              <span className="text-amber-400">молчит с {dateTime(p.runner_last_seen)}</span>
            )}
          </span>
          <Button variant="ghost" onClick={pulse.reload}>Обновить</Button>
        </div>
      </div>

      {pulse.error && <ErrorNote error={pulse.error} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {JOB_TILES.map(([key, label]) => (
          <Stat key={key} label={label} value={jobs[key] ?? 0}
                tone={key === 'dead' && jobs[key] > 0 ? 'bad'
                    : key === 'awaiting' && jobs[key] > 0 ? 'warn'
                    : key === 'leased' && jobs[key] > 0 ? 'good' : 'default'} />
        ))}
      </div>

      {approvals.length > 0 && (
        <Panel title={`Ждут вашего решения: ${approvals.length}`}>
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldQuestion className="h-3.5 w-3.5 text-gold" />
                    <Badge tone="awaiting">{a.action_title}</Badge>
                    <span className="text-xs text-muted-foreground">
                      уверенность {num((a.confidence || 0) * 100, 0)} %
                    </span>
                    <span className={cx('text-xs', a.overdue ? 'text-red-400' : 'text-muted-foreground')}>
                      {a.overdue ? 'срок истёк' : `осталось ${a.minutes_left} мин`}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm">{a.rationale}</p>
                </div>
                <Button onClick={() => { setApproval(a); setActionError(null); }}>Разобрать</Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Молчание не равно согласию: неотвеченное подтверждение закрывается само,
            а задание отменяется. Так работает «Сторож».
          </p>
        </Panel>
      )}

      {escalations.length > 0 && (
        <Panel title={`Эскалации: ${escalations.length}`}>
          <ul className="space-y-2">
            {escalations.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <Badge>{e.kind}</Badge>
                    <span className="text-xs text-muted-foreground">{e.age_min} мин назад</span>
                    {e.job_title && <span className="text-xs text-muted-foreground">· {e.job_title}</span>}
                  </div>
                  <p className="mt-1 break-words text-sm">{e.summary}</p>
                </div>
                <Button variant="ghost"
                        onClick={async () => { await closeEscalation(e.id); pulse.reload(); }}>
                  Закрыть
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Агенты" className="xl:col-span-1">
          {!agents.length ? <Empty>Активных агентов нет.</Empty> : (
            <ul className="space-y-3">
              {agents.map((a) => (
                <li key={a.code} className="rounded-lg border border-line px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {a.running} / {a.max_parallel}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Bar value={a.running} max={a.max_parallel} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>ждут: <b className="tabular-nums text-foreground">{a.waiting}</b></span>
                    {a.blocked > 0 && <span className="text-amber-400">заблокировано: {a.blocked}</span>}
                    {a.lease_expired > 0 && <span className="text-red-400">брошено: {a.lease_expired}</span>}
                    <span>за сутки: {a.done_day}</span>
                    {a.empty_day > 0 && <span className="text-amber-400">пусто: {a.empty_day}</span>}
                    {a.dead_week > 0 && <span className="text-red-400">мёртвых за неделю: {a.dead_week}</span>}
                    {a.median_sec != null && <span>медиана: {duration(a.median_sec * 1000)}</span>}
                    {Number(a.cost_day) > 0 && <span>{usd(a.cost_day)} за сутки</span>}
                  </div>
                  {a.running >= a.max_parallel && a.waiting > 0 && (
                    <p className="mt-2 text-xs text-amber-400">
                      Очередь стоит не потому что агент сломался: выбран предел параллельности.
                      Меняется в реестрах агентов.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Лента шагов" className="xl:col-span-2"
               action={<Link to="/admin/ai/queue" className="text-xs text-blue hover:underline">
                 Журнал целиком →
               </Link>}>
          {!steps.length ? (
            <Empty>
              Шагов пока нет. Каждое действие агента пишется в журнал до того, как
              выполняется, — поэтому пустая лента означает, что агенты ещё ничего не делали.
            </Empty>
          ) : (
            <ul className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
              {steps.map((s) => (
                <li key={s.id} className="rounded-lg border border-line/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Outcome value={s.outcome} />
                    <span className="text-sm">{s.action_title}</span>
                    {s.has_side_effect && (
                      <span className="text-[11px] text-amber-400/80" title="Действие с побочным эффектом">
                        ↗ вне системы
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">{ago(s.at)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{s.actor_ref}</span>
                    {s.target_ref && <span className="truncate font-mono">{s.target_ref}</span>}
                    {s.job_title && <span>· {s.job_title}</span>}
                    {s.duration_ms != null && <span>{duration(s.duration_ms)}</span>}
                    {Number(s.cost_usd) > 0 && <span>{usd(s.cost_usd)}</span>}
                    {s.tokens_in != null && <span>{num(s.tokens_in)}→{num(s.tokens_out)} ток.</span>}
                    {s.confidence != null && <span>уверенность {num(s.confidence * 100, 0)} %</span>}
                  </div>
                  {s.error_text && (
                    <p className="mt-1 break-words text-xs text-red-300">{s.error_text}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Расход"
               action={<Link to="/admin/ai/spend" className="text-xs text-blue hover:underline">Подробно →</Link>}>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Сегодня" value={usd(p.spend?.today_usd)} />
            <Stat label="За месяц" value={usd(p.spend?.month_usd)} />
            <Stat label="Заданиями за месяц" value={usd(p.spend?.jobs_month_usd)}
                  hint="списано по факту" />
          </div>
          {quotas.length > 0 && (
            <div className="mt-4 space-y-3">
              {quotas.map((q) => (
                <div key={`${q.provider}-${q.period}`}>
                  <Bar value={Number(q.used) + Number(q.reserved)} max={Number(q.limit_units)}
                       label={`${q.provider_title} · ${q.period === 'day' ? 'сутки' : 'месяц'}`} />
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{num(q.used)} из {num(q.limit_units)} {q.unit}</span>
                    {Number(q.reserved) > 0 && <span>в резерве {num(q.reserved)}</span>}
                    {q.exhausted && <span className="text-red-400">квота выбрана, обращения запрещены</span>}
                    {!q.exhausted && q.soft_reached && <span className="text-amber-400">порог пройден</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Очередь"
               action={<Link to="/admin/ai/queue" className="text-xs text-blue hover:underline">Все задания →</Link>}>
          <Table
            empty="Живых заданий нет."
            cols={[
              { key: 'job_title', title: 'Задание',
                render: (r) => (
                  <div>
                    <div>{r.job_title}</div>
                    <div className="text-xs text-muted-foreground">{r.agent_title}</div>
                  </div>
                ) },
              { key: 'status', title: 'Состояние',
                render: (r) => (
                  <div className="space-y-1">
                    <Badge tone={r.status}>{r.status}</Badge>
                    {r.lease_expired && <div className="text-xs text-red-400">аренда истекла</div>}
                  </div>
                ) },
              { key: 'attempts', title: 'Попытки', align: 'right' },
              { key: 'created_at', title: 'Поставлено', align: 'right',
                render: (r) => <span className="text-xs text-muted-foreground">{ago(r.created_at)}</span> },
            ]}
            rows={(p.queue || []).slice(0, 12)}
          />
        </Panel>
      </div>

      {approval && (
        <Modal title={`Подтверждение: ${approval.action_title}`} onClose={() => setApproval(null)} wide>
          <div className="space-y-4">
            <ErrorNote error={actionError} />
            <div className="rounded-lg border border-line px-3 py-2 text-sm">
              <div className="text-xs text-muted-foreground">Обоснование агента</div>
              <p className="mt-1">{approval.rationale}</p>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Что предлагается сделать</div>
              <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-background px-3 py-2 text-xs">
                {JSON.stringify(approval.proposal, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground">
              Подтверждение без правок и подтверждение с правкой — разные события.
              По первым считается право агента на самостоятельность, поэтому кнопки две.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => decide('approved')}>
                Подтвердить как есть
              </Button>
              <Button variant="ghost" disabled={busy}
                      onClick={() => decide('approved_edited')}>
                Подтвердить с правкой
              </Button>
              <Button variant="danger" disabled={busy}
                      onClick={() => {
                        const reason = window.prompt('Почему отказ? Это попадёт в статистику агента.');
                        if (reason === null) return;
                        decide('rejected', { rejectReason: reason || 'без причины' });
                      }}>
                Отклонить
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
