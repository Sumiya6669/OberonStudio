-- 016. Наблюдение: что делают агенты, сколько это стоит, и что с системой.
--
-- Раздел «ИИ» в панели опрашивает базу каждые 3 секунды. Поэтому здесь есть
-- одна функция public.ai_pulse(), которая отдаёт ВСЁ нужное живому экрану за
-- один вызов. Шесть отдельных запросов каждые три секунды — это двадцать
-- запросов в минуту на пустом месте и шесть разных мнений о том, «который час»:
-- доска показывала бы одно состояние, лента другое, расход третье.
--
-- Остальное — обычные витрины: они читаются по нажатию, а не по таймеру.

-- ── Доска агентов ────────────────────────────────────────────────────────────
-- Ключевая цифра — running против max_parallel. Именно она отвечает на вопрос
-- «почему очередь стоит»: чаще всего не потому что агент занят, а потому что
-- предел параллельности выбран.

drop view if exists app.v_agent_board cascade;
create view app.v_agent_board with (security_invoker = true) as
select ak.code, ak.title, ak.is_active, ak.max_parallel,
       t.id as tenant_id,
       count(j.id) filter (where j.status = 'leased')                    as running,
       count(j.id) filter (where j.status in ('queued','failed'))        as waiting,
       count(j.id) filter (where j.status = 'blocked')                   as blocked,
       count(j.id) filter (where j.status = 'awaiting')                  as awaiting,
       count(j.id) filter (where j.status = 'leased'
                             and j.lease_until < now())                  as lease_expired,
       count(j.id) filter (where j.status in ('done','done_empty')
                             and j.finished_at >= now() - interval '24 hours') as done_day,
       count(j.id) filter (where j.status = 'done_empty'
                             and j.finished_at >= now() - interval '24 hours') as empty_day,
       count(j.id) filter (where j.status = 'dead'
                             and j.finished_at >= now() - interval '7 days')   as dead_week,
       coalesce(sum(j.cost_act_usd) filter (
                  where j.finished_at >= now() - interval '24 hours'), 0)      as cost_day,
       max(j.finished_at)                                                as last_finished_at,
       -- Медиана длительности честнее среднего: одно задание на два часа
       -- иначе делает вид, что все задания долгие.
       round((percentile_cont(0.5) within group (
         order by extract(epoch from (j.finished_at - j.started_at))
       ) filter (where j.finished_at is not null and j.started_at is not null
                   and j.finished_at >= now() - interval '7 days'))::numeric, 0)
                                                                         as median_sec
  from core.agent_kind ak
  -- Ровно один клиент — текущий. Перекрёстное соединение со ВСЕМИ клиентами
  -- давало агенту, который видит реестр целиком, вторую строку с нулями,
  -- и выбор между ними был случайным.
  cross join (select id from core.tenant where id = core.my_tenant()) t
  left join core.job j on j.agent_kind = ak.code and j.tenant_id = t.id
 group by ak.code, ak.title, ak.is_active, ak.max_parallel, t.id;

-- ── Лента шагов ──────────────────────────────────────────────────────────────

drop view if exists app.v_ai_step cascade;
create view app.v_ai_step with (security_invoker = true) as
select l.id, l.tenant_id, l.at, l.actor_kind, l.actor_ref, l.action_type,
       at2.title as action_title, at2.has_side_effect,
       l.target_system, l.target_ref, l.outcome, l.error_text, l.confidence,
       l.job_id, l.approval_id, l.tokens_in, l.tokens_out, l.cost_usd,
       l.duration_ms, l.params,
       j.job_type, j.agent_kind, jt.title as job_title,
       p.full_name as on_behalf_of_name
  from core.action_log l
  join core.action_type at2 on at2.code = l.action_type
  left join core.job j on j.id = l.job_id
  left join core.job_type jt on jt.code = j.job_type
  left join core.person p on p.id = l.on_behalf_of;

-- ── Расход ───────────────────────────────────────────────────────────────────

drop view if exists app.v_ai_spend_day cascade;
create view app.v_ai_spend_day with (security_invoker = true) as
select date_trunc('day', u.at)::date as day, u.tenant_id, u.provider,
       pv.title as provider_title, pv.unit,
       sum(u.units)    as units,
       sum(u.cost_usd) as cost_usd,
       count(*)        as events
  from core.usage_event u
  join core.provider pv on pv.code = u.provider
 where u.at >= now() - interval '60 days'
 group by 1, 2, 3, 4, 5;

