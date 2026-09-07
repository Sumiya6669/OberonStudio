-- 002. Очередь заданий. Центральная таблица ядра: всё асинхронное идёт через неё.
-- Очередь не означает «по одному»: for update skip locked существует ровно для
-- того, чтобы N агентов тянули задания одновременно и не подрались.

create table core.job (
  id               bigint generated always as identity primary key,
  tenant_id        uuid not null references core.tenant(id),
  job_type         text not null references core.job_type(code),
  agent_kind       text not null references core.agent_kind(code),

  status           text not null default 'queued' check (status in (
                     'queued',      -- ждёт исполнителя
                     'leased',      -- взято агентом, аренда идёт
                     'blocked',     -- упёрлось в квоту или в отсутствие права
                     'awaiting',    -- ждёт подтверждения человека или детей
                     'done',        -- выполнено и отдало данные
                     'done_empty',  -- выполнено, данных нет
                     'failed',      -- попытка не удалась, ЖДЁТ ПОВТОРА
                     'dead',        -- попытки исчерпаны
                     'cancelled'
                   )),

  priority         smallint not null default 5 check (priority between 1 and 9),
  payload          jsonb not null default '{}'::jsonb,
  result           jsonb,
  error_text       text,

  dedupe_key       text,
  attempts         smallint not null default 0,
  next_attempt_at  timestamptz not null default now(),

  lease_owner      text,
  lease_until      timestamptz,

  parent_job_id    bigint references core.job(id),
  depth            smallint not null default 0 check (depth between 0 and 8),
  plan_id          bigint,
  correlation_id   uuid not null default gen_random_uuid(),
  requested_by     text not null default 'dispatcher',

  cost_est_usd     numeric(10,5) not null default 0,
  cost_act_usd     numeric(10,5) not null default 0,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz
);

-- Единственный горячий индекс. failed входит: задание после отказа ждёт повтора
-- и должно быть взято снова, иначе повторов не будет никогда.
create index job_pick_idx on core.job (agent_kind, priority, next_attempt_at)
  where status in ('queued','failed');

-- Идемпотентность действует только среди живых заданий: завершённое не мешает
-- поставить такое же завтра.
create unique index job_dedupe_idx on core.job (tenant_id, job_type, dedupe_key)
  where dedupe_key is not null
    and status in ('queued','leased','blocked','awaiting','failed');

create index job_lease_idx on core.job (lease_until) where status = 'leased';
create index job_tenant_time_idx on core.job (tenant_id, created_at desc);

-- ── Захват ───────────────────────────────────────────────────────────────────
create or replace function core.job_claim(
  p_agent_kind text,
  p_worker     text,
  p_limit      int default 1
) returns setof core.job
language plpgsql security definer set search_path = core, public
as $$
declare
  v_tenant uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_max    smallint;
  v_busy   int;
begin
  if v_tenant is null then
    raise exception 'app.tenant_id не объявлен: захват заданий запрещён';
  end if;

  -- Предел одновременности: объявлен в реестре и здесь же соблюдается.
  select max_parallel into v_max from core.agent_kind where code = p_agent_kind;
  if v_max is null then
    raise exception 'неизвестный вид агента: %', p_agent_kind;
  end if;

  select count(*) into v_busy from core.job
   where agent_kind = p_agent_kind and status = 'leased' and tenant_id = v_tenant;

  p_limit := least(p_limit, greatest(v_max - v_busy, 0));
  if p_limit = 0 then
    return;
  end if;

  return query
  with picked as (
    select j.id, jt.lease_sec
      from core.job j
      join core.job_type jt on jt.code = j.job_type
     where j.status in ('queued','failed')
       and j.agent_kind = p_agent_kind
       and j.tenant_id = v_tenant
       and j.next_attempt_at <= now()
       and jt.is_active
     order by j.priority, j.next_attempt_at
     limit p_limit
     for update of j skip locked
  )
  update core.job j
     set status      = 'leased',
         attempts    = j.attempts + 1,
         lease_owner = p_worker,
         lease_until = now() + make_interval(secs => p.lease_sec),
         started_at  = coalesce(j.started_at, now()),
         updated_at  = now()
    from picked p
   where j.id = p.id
  returning j.*;
end $$;

