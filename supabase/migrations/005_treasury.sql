-- 005. Казначей. Учёт по каждому клиенту отдельно — с первого дня, а не когда
-- прижмёт: иначе второй клиент выберет квоту первого, и узнаешь об этом от него.
-- Ставится ДО первого обращения к внешней службе.

create table core.provider (
  code         text primary key,
  title        text not null,
  unit         text not null,                 -- request | token | page | message
  global_limit numeric(14,3),
  period       text not null default 'month' check (period in ('day','month'))
);

create table core.quota (
  tenant_id   uuid not null references core.tenant(id),
  provider    text not null references core.provider(code),
  period      text not null check (period in ('day','month')),
  limit_units numeric(14,3) not null check (limit_units >= 0),
  soft_pct    smallint not null default 80 check (soft_pct between 10 and 100),
  primary key (tenant_id, provider, period)
);

create table core.usage_event (
  id        bigint generated always as identity,
  tenant_id uuid not null references core.tenant(id),
  provider  text not null references core.provider(code),
  at        timestamptz not null default now(),
  units     numeric(14,3) not null check (units >= 0),
  cost_usd  numeric(10,5) not null default 0,
  job_id    bigint references core.job(id),
  primary key (id, at)
) partition by range (at);

create or replace function core.usage_ensure_partitions(p_months int default 12)
returns int language plpgsql as $$
declare i int; d date; nm text; cnt int := 0;
begin
  for i in 0 .. p_months loop
    d  := (date_trunc('month', current_date) + make_interval(months => i))::date;
    nm := format('usage_event_%sm%s', to_char(d,'YYYY'), to_char(d,'MM'));
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'core' and c.relname = nm) then
      execute format(
        'create table core.%I partition of core.usage_event for values from (%L) to (%L)',
        nm, d, (d + interval '1 month')::date);
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end $$;

select core.usage_ensure_partitions(12);

-- Сводка поддерживается отдельно: считать сумму по разделу на каждый вопрос
-- «есть ли квота» слишком дорого при десятках тысяч событий.
create table core.usage_rollup (
  tenant_id      uuid not null references core.tenant(id),
  provider       text not null references core.provider(code),
  period         text not null,
  period_start   date not null,
  units          numeric(14,3) not null default 0,
  cost_usd       numeric(12,5) not null default 0,
  reserved_units numeric(14,3) not null default 0,
  primary key (tenant_id, provider, period, period_start)
);

-- Резервируем ДО вызова внешней службы. Проверить, а потом истратить — значит
-- перерасходовать при параллельной работе.
create or replace function core.quota_reserve(p_tenant uuid, p_provider text, p_units numeric)
returns boolean
language plpgsql security definer set search_path = core, public
as $$
declare v_period text; v_start date; v_limit numeric; v_used numeric; v_global numeric;
begin
  select period into v_period from core.provider where code = p_provider;
  if v_period is null then return false; end if;

  v_start := case when v_period = 'day' then current_date
                  else date_trunc('month', current_date)::date end;

  select limit_units into v_limit from core.quota
   where tenant_id = p_tenant and provider = p_provider and period = v_period;
  if v_limit is null then
    return false;   -- квота не задана значит нельзя: по умолчанию запрещено
  end if;

  insert into core.usage_rollup (tenant_id, provider, period, period_start)
       values (p_tenant, p_provider, v_period, v_start)
  on conflict do nothing;

  -- Блокируем строку клиента: два параллельных агента не пройдут оба.
  select units + reserved_units into v_used from core.usage_rollup
   where tenant_id = p_tenant and provider = p_provider
     and period = v_period and period_start = v_start
     for update;

  if v_used + p_units > v_limit then return false; end if;

  -- Общий предел службы проверяется вторым, после клиентского.
  select global_limit into v_global from core.provider where code = p_provider;
  if v_global is not null then
    if (select coalesce(sum(units + reserved_units),0) from core.usage_rollup
         where provider = p_provider and period = v_period
           and period_start = v_start) + p_units > v_global then
      return false;
    end if;
  end if;

  update core.usage_rollup set reserved_units = reserved_units + p_units
   where tenant_id = p_tenant and provider = p_provider
     and period = v_period and period_start = v_start;
  return true;