drop view if exists app.v_quota_state cascade;
create view app.v_quota_state with (security_invoker = true) as
select q.tenant_id, q.provider, pv.title as provider_title, pv.unit,
       q.period, q.limit_units, q.soft_pct,
       coalesce(r.units, 0)          as used,
       coalesce(r.reserved_units, 0) as reserved,
       coalesce(r.cost_usd, 0)       as cost_usd,
       q.limit_units - coalesce(r.units, 0) - coalesce(r.reserved_units, 0) as free,
       round(100.0 * (coalesce(r.units, 0) + coalesce(r.reserved_units, 0))
             / nullif(q.limit_units, 0), 1) as used_pct,
       (coalesce(r.units, 0) + coalesce(r.reserved_units, 0))
         >= q.limit_units * q.soft_pct / 100.0 as soft_reached,
       (coalesce(r.units, 0) + coalesce(r.reserved_units, 0)) >= q.limit_units as exhausted,
       case q.period when 'day' then current_date
                     else date_trunc('month', current_date)::date end as period_start
  from core.quota q
  join core.provider pv on pv.code = q.provider
  left join core.usage_rollup r
         on r.tenant_id = q.tenant_id and r.provider = q.provider
        and r.period = q.period
        and r.period_start = case q.period when 'day' then current_date
                                  else date_trunc('month', current_date)::date end;

-- ── Права, автономия, эскалации ──────────────────────────────────────────────
-- Матрица прав строится от полного набора агент × действие, а не от выданных
-- прав: отсутствие строки — это deny, и его надо ВИДЕТЬ, а не догадываться.

drop view if exists app.v_grant_matrix cascade;
create view app.v_grant_matrix with (security_invoker = true) as
select t.id as tenant_id, ak.code as agent_kind, ak.title as agent_title,
       at2.code as action_type, at2.title as action_title,
       at2.target_system, at2.has_side_effect, at2.min_confidence,
       at2.autonomy_threshold,
       coalesce(g.mode, 'deny') as mode,
       (g.id is null)           as implicit,
       coalesce(g.limits, '{}'::jsonb) as limits,
       g.id as grant_id, g.granted_at, g.note,
       gp.full_name as granted_by_name,
       coalesce(s.streak_clean, 0)   as streak_clean,
       coalesce(s.total_approved, 0) as total_approved,
       coalesce(s.total_edited, 0)   as total_edited,
       coalesce(s.total_rejected, 0) as total_rejected,
       greatest(at2.autonomy_threshold - coalesce(s.streak_clean, 0), 0) as to_autonomy
  from (select id from core.tenant where id = core.my_tenant()) t
  cross join core.agent_kind ak
  cross join core.action_type at2
  left join core."grant" g on g.tenant_id = t.id and g.agent_kind = ak.code
                          and g.action_type = at2.code and g.revoked_at is null
  left join core.autonomy_stat s on s.tenant_id = t.id and s.agent_kind = ak.code
                                and s.action_type = at2.code
  left join core.person gp on gp.id = g.granted_by
 where ak.is_active and at2.is_active;

drop view if exists app.v_escalation cascade;
create view app.v_escalation with (security_invoker = true) as
select e.id, e.tenant_id, e.kind, e.summary, e.status, e.created_at, e.closed_at,
       e.job_id, j.job_type, j.agent_kind, jt.title as job_title,
       e.to_person_id, p.full_name as to_person_name,
       round(extract(epoch from (now() - e.created_at)) / 60)::int as age_min
  from core.escalation e
  left join core.job j on j.id = e.job_id
  left join core.job_type jt on jt.code = j.job_type
  left join core.person p on p.id = e.to_person_id;

drop view if exists app.v_approval cascade;
create view app.v_approval with (security_invoker = true) as
select a.id, a.tenant_id, a.action_type, at2.title as action_title,
       a.proposal, a.rationale, a.confidence, a.status, a.expires_at,
       a.created_at, a.decided_at, a.edit_delta, a.reject_reason,
       a.job_id, j.agent_kind, jt.title as job_title,
       a.decided_by, p.full_name as decided_by_name,
       round(extract(epoch from (a.expires_at - now())) / 60)::int as minutes_left,
       (a.status = 'pending' and a.expires_at < now()) as overdue
  from core.approval a
  join core.action_type at2 on at2.code = a.action_type
  left join core.job j on j.id = a.job_id
  left join core.job_type jt on jt.code = j.job_type
  left join core.person p on p.id = a.decided_by;

-- ── Люди ─────────────────────────────────────────────────────────────────────

drop view if exists app.v_person cascade;
create view app.v_person with (security_invoker = true) as
select p.id, p.tenant_id, p.full_name, p.email, p.position, p.is_active,
       p.auth_user_id, p.tg_chat_id, p.tg_started_at, p.created_at,
       (p.tg_chat_id is not null and p.tg_started_at is not null) as tg_ready,
       coalesce((select array_agg(pr.role_code order by pr.role_code)
                   from core.person_role pr where pr.person_id = p.id), '{}') as roles,
       (select count(*) from core.action_log l
         where l.on_behalf_of = p.id and l.at >= now() - interval '30 days') as steps_month
  from core.person p;

