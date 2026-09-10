/**
 * Запросы админки. Все обращения к базе живут здесь, а не в компонентах:
 * когда правило меняется, его надо править в одном месте.
 *
 * Права нигде не проверяются в этом файле — их проверяет база. Если запрос
 * вернул пусто, это может быть и правильным ответом разграничения доступа.
 */
import { accDb, appDb, cmsDb, coreDb, crmDb, devDb, supabase } from './client';

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

/* ══ Бух учет ═══════════════════════════════════════════════════════════════ */

/**
 * Проведение, сторно и отмена идут через функции базы, а не через update.
 * Причина в самой базе: проведённый документ неизменяем триггером, у проведения
 * обязан быть автор-человек, а сторно — это отдельный зеркальный документ.
 * Если бы панель делала update напрямую, она бы просто получала отказ.
 */
export const postEntry = async (id) =>
  unwrap(await supabase.rpc('acc_entry_post', { p_entry: id }));

export const reverseEntry = async (id, reason) =>
  unwrap(await supabase.rpc('acc_entry_reverse', { p_entry: id, p_reason: reason }));

export const voidEntry = async (id, reason) =>
  unwrap(await supabase.rpc('acc_entry_void', { p_entry: id, p_reason: reason }));

export const addExpense = async (payload) =>
  unwrap(await supabase.rpc('acc_expense_new', { p: payload }));

export const invoiceFromTime = async (payload) =>
  unwrap(await supabase.rpc('acc_invoice_from_time', { p: payload }));

export const fetchAccounts = async () =>
  unwrap(await accDb.from('account').select('*').order('sort'));

export const fetchBalance = async () =>
  unwrap(await appDb.from('v_acc_balance').select('*').order('sort'));

export const fetchEntries = async ({ status, kind, from, to, limit = 200 } = {}) => {
  let q = appDb.from('v_entry_list').select('*').order('entry_date', { ascending: false })
    .order('id', { ascending: false });
  if (status?.length) q = q.in('status', status);
  if (kind) q = q.eq('kind', kind);
  if (from) q = q.gte('entry_date', from);
  if (to) q = q.lte('entry_date', to);
  return unwrap(await q.limit(limit));
};

/**
 * Проводки читаются из витрины, а не из таблицы со встроенной связью:
 * связь проводки со счётом составная (клиент + код), а PostgREST встраивает
 * только связи по одной колонке — запрос с embed просто вернул бы ошибку.
 */
export const fetchPostings = async (entryId) =>
  unwrap(await appDb.from('v_posting').select('*').eq('entry_id', entryId).order('id'));

export const fetchDocs = async ({ status, kind, companyId, limit = 200 } = {}) => {
  let q = appDb.from('v_doc_list').select('*').order('issued_on', { ascending: false })
    .order('id', { ascending: false });
  if (status?.length) q = q.in('status', status);
  if (kind) q = q.eq('kind', kind);
  if (companyId) q = q.eq('company_id', companyId);
  return unwrap(await q.limit(limit));
};

export const updateDoc = async (id, patch) =>
  unwrap(await crmDb.from('doc').update(patch).eq('id', id).select().single());

export const fetchPayments = async ({ limit = 200 } = {}) =>
  unwrap(await crmDb.from('payment')
    .select('*, company:company_id(title), doc:doc_id(number, amount)')
    .order('paid_on', { ascending: false }).order('id', { ascending: false })
    .limit(limit));

export const addPayment = async (values) =>
  unwrap(await crmDb.from('payment').insert(values).select().single());

export const fetchPnl = async () =>
  unwrap(await appDb.from('v_pnl_month').select('*').order('month', { ascending: false }));

export const fetchPnlLines = async (month) => {
  let q = appDb.from('v_pnl_line').select('*').order('sort');
  if (month) q = q.eq('month', month);
  return unwrap(await q);
};

export const fetchCashMonths = async () =>
  unwrap(await appDb.from('v_cash_month').select('*').order('month', { ascending: false }));

export const fetchReceivables = async () =>
  unwrap(await appDb.from('v_ar_company').select('*').order('debt', { ascending: false }));