end $$;

create or replace function core.quota_commit(
  p_tenant uuid, p_provider text, p_units numeric,
  p_cost numeric default 0, p_job_id bigint default null
) returns void
language plpgsql security definer set search_path = core, public
as $$
declare v_period text; v_start date;
begin
  select period into v_period from core.provider where code = p_provider;
  v_start := case when v_period = 'day' then current_date
                  else date_trunc('month', current_date)::date end;

  insert into core.usage_event (tenant_id, provider, units, cost_usd, job_id)
       values (p_tenant, p_provider, p_units, coalesce(p_cost,0), p_job_id);

  update core.usage_rollup
     set units = units + p_units,
         cost_usd = cost_usd + coalesce(p_cost,0),
         reserved_units = greatest(reserved_units - p_units, 0)
   where tenant_id = p_tenant and provider = p_provider
     and period = v_period and period_start = v_start;
end $$;

create or replace function core.quota_release(p_tenant uuid, p_provider text, p_units numeric)
returns void
language plpgsql security definer set search_path = core, public
as $$
declare v_period text; v_start date;
begin
  select period into v_period from core.provider where code = p_provider;
  v_start := case when v_period = 'day' then current_date
                  else date_trunc('month', current_date)::date end;
  update core.usage_rollup set reserved_units = greatest(reserved_units - p_units, 0)
   where tenant_id = p_tenant and provider = p_provider
     and period = v_period and period_start = v_start;
end $$;

-- Незакрытые резервы — то же «висящее состояние», что и брошенная аренда.
create or replace function core.quota_reap() returns int
language sql security definer set search_path = core, public
as $$
  with fixed as (
    update core.usage_rollup r set reserved_units = 0
     where r.reserved_units > 0
       and not exists (select 1 from core.job j
                        where j.tenant_id = r.tenant_id and j.status = 'leased'
                          and j.updated_at > now() - interval '1 hour')
    returning 1
  ) select count(*)::int from fixed;
$$;

-- Пределы частоты: суточный предел оповещений и предел создания заданий.
create table core.rate_bucket (
  tenant_id    uuid not null references core.tenant(id),
  scope        text not null,                -- 'job:dev.impact' | 'tg:notify'
  window_kind  text not null check (window_kind in ('hour','day')),
  window_start timestamptz not null,
  used         int not null default 0,
  limit_units  int not null,
  primary key (tenant_id, scope, window_kind, window_start)
);

create or replace function core.rate_take(
  p_tenant uuid, p_scope text, p_kind text, p_limit int, p_units int default 1
) returns boolean
language plpgsql security definer set search_path = core, public
as $$
declare v_start timestamptz; v_used int;
begin
  v_start := date_trunc(case when p_kind = 'day' then 'day' else 'hour' end, now());

  insert into core.rate_bucket (tenant_id, scope, window_kind, window_start, limit_units)
       values (p_tenant, p_scope, p_kind, v_start, p_limit)
  on conflict do nothing;

  select used into v_used from core.rate_bucket
   where tenant_id = p_tenant and scope = p_scope
     and window_kind = p_kind and window_start = v_start for update;

  if v_used + p_units > p_limit then return false; end if;

  update core.rate_bucket set used = used + p_units
   where tenant_id = p_tenant and scope = p_scope
     and window_kind = p_kind and window_start = v_start;
  return true;
end $$;

-- Самопроверка: замер без сохранённой выборки ничего не доказывает.
create table core.quality_check (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references core.tenant(id),
  metric      text not null,
  sample_size int not null,
  value       numeric(8,3) not null,
  norm        numeric(8,3) not null,
  passed      boolean generated always as (value >= norm) stored,
  sample_ref  jsonb not null default '[]'::jsonb,
  note        text,
  checked_at  timestamptz not null default now()
);
