-- 011. Витрины для админки. Все с security_invoker: политики RLS применяются
-- к вошедшему пользователю, а не к владельцу представления.
-- Собираются одной миграцией целиком: drop view сносит зависимые каскадом,
-- поэтому порядок пересоздания должен восстанавливаться из истории.

create schema if not exists app;
grant usage on schema app to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema app to authenticated';
  end if;
end $$;

drop view if exists app.v_ticket_list cascade;
create view app.v_ticket_list with (security_invoker = true) as
select t.id, t.tenant_id, t.subject, t.kind, t.system, t.status, t.priority,
       t.channel, t.created_at, t.updated_at, t.received_at, t.kind_confidence,
       t.company_id, c.title as company_title, c.status as company_status,
       coalesce(c.hourly_rate, 10000) as hourly_rate,
       e.hours_min, e.hours_max, e.price, e.status as estimate_status,
       coalesce((select sum(te.minutes) from crm.time_entry te
                  where te.ticket_id = t.id), 0) / 60.0 as hours_spent
  from crm.ticket t
  left join crm.company c on c.id = t.company_id
  left join lateral (
       select * from crm.estimate x where x.ticket_id = t.id
        order by x.created_at desc limit 1) e on true;

drop view if exists app.v_overview cascade;
create view app.v_overview with (security_invoker = true) as
select
  (select count(*) from crm.ticket
    where status in ('new','triaged','estimated','approved','in_work')) as tickets_open,
  (select count(*) from crm.ticket
    where status = 'new' and created_at >= current_date) as tickets_today,
  (select count(*) from crm.ticket
    where status in ('new','triaged') and updated_at < now() - interval '2 days')
                                                                        as tickets_stuck,
  (select coalesce(sum(minutes), 0) / 60.0 from crm.time_entry
    where started_at >= date_trunc('month', current_date))              as hours_month,
  (select count(*) from core.job where status in ('queued','failed'))   as jobs_waiting,
  (select count(*) from core.job where status = 'leased')               as jobs_running,
  (select count(*) from core.job where status = 'dead'
     and finished_at >= now() - interval '7 days')                      as jobs_dead_week,
  (select count(*) from core.escalation where status = 'open')          as escalations_open,
  (select coalesce(sum(cost_usd), 0) from core.usage_rollup
    where period_start = date_trunc('month', current_date)::date)       as cost_month_usd,
  (select count(*) from dev.config_snapshot where stale)                as configs_stale,
  (select count(*) from dev.config_snapshot where indexed_at is not null) as configs_ready;

drop view if exists app.v_queue cascade;
create view app.v_queue with (security_invoker = true) as
select j.id, j.tenant_id, j.job_type, j.agent_kind, j.status, j.priority,
       j.attempts, j.next_attempt_at, j.lease_owner, j.lease_until,
       j.error_text, j.cost_act_usd, j.created_at, j.finished_at,
       jt.title as job_title, ak.title as agent_title,
       (j.status = 'leased' and j.lease_until < now()) as lease_expired
  from core.job j
  join core.job_type jt on jt.code = j.job_type
  join core.agent_kind ak on ak.code = j.agent_kind;

drop view if exists app.v_estimate_quality cascade;
create view app.v_estimate_quality with (security_invoker = true) as
select count(*) filter (where hours_fact is not null) as measured,
       round((percentile_cont(0.5) within group (order by
         abs((hours_min + hours_max) / 2 - hours_fact)
         / nullif(hours_fact, 0) * 100))::numeric, 1) as median_error_pct,
       round(100.0 * count(*) filter (where hours_fact between hours_min and hours_max)
             / nullif(count(*) filter (where hours_fact is not null), 0), 1) as hit_pct
  from crm.estimate where hours_fact is not null;

drop view if exists app.v_config_health cascade;
create view app.v_config_health with (security_invoker = true) as
select s.id, s.tenant_id, s.company_id, c.title as company_title, s.title,
       s.cfg_name, s.cfg_version, s.app_mode, s.modules_loc,
       s.objects_total, s.objects_custom, s.has_binforms,
       s.indexed_at, s.stale, s.src_path, s.db_path,
       round(100.0 * s.objects_custom / nullif(s.objects_total, 0), 1) as custom_pct,
       (select count(*) from dev.report r where r.snapshot_id = s.id) as reports_count,
       (select max(r.created_at) from dev.report r where r.snapshot_id = s.id) as last_report_at
  from dev.config_snapshot s
  join crm.company c on c.id = s.company_id;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on all tables in schema app to authenticated';
  end if;
end $$;
grant select on all tables in schema app to jarvis_worker;
