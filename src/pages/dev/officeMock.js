/**
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ. Выдуманный ответ public.agents_office() / agents_office_jobs() для демо
 * экрана «3D-офис» (/admin/dev-office). В прод-сборку не попадает: импортируется только из
 * src/pages/dev/OfficeDemo.jsx, а тот подключается в App.jsx под import.meta.env.DEV.
 * Цифры и тексты — тестовые, не про настоящих клиентов.
 */
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

const row = (code, title, over = {}) => ({
  code, title, is_active: true, max_parallel: 1,
  running: 0, lease_expired: 0, queued: 0, retrying: 0, blocked: 0, awaiting: 0,
  done_24h: 0, done_7d: 0, errors_24h: 0, errors_7d: 0,
  last_started_at: null, last_finished_at: null, last_activity_at: null, alive: false,
  last_error: null, last_error_at: null, last_error_job: null,
  last_step_at: null, last_step_title: null, last_step_outcome: null, job_types: [],
  ...over,
});

export function mockOffice() {
  return {
    at: new Date().toISOString(),
    alive_hours: 24,
    runner_last_seen: ago(2),
    agents: [
      row('registrar', 'Регистратор заявок', {
        max_parallel: 2, running: 1, done_24h: 6, done_7d: 31, alive: true,
        last_started_at: ago(1), last_finished_at: ago(14), last_activity_at: ago(1),
        last_step_at: ago(14), last_step_title: 'Классификация заявки', last_step_outcome: 'ok',
        job_types: [{ code: 'registrar.intake', title: 'Разбор входящего сообщения' }],
      }),
      row('estimator', 'Оценщик', {
        max_parallel: 2, queued: 3, done_24h: 2, done_7d: 12, alive: true,
        last_started_at: ago(50), last_finished_at: ago(48), last_activity_at: ago(48),
        last_step_at: ago(48), last_step_title: 'Черновик оценки', last_step_outcome: 'ok',
        job_types: [{ code: 'estimator.draft', title: 'Черновик оценки по заявке' }],
      }),
      row('dispatcher', 'Диспетчер', {
        done_24h: 1, done_7d: 9, alive: true, last_started_at: ago(200), last_finished_at: ago(199),
        last_activity_at: ago(199), last_step_at: ago(199), last_step_title: 'Черновик ответа клиенту',
        last_step_outcome: 'escalated',
        job_types: [{ code: 'dispatcher.route', title: 'Что делать с заявкой дальше' }],
      }),
      row('herald', 'Вестник', {
        retrying: 1, errors_24h: 2, errors_7d: 3, done_24h: 11, done_7d: 64, alive: true,
        last_started_at: ago(6), last_finished_at: ago(30), last_activity_at: ago(6),
        last_error: 'Telegram 429: Too Many Requests: retry after [число]', last_error_at: ago(6),
        last_error_job: 'herald.notify',
        job_types: [{ code: 'herald.notify', title: 'Доставка сообщения' }],
      }),
      row('controller', 'Контролёр', {
        last_started_at: ago(60 * 24 * 26), last_finished_at: ago(60 * 24 * 26),
        last_activity_at: ago(60 * 24 * 26),
        job_types: [{ code: 'controller.weekly', title: 'Недельная самопроверка' }],
      }),
      row('clerk', 'Приказчик', {
        queued: 1, job_types: [{ code: 'clerk.month_close', title: 'Сводка на закрытие месяца' }],
      }),
      row('dev_1c', 'Инженер 1С (раннер на ПК)', {
        max_parallel: 4, running: 2, queued: 1, done_24h: 3, done_7d: 17, alive: true,
        last_started_at: ago(3), last_finished_at: ago(40), last_activity_at: ago(3),
        last_step_at: ago(40), last_step_title: 'Запись в _index и _reports', last_step_outcome: 'ok',
        job_types: [
          { code: 'dev.audit', title: 'Аудит доработок' },
          { code: 'dev.diagnose', title: 'Разбор ошибки' },
          { code: 'dev.index', title: 'Построение индекса конфигурации' },
        ],
      }),
      row('content', 'Контентщик', {
        done_24h: 1, done_7d: 4, alive: true, last_started_at: ago(300), last_finished_at: ago(298),
        last_activity_at: ago(298), last_step_at: ago(298), last_step_title: 'Пост в канал и Instagram',
        last_step_outcome: 'escalated',
        job_types: [{ code: 'content.draft', title: 'Черновик поста по теме' }],
      }),
    ],
  };
}

export function mockJobs(code) {
  const base = mockOffice().agents.find((a) => a.code === code);
  const title = base?.job_types?.[0]?.title || 'Задание';
  const type = base?.job_types?.[0]?.code || `${code}.job`;
  const jobs = [
    { id: 1042, job_type: type, title, status: base?.running ? 'leased' : 'done', priority: 5, attempts: 1,
      max_attempts: 3, created_at: ago(4), started_at: ago(3), finished_at: base?.running ? null : ago(2),
      duration_sec: base?.running ? null : 64, next_attempt_at: null, cost_usd: 0.012, error: null },
    { id: 1031, job_type: type, title, status: code === 'herald' ? 'failed' : 'done', priority: 5,
      attempts: 2, max_attempts: 3, created_at: ago(35), started_at: ago(34), finished_at: ago(33),
      duration_sec: 41, next_attempt_at: code === 'herald' ? ago(-5) : null, cost_usd: 0,
      error: code === 'herald' ? 'Telegram 429: Too Many Requests: retry after [число]' : null },
    { id: 1019, job_type: type, title, status: 'done_empty', priority: 6, attempts: 1, max_attempts: 3,
      created_at: ago(180), started_at: ago(179), finished_at: ago(178), duration_sec: 12,
      next_attempt_at: null, cost_usd: 0, error: null },
  ];
  const steps = [
    { at: ago(2), action_type: 'ticket.classify', title: 'Классификация заявки', target_system: 'internal',
      outcome: 'ok', job_id: 1042, duration_ms: 3200, cost_usd: 0.004, error: null },
    { at: ago(33), action_type: 'msg.send_tg', title: 'Отправка в Telegram', target_system: 'telegram',
      outcome: code === 'herald' ? 'error' : 'ok', job_id: 1031, duration_ms: 800, cost_usd: 0,
      error: code === 'herald' ? 'Telegram 429: Too Many Requests' : null },
  ];
  return { agent_kind: code, jobs, steps };
}
