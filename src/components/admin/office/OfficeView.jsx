/**
 * Экран «3D-офис агентов» без источника данных: офис (buildOffice), состояние загрузки и функция
 * загрузки задач агента приходят снаружи. Так один и тот же экран рисуют и панель
 * (src/pages/admin/AgentsOffice.jsx, живые данные), и демо в режиме разработки (тестовые данные).
 *
 * Два вида — 3D и таблица. Таблица — не «упрощённый режим», а та же информация: она показывается,
 * если WebGL нет или сцена не поднялась, и её можно выбрать самому (клавиатура, экранный диктор).
 * 3D-сцена грузится лениво: three и @react-three/* — только когда выбран вид «3D».
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, LocateFixed, Table2, X } from 'lucide-react';
import { usePoll } from '@/lib/admin/usePoll';
import { STATE_META, STATE_ORDER, backlogOf } from '@/lib/admin/agentsOffice';
import { Badge, ErrorNote, Freshness, Spinner, ago, cx, dateTime, num, usd } from '@/components/admin/ui';

const OfficeScene = lazy(() => import('./OfficeScene'));

function detectWebGL() {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/** Ловит сбой сцены (нет контекста WebGL, ошибка драйвера) и переключает на таблицу. */
class SceneBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    this.props.onFail?.(error?.message || 'сбой 3D');
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function StateDot({ state, className }) {
  const meta = STATE_META[state] || STATE_META.unknown;
  return (
    <span className={cx('inline-block h-2 w-2 shrink-0 rounded-full', className)}
      style={{ background: meta.color }} aria-hidden="true" />
  );
}

function StateText({ agent }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StateDot state={agent.state} />
      <span style={{ color: (STATE_META[agent.state] || STATE_META.unknown).color }}>{agent.stateText}</span>
    </span>
  );
}

/* ── Сводка сверху ─────────────────────────────────────────────────────── */

const SUMMARY = [
  ['working', 'работают'], ['error', 'с ошибкой'], ['queued', 'с очередью'], ['idle', 'ждут задач'],
  ['live', 'в строю вне базы'], ['ready', 'готовы, ждут запуска'], ['asleep', 'без активности'],
  ['unknown', 'без живых данных'], ['soon', 'скоро'],
];

function Summary({ office }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUMMARY.filter(([s]) => office.totals[s]).map(([s, label]) => (
        <span key={s} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/50 px-2.5 py-1 text-xs">
          <StateDot state={s} />
          <span className="font-semibold tabular-nums">{office.totals[s]}</span>
          <span className="text-muted-foreground">{label}</span>
        </span>
      ))}
      {office.totals.backlog > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
          задач в очереди: <span className="font-semibold tabular-nums">{office.totals.backlog}</span>
        </span>
      )}
    </div>
  );
}

/* ── Панель агента ─────────────────────────────────────────────────────── */

const JOB_STATUS = {
  queued: 'в очереди', leased: 'в работе', blocked: 'заблокировано', awaiting: 'ждёт человека',
  done: 'готово', done_empty: 'готово, пусто', failed: 'ждёт повтора', dead: 'упало', cancelled: 'отменено',
};
const OUTCOME = { ok: 'успех', error: 'ошибка', refused: 'отказ', escalated: 'передано человеку', partial: 'частично' };
const OUTCOME_TONE = { ok: 'done', error: 'dead', refused: 'blocked', escalated: 'awaiting', partial: 'failed' };