-- ── Здоровье системы ─────────────────────────────────────────────────────────
-- Одна строка на экран администрирования. Каждая цифра отвечает на вопрос,
-- который иначе задают постфактум: «почему это не работало три дня».

drop view if exists app.v_system_health cascade;
create view app.v_system_health with (security_invoker = true) as
select
  -- Разделы журнала и расхода на месяцы вперёд. Кончились разделы — запись
  -- в журнал начнёт падать, а падение записи в журнал заметят последним.
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core' and c.relname like 'action_log_%'
      and c.relname >= 'action_log_' || to_char(current_date, 'YYYY"m"MM'))
                                                              as log_partitions_ahead,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core' and c.relname like 'usage_event_%'
      and c.relname >= 'usage_event_' || to_char(current_date, 'YYYY"m"MM'))
                                                              as usage_partitions_ahead,
  -- Таблицы с tenant_id без включённого RLS: должно быть 0 всегда.
  (select count(*) from pg_class c
    where c.relkind in ('r','p')
      and c.relnamespace::regnamespace::text in ('core','crm','dev','mem','acc','cms')
      and not exists (select 1 from pg_inherits i where i.inhrelid = c.oid)
      and exists (select 1 from pg_attribute a where a.attrelid = c.oid
                    and a.attname = 'tenant_id' and a.attnum > 0 and not a.attisdropped)
      and not c.relrowsecurity)                               as tables_without_rls,
  (select count(*) from pg_policies
    where schemaname in ('core','crm','dev','mem','acc','cms'))
                                                              as policies_total,
  (select count(*) from core.job where status = 'leased' and lease_until < now())
                                                              as leases_expired,
  (select round(extract(epoch from (now() - min(created_at))) / 60)::int
     from core.job where status in ('queued','failed'))       as oldest_wait_min,
  (select count(*) from core.job where status = 'dead'
     and finished_at >= now() - interval '7 days')            as jobs_dead_week,
  (select count(*) from core.escalation where status = 'open') as escalations_open,
  (select count(*) from core.approval where status = 'pending') as approvals_pending,
  (select count(*) from core.approval
    where status = 'pending' and expires_at < now())          as approvals_overdue,
  (select max(at) from core.action_log where actor_ref like 'pc:%')
                                                              as runner_last_seen,
  (select count(*) from core.action_log where at >= date_trunc('month', current_date))
                                                              as log_rows_month,
  (select count(*) from core.action_log
    where outcome = 'refused' and at >= now() - interval '7 days')
                                                              as refusals_week,
  (select count(*) from core.action_log
    where outcome = 'error' and at >= now() - interval '7 days')
                                                              as errors_week,
  (select count(*) from acc.entry where status = 'draft')     as acc_drafts,
  (select count(*) from cms.page where status = 'draft')      as cms_page_drafts,
  (select count(*) from cms.item where status = 'draft')      as cms_item_drafts,
  (select count(*) from dev.config_snapshot where stale)      as configs_stale,
  (select count(*) from dev.config_snapshot where indexed_at is null) as configs_unindexed;

-- ── Проводки документа ──────────────────────────────────────────────────────
-- Отдельной витриной, а не встроенной связью в запросе панели: связь проводки
-- со счётом составная (клиент + код счёта), а PostgREST умеет встраивать
-- только связи по одной колонке. Витрина решает это раз и навсегда.

drop view if exists app.v_posting cascade;
create view app.v_posting with (security_invoker = true) as
select p.id, p.tenant_id, p.entry_id, p.account_code, p.side, p.amount,
       p.company_id, p.ticket_id, p.note,
       a.title as account_title, a.kind as account_kind,
       c.title as company_title,
       e.status as entry_status, e.entry_date
  from acc.posting p
  join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
  join acc.entry e on e.id = p.entry_id
  left join crm.company c on c.id = p.company_id;

-- ── Живой пульс: один вызов на один опрос ────────────────────────────────────
-- p_since — метка предыдущего ответа: шаги отдаются только свежее неё, поэтому
-- сотый опрос не тащит те же двести строк заново.
--
-- ВАЖНО про запас в 15 секунд. Строка журнала получает `at` в момент НАЧАЛА
-- своей транзакции, а становится видимой при её фиксации — позже. Если опрос
-- попал между этими двумя моментами, то при честном условии at > p_since шаг
-- не покажется НИКОГДА: следующий опрос придёт с более поздней меткой.
-- Живая лента, молча теряющая шаги, хуже отсутствующей: по ней делают выводы.
-- Поэтому берём с перекрытием, а повторы отбрасывает панель по id — это дёшево,
-- в отличие от потерянного шага.

