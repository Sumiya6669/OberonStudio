-- 004. Журнал действий. По любому действию восстанавливается: кто, что, когда,
-- по чьей команде, с каким итогом и сколько это стоило.
-- Ставится ДО первого действия с побочным эффектом, иначе будет действие без следа.

create table core.action_log (
  id            bigint generated always as identity,
  tenant_id     uuid not null references core.tenant(id),
  at            timestamptz not null default now(),

  actor_kind    text not null check (actor_kind in ('agent','person','dispatcher','system')),
  actor_ref     text not null,                     -- 'agent:dev_1c' | 'person:<uuid>'
  on_behalf_of  uuid references core.person(id),

  action_type   text not null references core.action_type(code),
  target_system text not null,
  target_ref    text,

  -- В params кладём только то, что безопасно хранить; в params_digest — хеш
  -- полного набора. Так видно, что исполнено ровно то, что подтверждено,
  -- без хранения содержимого документов и кода клиента.
  params        jsonb,
  params_digest text not null,
  outcome       text not null check (outcome in ('ok','error','refused','escalated','partial')),
  error_text    text,

  confidence    numeric(4,3),
  job_id        bigint references core.job(id),
  approval_id   bigint references core.approval(id),

  tokens_in     int,
  tokens_out    int,
  cost_usd      numeric(10,5) not null default 0,
  duration_ms   int,

  primary key (id, at)
) partition by range (at);

create index action_log_tenant_idx on core.action_log (tenant_id, at desc);
create index action_log_target_idx on core.action_log (tenant_id, target_system, target_ref);

-- Разделы на год вперёд создаются функцией, а не руками.
create or replace function core.action_log_ensure_partitions(p_months int default 12)
returns int language plpgsql as $$
declare i int; d date; nm text; cnt int := 0;
begin
  for i in 0 .. p_months loop
    d  := (date_trunc('month', current_date) + make_interval(months => i))::date;
    nm := format('action_log_%sm%s', to_char(d,'YYYY'), to_char(d,'MM'));
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'core' and c.relname = nm) then
      execute format(
        'create table core.%I partition of core.action_log for values from (%L) to (%L)',
        nm, d, (d + interval '1 month')::date);
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end $$;

select core.action_log_ensure_partitions(12);

-- Журнал только дописывается. Это запрет базы, а не соглашение.
create or replace function core.deny_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'core.action_log только дописывается: % запрещён', tg_op;
end $$;

create trigger action_log_no_update before update or delete on core.action_log
  for each row execute function core.deny_mutation();

revoke update, delete, truncate on core.action_log from jarvis_worker;

-- Удобная запись из агентов: дайджест считает база, а не сценарий.
create or replace function core.log_action(
  p_actor_kind text, p_actor_ref text, p_action_type text,
  p_target_system text, p_target_ref text, p_params jsonb,
  p_outcome text, p_job_id bigint default null,
  p_cost_usd numeric default 0, p_error text default null
) returns bigint
language plpgsql security definer set search_path = core, public
as $$
declare v_id bigint;
begin
  insert into core.action_log (tenant_id, actor_kind, actor_ref, action_type,
         target_system, target_ref, params, params_digest, outcome, job_id,
         cost_usd, error_text)
  values (core.my_tenant(), p_actor_kind, p_actor_ref, p_action_type,
          p_target_system, p_target_ref, p_params,
          encode(digest(coalesce(p_params::text,''), 'sha256'), 'hex'),
          p_outcome, p_job_id, coalesce(p_cost_usd,0), p_error)
  returning id into v_id;
  return v_id;
end $$;