const secs = (s) => {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин ${s % 60} с`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
};

function Fact({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cx('text-sm font-semibold tabular-nums',
        tone === 'bad' && 'text-red-400', tone === 'warn' && 'text-amber-400', tone === 'good' && 'text-emerald-400')}>
        {value}
      </div>
    </div>
  );
}

function When({ value }) {
  return value ? <span title={dateTime(value)}>{ago(value)}</span> : <span>—</span>;
}

function JobsBlock({ agent, loadJobs }) {
  const jobs = usePoll(useCallback(() => loadJobs(agent.id), [loadJobs, agent.id]), { interval: 20000 });
  if (jobs.loading && !jobs.data) return <Spinner label="загружаем задачи" />;
  const list = jobs.data?.jobs || [];
  const steps = jobs.data?.steps || [];
  return (
    <>
      {jobs.error && <ErrorNote error={jobs.error} />}
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Последние задачи {list.length > 0 && <span className="opacity-60">· {list.length}</span>}
      </h3>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Задач не было.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {list.map((j) => (
            <li key={j.id} className="rounded-lg border border-line bg-black/20 px-2.5 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-foreground" title={j.job_type}>{j.title || j.job_type}</span>
                <Badge tone={j.status}>{JOB_STATUS[j.status] || j.status}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                <span>#{j.id}</span>
                <span>поставлена <When value={j.created_at} /></span>
                {j.duration_sec !== null && j.duration_sec !== undefined && <span>шла {secs(j.duration_sec)}</span>}
                <span>попыток {j.attempts}{j.max_attempts ? ` из ${j.max_attempts}` : ''}</span>
                {Number(j.cost_usd) > 0 && <span>{usd(j.cost_usd)}</span>}
                {j.next_attempt_at && j.status === 'failed' && <span>повтор {dateTime(j.next_attempt_at)}</span>}
              </div>
              {j.error && <div className="mt-1 break-words text-red-300/90">{j.error}</div>}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Журнал</h3>
      {steps.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">За 30 дней шагов в журнале нет.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {steps.map((s, i) => (
            <li key={`${s.at}-${i}`} className="flex flex-wrap items-baseline gap-x-2 border-b border-line/50 py-1.5 text-xs">
              <span className="w-20 shrink-0 text-muted-foreground"><When value={s.at} /></span>
              <span className="min-w-0 flex-1 truncate" title={s.action_type}>{s.title}</span>
              <Badge tone={OUTCOME_TONE[s.outcome]}>{OUTCOME[s.outcome] || s.outcome}</Badge>
              {s.error && <span className="basis-full break-words text-red-300/90">{s.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function AgentPanel({ agent, dept, office, loadJobs, onClose, className }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const l = agent.live;
  const canJobs = Boolean(loadJobs && office.hasLive && agent.kind === 'db' && agent.present);

  return (
    <aside className={cx('flex flex-col overflow-hidden border-line bg-surface/95 shadow-2xl backdrop-blur', className)}
      aria-label={`Агент: ${agent.title}`}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: dept?.accent }}>{dept?.title}</div>
          <h2 className="mt-0.5 text-base font-semibold leading-tight">{agent.title}</h2>
          <div className="mt-1 text-sm"><StateText agent={agent} /></div>
        </div>
        <button onClick={onClose} aria-label="Закрыть панель"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
        <p className="text-muted-foreground">{agent.role}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Где работает</dt><dd>{agent.where || '—'}</dd>
          {agent.kind === 'db' && (<><dt className="text-muted-foreground">Код в базе</dt><dd className="font-mono">{agent.id}</dd></>)}
          <dt className="text-muted-foreground">Описание</dt><dd className="break-words">{agent.source || '—'}</dd>
        </dl>

        {l ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              <Fact label="в работе" value={`${l.running} из ${l.max_parallel}`} tone={l.running ? 'good' : undefined} />
              <Fact label="очередь" value={num(backlogOf(agent))} tone={backlogOf(agent) ? 'warn' : undefined} />
              <Fact label="ждут человека" value={num(l.awaiting)} />
              <Fact label="готово 24 ч" value={num(l.done_24h)} />
              <Fact label="готово 7 дн" value={num(l.done_7d)} />
              <Fact label="заблокировано" value={num(l.blocked)} tone={l.blocked ? 'warn' : undefined} />
              <Fact label="ошибки 24 ч" value={num(l.errors_24h)} tone={l.errors_24h ? 'bad' : undefined} />
              <Fact label="ошибки 7 дн" value={num(l.errors_7d)} tone={l.errors_7d ? 'bad' : undefined} />
              <Fact label="аренда истекла" value={num(l.lease_expired)} tone={l.lease_expired ? 'bad' : undefined} />
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Последний старт</dt><dd><When value={l.last_started_at} /></dd>
              <dt className="text-muted-foreground">Последнее завершение</dt><dd><When value={l.last_finished_at} /></dd>
              <dt className="text-muted-foreground">Последнее действие</dt>
              <dd>{l.last_step_title ? (<>{l.last_step_title} · {OUTCOME[l.last_step_outcome] || l.last_step_outcome} · <When value={l.last_step_at} /></>) : '—'}</dd>
              {l.is_active === false && (<><dt className="text-muted-foreground">Выключатель</dt><dd className="text-amber-400">агент выключен</dd></>)}
            </dl>
            {l.last_error && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                <div className="mb-0.5 font-semibold text-red-300">
                  Последняя ошибка · <When value={l.last_error_at} />{l.last_error_job ? ` · ${l.last_error_job}` : ''}
                </div>
                <div className="break-words">{l.last_error}</div>
              </div>
            )}
            {Array.isArray(l.job_types) && l.job_types.length > 0 && (
              <div className="mt-3 text-xs">
                <span className="text-muted-foreground">Виды заданий: </span>
                {l.job_types.map((t) => t.title).join(' · ')}
              </div>
            )}
          </>
        ) : agent.kind === 'db' && !office.hasLive ? (
          <p className="mt-4 rounded-lg border border-line bg-black/20 px-3 py-2 text-xs text-muted-foreground">
            Очередь и журнал этого агента появятся после миграции 068.
          </p>
        ) : agent.kind === 'db' ? (
          <p className="mt-4 rounded-lg border border-line bg-black/20 px-3 py-2 text-xs text-muted-foreground">
            Этого вида агента ещё нет в базе (core.agent_kind) — состояние показано по реестру экрана.
          </p>
        ) : (
          <p className="mt-4 rounded-lg border border-line bg-black/20 px-3 py-2 text-xs text-muted-foreground">
            Агент вне базы: очереди в core.job у него нет, состояние — из реестра экрана
            (src/lib/admin/agentsRegistry.js).
          </p>
        )}

        {canJobs && <JobsBlock key={agent.id} agent={agent} loadJobs={loadJobs} />}
      </div>
    </aside>
  );
}

/* ── Таблица ───────────────────────────────────────────────────────────── */

function OfficeTable({ office, selectedId, onSelect }) {
  return (
    <div className="space-y-4">
      {office.departments.map((dept) => (
        <section key={dept.code} className="rounded-xl border border-line bg-surface/40">
          <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
            <h2 className="text-sm font-semibold">
              <span className="mr-2 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: dept.accent }} />
              {dept.title}{dept.soon ? ' · скоро' : ''}
            </h2>
            <span className="text-xs text-muted-foreground">{dept.note}</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Агент</th>
                  <th className="py-2 pr-3 font-medium">Состояние</th>
                  <th className="py-2 pr-3 text-right font-medium">В работе</th>
                  <th className="py-2 pr-3 text-right font-medium">Очередь</th>
                  <th className="py-2 pr-3 text-right font-medium">Готово 24 ч</th>
                  <th className="py-2 pr-3 text-right font-medium">Ошибки 24 ч</th>
                  <th className="py-2 pr-4 font-medium">Последнее</th>
                </tr>
              </thead>
              <tbody>
                {[...dept.agents].sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)).map((a) => (
                  <tr key={a.id} className={cx('border-t border-line/60', a.id === selectedId && 'bg-violet/10')}>
                    <td className="px-4 py-2">
                      <button onClick={() => onSelect(a.id)} className="text-left font-medium hover:text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/60">
                        {a.title}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-xs"><StateText agent={a} /></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a.live ? a.live.running : '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a.live ? backlogOf(a) : '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a.live ? a.live.done_24h : '—'}</td>
                    <td className={cx('py-2 pr-3 text-right tabular-nums', a.live?.errors_24h > 0 && 'text-red-400')}>
                      {a.live ? a.live.errors_24h : '—'}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {a.live?.last_step_title
                        ? <>{a.live.last_step_title} · <When value={a.live.last_step_at} /></>
                        : a.live?.last_finished_at ? <>завершил <When value={a.live.last_finished_at} /></>
                          : a.kind === 'static' ? a.where : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Экран ─────────────────────────────────────────────────────────────── */

const LEGEND = ['working', 'idle', 'queued', 'error', 'asleep', 'live', 'ready', 'soon'];

export default function OfficeView({ office, status = {}, loadJobs, banner }) {
  const [webgl] = useState(detectWebGL);
  // Выбор запоминается. Без выбора на телефоне — таблица (3D там тесно), на остальных — 3D.
  const [mode, setMode] = useState(() => {
    let saved = null;
    try { saved = window.localStorage.getItem('tk_office_view'); } catch { /* хранилище закрыто */ }
    if (saved === 'table' || saved === '3d') return saved;
    return window.innerWidth < 640 ? 'table' : '3d';
  });
  const [failed, setFailed] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  const show3d = webgl && !failed && mode === '3d';
  const choose = (m) => {
    if (m === '3d' && failed) { setFailed(null); setAttempt((n) => n + 1); }
    setMode(m);
    try { window.localStorage.setItem('tk_office_view', m); } catch { /* хранилище закрыто */ }
  };

  const selected = useMemo(
    () => office.agents.find((a) => a.id === selectedId) || null,
    [office.agents, selectedId],
  );
  const selectedDept = selected ? office.departments.find((d) => d.code === selected.dept) : null;
  const close = useCallback(() => setSelectedId(null), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">3D-офис агентов</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Каждый агент — за своим столом в своём отделе. Цвет кольца и экрана — состояние,
            над столом — ошибка и очередь. Нажмите на робота, чтобы увидеть его задачи и журнал.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.at && <Freshness at={status.at} stale={status.stale} error={status.error} />}
          <div className="flex rounded-xl border border-line bg-surface/40 p-1" role="group" aria-label="Вид">
            <button onClick={() => choose('3d')} disabled={!webgl}
              aria-pressed={mode === '3d'}
              className={cx('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40',
                show3d ? 'bg-violet/15 text-violet' : 'text-muted-foreground hover:text-foreground')}>
              <Box className="h-3.5 w-3.5" /> 3D
            </button>
            <button onClick={() => choose('table')} aria-pressed={!show3d}
              className={cx('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                !show3d ? 'bg-violet/15 text-violet' : 'text-muted-foreground hover:text-foreground')}>
              <Table2 className="h-3.5 w-3.5" /> Таблица
            </button>
          </div>
        </div>
      </div>

      {banner}
      {status.error && !status.missing && <ErrorNote error={status.error} />}
      {!webgl && (
        <div className="rounded-lg border border-line bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
          Браузер не дал WebGL — офис показан таблицей. Данные те же.
        </div>
      )}
      {failed && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          3D не запустилось ({failed}) — офис показан таблицей. Данные те же. Попробовать ещё раз — кнопка «3D».
        </div>
      )}

      <Summary office={office} />

      {show3d ? (
        <>
          <div className="relative h-[calc(100vh-17rem)] min-h-[440px] overflow-hidden rounded-xl border border-line bg-[#07060c]">
            <SceneBoundary key={attempt} onFail={setFailed}>
              <Suspense fallback={<div className="absolute inset-0 grid place-items-center"><Spinner label="загружаем 3D-офис" /></div>}>
                <OfficeScene office={office} selectedId={selectedId} onSelect={setSelectedId}
                  resetKey={resetKey} onFail={setFailed} />
              </Suspense>
            </SceneBoundary>
            <button onClick={() => { setSelectedId(null); setResetKey((k) => k + 1); }}
              className="absolute left-3 top-3 z-[50] inline-flex items-center gap-1.5 rounded-lg border border-line bg-black/60 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur hover:text-foreground">
              <LocateFixed className="h-3.5 w-3.5" /> Обзор
            </button>
            {selected && (
              <AgentPanel agent={selected} dept={selectedDept} office={office} loadJobs={loadJobs} onClose={close}
                className="absolute inset-y-0 right-0 z-[60] w-full border-l sm:w-[380px]" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {LEGEND.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5"><StateDot state={s} />{STATE_META[s].short}</span>
            ))}
            <span className="ml-auto hidden md:inline">
              Перетащить — повернуть · колесо — ближе/дальше · правая кнопка — сдвинуть
            </span>
          </div>
        </>
      ) : (
        <>
          <OfficeTable office={office} selectedId={selectedId} onSelect={setSelectedId} />
          {selected && (
            <AgentPanel agent={selected} dept={selectedDept} office={office} loadJobs={loadJobs} onClose={close}
              className="fixed inset-y-0 right-0 z-[60] w-full border-l sm:w-[400px]" />
          )}
        </>
      )}
    </div>
  );
}
