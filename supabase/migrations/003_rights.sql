-- 003. Права. По умолчанию запрещено: отсутствие записи равно deny.
-- Явная строка deny нужна только чтобы отозвать выданное право, сохранив след.

create table core."grant" (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references core.tenant(id),
  agent_kind  text not null references core.agent_kind(code),
  action_type text not null references core.action_type(code),
  mode        text not null check (mode in ('deny','propose','auto')),
  -- Ограничители, за которые агент не выходит даже в режиме auto:
  -- {"max_amount_kzt": 1000000, "paths": ["_index","_reports"]}
  limits      jsonb not null default '{}'::jsonb,
  granted_by  uuid not null references core.person(id),
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  note        text
);

create unique index grant_live_idx
  on core."grant" (tenant_id, agent_kind, action_type)
  where revoked_at is null;

create or replace function core.grant_mode(p_tenant uuid, p_agent text, p_action text)
returns text
language sql stable security definer set search_path = core, public
as $$
  select coalesce(
    (select g.mode from core."grant" g
      where g.tenant_id = p_tenant and g.agent_kind = p_agent
        and g.action_type = p_action and g.revoked_at is null),
    'deny');
$$;

-- ── Правило двух ключей ──────────────────────────────────────────────────────
create table core.approval (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references core.tenant(id),
  job_id        bigint not null references core.job(id),
  action_type   text not null references core.action_type(code),
  proposal      jsonb not null,
  rationale     text not null,
  confidence    numeric(4,3) not null check (confidence between 0 and 1),
  status        text not null default 'pending' check (status in
                  ('pending','approved','approved_edited','rejected','expired')),
  expires_at    timestamptz not null,
  decided_by    uuid references core.person(id),
  decided_at    timestamptz,
  -- Не украшение, а измерительный прибор: подтверждение без правок и с правкой
  -- означают разное качество, и только по первым считается право на автономию.
  edit_delta    jsonb,
  reject_reason text,
  created_at    timestamptz not null default now()
);

create index approval_pending_idx on core.approval (tenant_id, expires_at)
  where status = 'pending';

create table core.autonomy_stat (
  tenant_id        uuid not null references core.tenant(id),
  agent_kind       text not null references core.agent_kind(code),
  action_type      text not null references core.action_type(code),
  streak_clean     int not null default 0,
  total_approved   int not null default 0,
  total_edited     int not null default 0,
  total_rejected   int not null default 0,
  last_reset_at    timestamptz,
  last_reset_cause text,
  primary key (tenant_id, agent_kind, action_type)
);

create table core.escalation (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references core.tenant(id),
  job_id       bigint references core.job(id),
  kind         text not null check (kind in
                 ('no_permission','low_confidence','budget','conflict',
                  'external_error','stale_index','unknown')),
  summary      text not null,
  to_person_id uuid references core.person(id),
  status       text not null default 'open' check (status in ('open','taken','closed')),
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);

-- Молчание человека — не разрешение: истёкшее подтверждение закрывается само.
create or replace function core.approval_reap() returns int
language sql security definer set search_path = core, public
as $$
  with expired as (
    update core.approval set status = 'expired', decided_at = now()
     where status = 'pending' and expires_at < now()
    returning job_id
  ), cancelled as (
    update core.job set status = 'cancelled', updated_at = now(), finished_at = now()
     where id in (select job_id from expired) and status = 'awaiting'
    returning 1
  ) select count(*)::int from expired;
$$;