create or replace function public.ai_pulse(
  p_since timestamptz default null, p_steps int default 40
) returns jsonb
language plpgsql stable security invoker set search_path = core, crm, acc, app, public
as $$
declare v_limit int := least(greatest(coalesce(p_steps, 40), 1), 200);
        v_from  timestamptz := p_since - interval '15 seconds';
begin
  return jsonb_build_object(
    'at', now(),
    'agents', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.title) from app.v_agent_board b
       where b.is_active), '[]'::jsonb),
    'jobs', coalesce((
      select jsonb_object_agg(status, n) from (
        select status, count(*) as n from core.job group by status) s), '{}'::jsonb),
    'steps', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.at desc) from (
        select s.id, s.at, s.actor_kind, s.actor_ref, s.action_type, s.action_title,
               s.has_side_effect, s.target_system, s.target_ref, s.outcome,
               s.error_text, s.confidence, s.job_id, s.job_title, s.agent_kind,
               s.cost_usd, s.duration_ms, s.tokens_in, s.tokens_out
          from app.v_ai_step s
         where v_from is null or s.at > v_from
         order by s.at desc
         limit v_limit) x), '[]'::jsonb),
    'queue', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select q.id, q.job_type, q.job_title, q.agent_kind, q.agent_title, q.status,
               q.priority, q.attempts, q.next_attempt_at, q.lease_owner,
               q.lease_until, q.lease_expired, q.error_text, q.created_at
          from app.v_queue q
         where q.status in ('queued','leased','blocked','awaiting','failed')
         order by q.created_at desc
         limit 50) x), '[]'::jsonb),
    'spend', jsonb_build_object(
      'today_usd', coalesce((select sum(cost_usd) from core.usage_event
                              where at >= current_date), 0),
      'month_usd', coalesce((select sum(cost_usd) from core.usage_event
                              where at >= date_trunc('month', current_date)), 0),
      'jobs_month_usd', coalesce((select sum(cost_act_usd) from core.job
                                   where finished_at >= date_trunc('month', current_date)), 0)),
    'quotas', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.provider) from app.v_quota_state q), '[]'::jsonb),
    'escalations', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select e.id, e.kind, e.summary, e.age_min, e.job_id, e.job_title,
               e.to_person_name, e.created_at
          from app.v_escalation e where e.status = 'open'
         order by e.created_at desc limit 20) x), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.expires_at) from (
        select a.id, a.action_type, a.action_title, a.rationale, a.confidence,
               a.expires_at, a.minutes_left, a.overdue, a.job_id, a.job_title,
               a.proposal
          from app.v_approval a where a.status = 'pending'
         order by a.expires_at limit 20) x), '[]'::jsonb),
    'runner_last_seen', (select max(at) from core.action_log where actor_ref like 'pc:%')
  );
end $$;

revoke all on function public.ai_pulse(timestamptz, int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.ai_pulse(timestamptz, int) to authenticated';
  end if;
end $$;
grant execute on function public.ai_pulse(timestamptz, int) to jarvis_worker;

comment on function public.ai_pulse(timestamptz, int) is
  'Всё для живого экрана раздела ИИ за один вызов. p_since — отдавать только новые шаги.';

-- ── Обёртки для панели ───────────────────────────────────────────────────────
-- PostgREST зовёт функции только из схемы public, поэтому нужные вызовы
-- получают обёртки. Логика остаётся в своей схеме.

create or replace function public.acc_entry_post(p_entry bigint) returns bigint
language sql security invoker set search_path = public
as $$ select acc.entry_post(p_entry) $$;

create or replace function public.acc_entry_reverse(p_entry bigint, p_reason text)
returns bigint
language sql security invoker set search_path = public
as $$ select acc.entry_reverse(p_entry, p_reason) $$;

create or replace function public.acc_entry_void(p_entry bigint, p_reason text)
returns bigint
language sql security invoker set search_path = public
as $$ select acc.entry_void(p_entry, p_reason) $$;

create or replace function public.acc_expense_new(p jsonb) returns bigint
language sql security invoker set search_path = public
as $$ select acc.expense_new(p) $$;

create or replace function public.acc_invoice_from_time(p jsonb) returns bigint
language sql security invoker set search_path = public
as $$ select acc.invoice_from_time(p) $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.acc_entry_post(bigint)',
    'public.acc_entry_reverse(bigint, text)',
    'public.acc_entry_void(bigint, text)',
    'public.acc_expense_new(jsonb)',
    'public.acc_invoice_from_time(jsonb)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', fn);
    end if;
  end loop;
end $$;

-- ── Права на новые витрины ───────────────────────────────────────────────────

grant select on all tables in schema app to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on all tables in schema app to authenticated';
  end if;
end $$;