export const fetchHourCost = async () =>
  unwrap(await appDb.from('v_hour_cost_month').select('*').order('month', { ascending: false }));

export const fetchClientProfit = async () =>
  unwrap(await appDb.from('v_client_profit').select('*').order('income', { ascending: false }));

export const fetchUnbilled = async () =>
  unwrap(await appDb.from('v_unbilled').select('*').order('amount', { ascending: false }));

/* ══ ИИ ═════════════════════════════════════════════════════════════════════ */

/** Один вызов на один такт опроса. Почему один — см. миграцию 016. */
export const fetchPulse = async (since = null, steps = 40) =>
  unwrap(await supabase.rpc('ai_pulse', { p_since: since, p_steps: steps }));

export const fetchAgentBoard = async () =>
  unwrap(await appDb.from('v_agent_board').select('*').order('title'));

export const fetchSteps = async ({ outcome, actionType, jobId, limit = 200 } = {}) => {
  let q = appDb.from('v_ai_step').select('*').order('at', { ascending: false });
  if (outcome?.length) q = q.in('outcome', outcome);
  if (actionType) q = q.eq('action_type', actionType);
  if (jobId) q = q.eq('job_id', jobId);
  return unwrap(await q.limit(limit));
};

export const fetchSpendDays = async () =>
  unwrap(await appDb.from('v_ai_spend_day').select('*').order('day', { ascending: false }));

export const fetchQuotas = async () =>
  unwrap(await appDb.from('v_quota_state').select('*').order('provider'));

export const saveQuota = async ({ tenant_id, provider, period, limit_units, soft_pct }) =>
  unwrap(await coreDb.from('quota')
    .upsert({ tenant_id, provider, period, limit_units, soft_pct },
            { onConflict: 'tenant_id,provider,period' })
    .select().single());

export const fetchGrantMatrix = async () =>
  unwrap(await appDb.from('v_grant_matrix').select('*')
    .order('agent_title').order('action_title'));

/**
 * Смена режима права. Отзыв — это revoked_at у прежней строки, а не update
 * поля mode: иначе исчезает след того, что право когда-то было выдано.
 */
export const setGrant = async ({ grantId, tenantId, agentKind, actionType, mode, grantedBy, note, limits }) => {
  if (grantId) {
    await unwrap(await coreDb.from('grant')
      .update({ revoked_at: new Date().toISOString() }).eq('id', grantId).select());
  }
  if (mode === 'deny' && !grantId) return null;
  return unwrap(await coreDb.from('grant').insert({
    tenant_id: tenantId, agent_kind: agentKind, action_type: actionType,
    mode, granted_by: grantedBy, note: note || null, limits: limits || {},
  }).select().single());
};

export const fetchApprovals = async ({ status = ['pending'] } = {}) =>
  unwrap(await appDb.from('v_approval').select('*').in('status', status)
    .order('expires_at').limit(100));

export const decideApproval = async (id, status, personId, { editDelta, rejectReason } = {}) =>
  unwrap(await coreDb.from('approval').update({
    status, decided_by: personId, decided_at: new Date().toISOString(),
    edit_delta: editDelta || null, reject_reason: rejectReason || null,
  }).eq('id', id).select().single());

/* ══ Администрирование ══════════════════════════════════════════════════════ */

export const fetchPeople = async () =>
  unwrap(await appDb.from('v_person').select('*').order('full_name'));

export const savePerson = async ({ id, ...values }) =>
  id
    ? unwrap(await coreDb.from('person').update(values).eq('id', id).select().single())
    : unwrap(await coreDb.from('person').insert(values).select().single());

export const fetchRoles = async () =>
  unwrap(await coreDb.from('role').select('*').order('code'));

export const setPersonRoles = async (tenantId, personId, roles) => {
  await unwrap(await coreDb.from('person_role').delete().eq('person_id', personId).select());
  if (!roles.length) return [];
  return unwrap(await coreDb.from('person_role')
    .insert(roles.map((role_code) => ({ tenant_id: tenantId, person_id: personId, role_code })))
    .select());
};

export const fetchAllowedEmails = async () =>
  unwrap(await coreDb.from('allowed_email').select('*').order('email'));

