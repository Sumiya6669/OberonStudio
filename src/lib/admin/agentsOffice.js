/**
 * Офис агентов: реестр экрана + живые данные из базы → отделы со столами и состоянием каждого агента.
 *
 * Чистые функции без React и three: этим пользуются и 3D-сцена, и запасная таблица, и демо в dev.
 *
 * Состояние агента (state) — одно слово, по нему выбирается поза робота, цвет и подпись:
 *   working  — есть задание в работе (leased);
 *   error    — последнее, что случилось, — ошибка: задание ждёт повтора, упало окончательно за 24 ч
 *              позже последнего успешного, или аренда истекла, а агент не отчитался;
 *   queued   — в очереди есть задания, но никто их сейчас не делает;
 *   idle     — живой (была активность за alive_hours), задач нет — ждёт;
 *   asleep   — активности не было дольше alive_hours;
 *   disabled — агент выключен (core.agent_kind / core.agent_limit);
 *   unknown  — агент из базы, а живых данных нет (миграция 068 не применена);
 *   live     — агент вне базы, работает (из реестра);
 *   ready    — готов, ждёт сервера / клиента / … (из реестра);
 *   soon     — в плане: пустой стол с табличкой «скоро».
 */
import { AGENTS, DEPARTMENTS } from './agentsRegistry';

export const STATE_META = {
  working:  { label: 'работает над задачей', short: 'работает', color: '#34d399', tone: 'good' },
  error:    { label: 'ошибка',               short: 'ошибка',   color: '#f87171', tone: 'bad' },
  queued:   { label: 'задачи ждут в очереди', short: 'очередь', color: '#fbbf24', tone: 'warn' },
  idle:     { label: 'ждёт задач',           short: 'ждёт',     color: '#a78bfa', tone: 'default' },
  asleep:   { label: 'нет активности',       short: 'спит',     color: '#64748b', tone: 'muted' },
  disabled: { label: 'выключен',             short: 'выключен', color: '#475569', tone: 'muted' },
  unknown:  { label: 'нет живых данных',     short: 'нет данных', color: '#64748b', tone: 'muted' },
  live:     { label: 'работает',             short: 'работает', color: '#34d399', tone: 'good' },
  ready:    { label: 'готов',                short: 'готов',    color: '#60a5fa', tone: 'info' },
  soon:     { label: 'скоро',                short: 'скоро',    color: '#6b7280', tone: 'muted' },
};

/** Порядок важности для сводки и сортировки таблицы. */
export const STATE_ORDER = ['error', 'working', 'queued', 'idle', 'live', 'ready', 'asleep', 'unknown', 'disabled', 'soon'];

const toTime = (v) => (v ? new Date(v).getTime() : 0);

/** Состояние агента из базы по строке agents_office(). */
export function liveState(row) {
  if (!row) return 'unknown';
  if (row.is_active === false) return 'disabled';
  if (row.running > 0) return 'working';
  const lastErr = toTime(row.last_error_at);
  const errorIsLatest = lastErr > 0 && lastErr >= toTime(row.last_finished_at)
    && Date.now() - lastErr < 24 * 3600 * 1000;
  if (row.lease_expired > 0 || row.retrying > 0 || errorIsLatest) return 'error';
  if (row.queued + row.blocked + row.awaiting > 0) return 'queued';
  return row.alive ? 'idle' : 'asleep';
}

/** Подпись состояния полностью: «готов, ждёт сервера», «нет активности 24 ч». */
export function stateLabel(agent, aliveHours = 24) {
  const meta = STATE_META[agent.state] || STATE_META.unknown;
  if (agent.state === 'ready' && agent.waits) return `готов, ждёт ${agent.waits}`;
  if (agent.state === 'asleep') return `нет активности больше ${aliveHours} ч`;
  return meta.label;
}

/** Задания, которые ждут исполнителя: в очереди и на повторе. */
export const backlogOf = (a) => (a.live ? (a.live.queued || 0) + (a.live.retrying || 0) : 0);

/**
 * Собрать офис.
 *   live — ответ agents_office() или null (068 не применена / ещё не загружено).
 * Возвращает { departments: [{…отдел, agents}], agents, totals, hasLive, aliveHours }.
 */
export function buildOffice(live) {
  const hasLive = Boolean(live && Array.isArray(live.agents));
  const rows = new Map((hasLive ? live.agents : []).map((r) => [r.code, r]));
  const seen = new Set();
  const agents = [];

  for (const reg of AGENTS) {
    if (reg.kind === 'db') {
      seen.add(reg.id);
      const row = rows.get(reg.id);
      if (row) {
        agents.push({ ...reg, title: row.title || reg.title, live: row, state: liveState(row), present: true });
      } else if (reg.status) {
        // Вида агента в базе нет (миграция не применена) — показываем по реестру.
        agents.push({ ...reg, state: reg.status, present: false });
      } else {
        agents.push({ ...reg, state: 'unknown', present: false });
      }
    } else {
      agents.push({ ...reg, state: reg.status || 'ready', present: false });
    }
  }

  // Новые виды агентов в базе, которых нет в реестре экрана, — в «Прочие».
  for (const row of rows.values()) {
    if (seen.has(row.code)) continue;
    agents.push({
      id: row.code, kind: 'db', dept: 'other', title: row.title || row.code,
      role: 'Вид агента из базы (core.agent_kind). В реестре экрана описания нет — его стоит добавить '
        + 'в src/lib/admin/agentsRegistry.js.',
      where: '—', source: 'core.agent_kind', live: row, state: liveState(row), present: true,
    });
  }

  const aliveHours = live?.alive_hours || 24;
  for (const a of agents) a.stateText = stateLabel(a, aliveHours);

  const departments = DEPARTMENTS
    .map((d) => ({ ...d, agents: agents.filter((a) => a.dept === d.code) }))
    .filter((d) => d.agents.length > 0);

  const totals = {};
  for (const a of agents) totals[a.state] = (totals[a.state] || 0) + 1;
  totals.backlog = agents.reduce((s, a) => s + backlogOf(a), 0);

  return {
    departments, agents, totals, hasLive,
    aliveHours,
    runnerLastSeen: live?.runner_last_seen || null,
  };
}

/** Короткая сводка отдела для таблички: «2 работают · 1 ошибка». */
export function deptSummary(dept) {
  const n = (s) => dept.agents.filter((a) => a.state === s).length;
  const parts = [];
  const working = n('working');
  const errors = n('error');
  const queued = n('queued');
  const live = n('live');
  const ready = n('ready');
  const soon = n('soon');
  if (working) parts.push(`работают: ${working}`);
  if (errors) parts.push(`ошибки: ${errors}`);
  if (queued) parts.push(`очередь: ${queued}`);
  if (live) parts.push(`в строю: ${live}`);
  if (ready) parts.push(`готовы: ${ready}`);
  if (soon) parts.push(`скоро: ${soon}`);
  return parts.join(' · ') || `агентов: ${dept.agents.length}`;
}

/** Ошибка «функции ещё нет в базе» (миграция не применена) — это «не включено», а не сбой. */
export const MISSING_FN = /could not find the function|schema cache|does not exist|PGRST202/i;
