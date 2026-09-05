/**
 * Запросы админки. Все обращения к базе живут здесь, а не в компонентах:
 * когда правило меняется, его надо править в одном месте.
 *
 * Права нигде не проверяются в этом файле — их проверяет база. Если запрос
 * вернул пусто, это может быть и правильным ответом разграничения доступа.
 */
import { appDb, coreDb, crmDb, devDb, supabase } from './client';

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

/* ── Обзор ─────────────────────────────────────────────────────────────── */

export const fetchOverview = async () =>
  unwrap(await appDb.from('v_overview').select('*').single());

export const fetchEstimateQuality = async () =>
  unwrap(await appDb.from('v_estimate_quality').select('*').single());

/* ── Заявки ────────────────────────────────────────────────────────────── */

export const fetchTickets = async ({ status, kind, companyId, limit = 100 } = {}) => {
  let q = appDb.from('v_ticket_list').select('*').order('created_at', { ascending: false });
  if (status?.length) q = q.in('status', status);
  if (kind) q = q.eq('kind', kind);
  if (companyId) q = q.eq('company_id', companyId);
  return unwrap(await q.limit(limit));
};

export const fetchTicket = async (id) =>
  unwrap(await appDb.from('v_ticket_list').select('*').eq('id', id).single());

export const fetchTicketMessages = async (ticketId) =>
  unwrap(await crmDb.from('ticket_message').select('*').eq('ticket_id', ticketId).order('at'));

export const addTicketMessage = async (ticketId, body, author = 'me') =>
  unwrap(await crmDb.from('ticket_message').insert({ ticket_id: ticketId, body, author }).select().single());

export const updateTicket = async (id, patch) =>
  unwrap(await crmDb.from('ticket').update(patch).eq('id', id).select().single());

export const createTicket = async (values) =>
  unwrap(await crmDb.from('ticket').insert({ ...values, channel: values.channel || 'manual' }).select().single());

/* ── Оценки ────────────────────────────────────────────────────────────── */

export const fetchEstimates = async (ticketId) =>
  unwrap(await crmDb.from('estimate').select('*').eq('ticket_id', ticketId)
    .order('created_at', { ascending: false }));

/**
 * Принятие оценки. `decidedBy` обязателен — этого требует и триггер базы:
 * оценка не может принять себя сама.
 */
export const decideEstimate = async (id, status, decidedBy, editDelta = null) =>
  unwrap(await crmDb.from('estimate')
    .update({ status, decided_by: decidedBy, decided_at: new Date().toISOString(),
              ...(editDelta || {}) })
    .eq('id', id).select().single());

export const createEstimate = async (values) =>
  unwrap(await crmDb.from('estimate').insert(values).select().single());

/* ── Компании ──────────────────────────────────────────────────────────── */

export const fetchCompanies = async () =>
  unwrap(await crmDb.from('company').select('*').order('title'));

export const saveCompany = async ({ id, ...values }) =>
  id
    ? unwrap(await crmDb.from('company').update(values).eq('id', id).select().single())
    : unwrap(await crmDb.from('company').insert(values).select().single());

export const fetchContacts = async (companyId) =>
  unwrap(await crmDb.from('contact').select('*').eq('company_id', companyId).order('full_name'));

/* ── Время ─────────────────────────────────────────────────────────────── */

export const fetchTimeEntries = async ({ from, to, ticketId } = {}) => {
  let q = crmDb.from('time_entry').select('*, ticket:ticket_id(subject, company_id)')
    .order('started_at', { ascending: false });
  if (from) q = q.gte('started_at', from);
  if (to) q = q.lte('started_at', to);
  if (ticketId) q = q.eq('ticket_id', ticketId);
  return unwrap(await q.limit(500));
};

export const addTimeEntry = async (values) =>
  unwrap(await crmDb.from('time_entry').insert(values).select().single());

/* ── Конфигурации 1С ───────────────────────────────────────────────────── */

export const fetchConfigs = async () =>
  unwrap(await appDb.from('v_config_health').select('*').order('company_title'));

export const saveConfigSnapshot = async ({ id, ...values }) =>
  id
    ? unwrap(await devDb.from('config_snapshot').update(values).eq('id', id).select().single())
    : unwrap(await devDb.from('config_snapshot').insert(values).select().single());

export const fetchReports = async (snapshotId) =>
  unwrap(await devDb.from('report').select('*').eq('snapshot_id', snapshotId)
    .order('created_at', { ascending: false }).limit(50));

/* ── Очередь и журнал ──────────────────────────────────────────────────── */

export const fetchQueue = async ({ status, agentKind, limit = 100 } = {}) => {
  let q = appDb.from('v_queue').select('*').order('created_at', { ascending: false });
  if (status?.length) q = q.in('status', status);
  if (agentKind) q = q.eq('agent_kind', agentKind);
  return unwrap(await q.limit(limit));
};

export const fetchActionLog = async (limit = 100) =>
  unwrap(await coreDb.from('action_log').select('*').order('at', { ascending: false }).limit(limit));

export const fetchEscalations = async () =>
  unwrap(await coreDb.from('escalation').select('*').eq('status', 'open')
    .order('created_at', { ascending: false }));

export const closeEscalation = async (id) =>
  unwrap(await coreDb.from('escalation')
    .update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id).select().single());

/**
 * Постановка задания агенту.
 *
 * dedupeKey защищает от двойного нажатия кнопки: тот же ключ среди живых
 * заданий второй раз не встанет — это индекс в базе, а не проверка в интерфейсе.
 */
export const enqueueJob = async ({ tenantId, jobType, agentKind, payload = {}, priority = 5, dedupeKey = null }) =>
  unwrap(await coreDb.from('job').insert({
    tenant_id: tenantId, job_type: jobType, agent_kind: agentKind,
    payload, priority, dedupe_key: dedupeKey, requested_by: 'admin',
  }).select().single());

export const fetchJobTypes = async () =>
  unwrap(await coreDb.from('job_type').select('*').eq('is_active', true).order('code'));

/* ── Служебное ─────────────────────────────────────────────────────────── */

export const fetchMe = async (authUserId) =>
  unwrap(await coreDb.from('person').select('*').eq('auth_user_id', authUserId).maybeSingle());

export const linkMe = async (email, name) =>
  unwrap(await supabase.rpc('link_me', { p_email: email, p_name: name }));