-- ── Завершение ───────────────────────────────────────────────────────────────
create or replace function core.job_finish(
  p_job_id   bigint,
  p_result   jsonb,
  p_cost_usd numeric default 0
) returns text
language plpgsql security definer set search_path = core, public
as $$
declare v_status text;
begin
  update core.job
     set status       = 'done',          -- триггер ниже понизит до done_empty
         result       = p_result,
         cost_act_usd = cost_act_usd + coalesce(p_cost_usd, 0),
         finished_at  = now(),
         updated_at   = now(),
         lease_owner  = null,
         lease_until  = null
   where id = p_job_id and status = 'leased'
  returning status into v_status;

  if v_status is null then
    -- Аренда истекла и сборщик уже вернул задание в очередь: отчёт отклоняем.
    -- Отказ должен быть громким, иначе работа теряется молча.
    raise exception 'задание % не находится в состоянии leased', p_job_id;
  end if;
  return v_status;
end $$;

-- ── Отказ и повтор ───────────────────────────────────────────────────────────
create or replace function core.job_fail(p_job_id bigint, p_error text)
returns text
language plpgsql security definer set search_path = core, public
as $$
declare v_attempts smallint; v_max smallint; v_base int; v_status text;
begin
  select j.attempts, jt.max_attempts, jt.backoff_base_sec
    into v_attempts, v_max, v_base
    from core.job j join core.job_type jt on jt.code = j.job_type
   where j.id = p_job_id for update;

  if v_attempts is null then
    raise exception 'задание % не найдено', p_job_id;
  end if;

  v_status := case when v_attempts >= v_max then 'dead' else 'failed' end;

  update core.job
     set status = v_status,
         error_text = left(coalesce(p_error, ''), 4000),
         -- Отсрочка удваивается с каждой попыткой, с разбросом до 25 %,
         -- чтобы сотня заданий не пошла на повтор одной секундой.
         next_attempt_at = now() + make_interval(secs =>
             (v_base * power(2, v_attempts) * (1 + random() * 0.25))::int),
         finished_at = case when v_status = 'dead' then now() end,
         lease_owner = null, lease_until = null, updated_at = now()
   where id = p_job_id;

  return v_status;
end $$;

-- ── Сборщик брошенных аренд ──────────────────────────────────────────────────
-- Любое состояние «идёт» обязано иметь сборщика, иначе оно повиснет на недели.
create or replace function core.job_reap() returns int
language sql security definer set search_path = core, public
as $$
  with expired as (
    update core.job j
       set status = case when j.attempts >= jt.max_attempts then 'dead' else 'queued' end,
           error_text = 'аренда истекла: агент не отчитался до ' || j.lease_until,
           lease_owner = null, lease_until = null,
           next_attempt_at = now() + make_interval(secs => jt.backoff_base_sec),
           updated_at = now()
      from core.job_type jt
     where jt.code = j.job_type
       and j.status = 'leased'
       and j.lease_until < now()
    returning 1
  ) select count(*)::int from expired;
$$;

-- ── З-1. Успех обязан отдать данные ──────────────────────────────────────────
-- Сценарий сбора может 148 раз отчитаться «успешно», собрав ноль строк.
create or replace function core.g_done_requires_payload() returns trigger
language plpgsql as $$
declare v_req boolean;
begin
  if new.status = 'done' then
    select requires_payload into v_req from core.job_type where code = new.job_type;
    if v_req and coalesce((new.result->>'items_count')::int, 0) = 0 then
      new.status := 'done_empty';
    end if;
  end if;
  return new;
end $$;

-- before insert or update: агент сначала пишет запуск, потом дописывает подробности
create trigger job_g1 before insert or update on core.job
  for each row execute function core.g_done_requires_payload();

-- ── З-7. Глубина ставится базой, а не сценарием ──────────────────────────────
create or replace function core.g_depth() returns trigger
language plpgsql as $$
begin
  if new.parent_job_id is not null then
    select depth + 1 into new.depth from core.job where id = new.parent_job_id;
  end if;
  return new;
end $$;

create trigger job_g7 before insert on core.job
  for each row execute function core.g_depth();

-- ── Веерная сборка: последний закончивший ребёнок будит родителя ─────────────
create or replace function core.g_gather() returns trigger
language plpgsql as $$
begin
  if new.parent_job_id is not null
     and new.status in ('done','done_empty','dead','cancelled')
     and not exists (select 1 from core.job s
                      where s.parent_job_id = new.parent_job_id
                        and s.status not in ('done','done_empty','dead','cancelled'))
  then
    update core.job set status = 'queued', next_attempt_at = now(), updated_at = now()
     where id = new.parent_job_id and status = 'awaiting';
  end if;
  return new;
end $$;

create trigger job_gather after update on core.job
  for each row execute function core.g_gather();
