-- 001. Схемы, роли, клиенты, люди, реестры.
-- Без клиента не существует ни одной другой строки, поэтому это первая миграция.

create extension if not exists pgcrypto;

create schema if not exists core;   -- ядро: клиенты, очередь, права, журнал, учёт
create schema if not exists crm;    -- заявки, компании, время, документы
create schema if not exists dev;    -- конфигурации 1С и отчёты агентов
create schema if not exists mem;    -- память (заполняется позже)

-- Роль для агентов n8n. Работает под RLS и обязана объявлять клиента:
--   set local app.tenant_id = '...';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'jarvis_worker') then
    create role jarvis_worker nologin;
  end if;
end $$;

grant usage on schema core, crm, dev, mem to jarvis_worker;

create table core.tenant (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  title      text not null,
  status     text not null default 'active'
             check (status in ('trial','active','suspended','retired')),
  tz         text not null default 'Asia/Almaty',
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create table core.person (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references core.tenant(id),
  auth_user_id  uuid,                       -- связь с auth.users Supabase
  full_name     text not null,
  email         text,
  tg_chat_id    bigint,
  -- Бот не может написать первым: «есть chat_id» и «нам разрешено писать» —
  -- два разных факта, и второй проверяется на приёмке (критерий С-8).
  tg_started_at timestamptz,
  position      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (tenant_id, auth_user_id)
);

create table core.role (
  code  text primary key,
  title text not null
);

create table core.person_role (
  tenant_id uuid not null references core.tenant(id),
  person_id uuid not null references core.person(id) on delete cascade,
  role_code text not null references core.role(code),
  primary key (person_id, role_code)
);

-- Реестры вместо enum: добавить тип — это insert, а не миграция с alter type.
create table core.agent_kind (
  code         text primary key,
  title        text not null,
  is_active    boolean not null default true,
  max_parallel smallint not null default 1 check (max_parallel between 1 and 32)
);

create table core.job_type (
  code             text primary key,
  agent_kind       text not null references core.agent_kind(code),
  title            text not null,
  max_attempts     smallint not null default 3 check (max_attempts between 1 and 10),
  backoff_base_sec int not null default 60 check (backoff_base_sec >= 5),
  -- Жёсткий предел сверху: даже если агент запросит больше, база не даст
  -- заданию висеть дольше шести часов.
  lease_sec        int not null default 900 check (lease_sec between 30 and 21600),
  est_cost_usd     numeric(10,5) not null default 0,
  requires_payload boolean not null default false,
  is_active        boolean not null default true
);

create table core.action_type (
  code               text primary key,
  title              text not null,
  target_system      text not null,
  has_side_effect    boolean not null default true,
  min_confidence     numeric(4,3) not null default 0.900
                     check (min_confidence between 0 and 1),
  autonomy_threshold int not null default 100 check (autonomy_threshold >= 20),
  is_active          boolean not null default true
);

-- Единственный способ узнать «чей это запрос». Используется во всех политиках.
-- Для вошедшего в админку — по core.person, для агента n8n — по объявлению.
create or replace function core.my_tenant() returns uuid
language sql stable security definer set search_path = core, public
as $$
  select coalesce(
    (select p.tenant_id from core.person p
      where p.auth_user_id = auth.uid() and p.is_active limit 1),
    nullif(current_setting('app.tenant_id', true), '')::uuid
  );
$$;

comment on function core.my_tenant() is
  'Клиент текущего запроса: по вошедшему пользователю либо по app.tenant_id у агента.';