export const addAllowedEmail = async (values) =>
  unwrap(await coreDb.from('allowed_email').insert(values).select().single());

export const removeAllowedEmail = async (email) =>
  unwrap(await coreDb.from('allowed_email').delete().eq('email', email).select());

export const fetchAgentKinds = async () =>
  unwrap(await coreDb.from('agent_kind').select('*').order('title'));

/**
 * Выключатель и предел одновременности пишутся в переопределение на клиента,
 * а не в общий реестр core.agent_kind.
 *
 * Причина не косметическая: у общего реестра нет tenant_id, и политика
 * доступа разрешает только чтение — предел одного клиента не должен меняться
 * из панели другого. Прямая правка реестра просто не сохранялась бы.
 *
 * Пустое значение означает «как в общем реестре»: строка переопределения
 * с одним заполненным полем не обнуляет остальные.
 */
export const saveAgentLimit = async ({ tenantId, agentKind, maxParallel, isActive, note }) =>
  unwrap(await coreDb.from('agent_limit')
    .upsert({
      tenant_id: tenantId,
      agent_kind: agentKind,
      max_parallel: maxParallel ?? null,
      is_active: isActive ?? null,
      note: note || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,agent_kind' })
    .select().single());

export const resetAgentLimit = async (agentKind) =>
  unwrap(await coreDb.from('agent_limit').delete().eq('agent_kind', agentKind).select());

/**
 * Виды заданий только читаются. Их сроки и число попыток — свойство самой
 * работы, а не клиента: «аудит доработок держится два часа» верно для любого.
 * Менять это стоит осознанно и редко, поэтому правка идёт запросом в базе,
 * а не кнопкой, которую легко нажать не туда.
 */
export const fetchJobTypesAll = async () =>
  unwrap(await coreDb.from('job_type').select('*').order('code'));

export const fetchHealth = async () =>
  unwrap(await appDb.from('v_system_health').select('*').single());

/* ══ Сайт (CMS) ═════════════════════════════════════════════════════════════ */

export const fetchCmsPages = async () =>
  unwrap(await appDb.from('v_cms_page').select('*').order('sort'));

export const savePage = async ({ id, ...values }) =>
  id
    ? unwrap(await cmsDb.from('page').update(values).eq('id', id).select().single())
    : unwrap(await cmsDb.from('page').insert(values).select().single());

export const fetchBlocks = async (pageId) =>
  unwrap(await cmsDb.from('block').select('*').eq('page_id', pageId).order('sort'));

export const saveBlock = async ({ id, ...values }) =>
  id
    ? unwrap(await cmsDb.from('block').update(values).eq('id', id).select().single())
    : unwrap(await cmsDb.from('block').insert(values).select().single());

export const removeBlock = async (id) =>
  unwrap(await cmsDb.from('block').delete().eq('id', id).select());

export const fetchCollections = async () =>
  unwrap(await cmsDb.from('collection').select('*').order('sort'));

export const fetchItems = async (collection) =>
  unwrap(await appDb.from('v_cms_item').select('*').eq('collection', collection).order('sort'));

export const saveItem = async ({ id, ...values }) =>
  id
    ? unwrap(await cmsDb.from('item').update(values).eq('id', id).select().single())
    : unwrap(await cmsDb.from('item').insert(values).select().single());

export const removeItem = async (id) =>
  unwrap(await cmsDb.from('item').delete().eq('id', id).select());

export const fetchSiteSettings = async () =>
  unwrap(await cmsDb.from('settings').select('*').maybeSingle());

export const saveSiteSettings = async (tenantId, data) =>
  unwrap(await cmsDb.from('settings')
    .upsert({ tenant_id: tenantId, data, updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id' })
    .select().single());

export const fetchRevisions = async (entity, rowId, limit = 30) =>
  unwrap(await cmsDb.from('revision').select('*')
    .eq('entity', entity).eq('row_id', rowId)
    .order('at', { ascending: false }).limit(limit));

/** Опубликованное содержимое сайта. Той же функцией, что читает публичный сайт. */
export const fetchSiteContent = async (locale = 'ru') =>
  unwrap(await supabase.rpc('site_content', { p_locale: locale }));
