-- 006. Заявки, компании, время, документы.
-- Таблицы doc и payment создаются сейчас, экраны к ним — в октябре:
-- менять схему потом дороже, чем создать пустые таблицы сегодня.

create table crm.company (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references core.tenant(id),
  title       text not null,
  bin         text,
  address     text,
  bank_name   text,
  bank_iban   text,
  bank_bic    text,
  domains     text[] not null default '{}',   -- опознание клиента по адресу почты
  phones      text[] not null default '{}',
  hourly_rate numeric(10,2),
  status      text not null default 'lead'
              check (status in ('lead','active','support','archived')),
  note        text,
  created_at  timestamptz not null default now()
);

create index company_domains_idx on crm.company using gin (domains);

create table crm.contact (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references core.tenant(id),
  company_id    uuid references crm.company(id) on delete set null,
  full_name     text not null,
  email         text,
  phone         text,
  tg_chat_id    bigint,
  tg_started_at timestamptz,
  role_note     text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);

create table crm.ticket (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references core.tenant(id),
  company_id      uuid references crm.company(id),
  contact_id      uuid references crm.contact(id),

  channel         text not null check (channel in ('site','email','telegram','phone','manual')),
  external_ref    text,
  subject         text not null,
  body            text not null,

  kind            text check (kind in ('bug','feature','consult','update','integration','other')),
  system          text,
  priority        smallint not null default 5 check (priority between 1 and 9),
  status          text not null default 'new' check (status in
                    ('new','triaged','estimated','approved','in_work','done','cancelled')),

  kind_confidence numeric(4,3),
  dedupe_key      text,
  received_at     timestamptz,               -- когда пришло письмо, для критерия С-2
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index ticket_dedupe_idx on crm.ticket (tenant_id, dedupe_key)
  where dedupe_key is not null;
create index ticket_status_idx on crm.ticket (tenant_id, status, priority);
create index ticket_company_idx on crm.ticket (tenant_id, company_id, created_at desc);

create table crm.ticket_message (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references core.tenant(id),
  ticket_id bigint not null references crm.ticket(id) on delete cascade,
  author    text not null,                   -- client | me | agent:<kind>
  body      text not null,
  at        timestamptz not null default now()
);

create index ticket_message_idx on crm.ticket_message (ticket_id, at);

create table crm.estimate (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references core.tenant(id),
  ticket_id     bigint not null references crm.ticket(id) on delete cascade,
  hours_min     numeric(6,2) not null,
  hours_max     numeric(6,2) not null check (hours_max >= hours_min),
  rate          numeric(10,2) not null,
  price         numeric(12,2) not null,
  confidence    numeric(4,3) not null,
  rationale     text not null,
  basis_tickets bigint[] not null default '{}',
  status        text not null default 'draft'
                check (status in ('draft','accepted','edited','rejected')),
  decided_by    uuid references core.person(id),
  decided_at    timestamptz,
  -- Заполняется по закрытии заявки. Это и есть обучающая выборка для
  -- следующей оценки: правильные примеры в контексте вместо дообучения.
  hours_fact    numeric(6,2),
  created_at    timestamptz not null default now()
);

create table crm.time_entry (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references core.tenant(id),
  ticket_id   bigint not null references crm.ticket(id),
  person_id   uuid not null references core.person(id),
  started_at  timestamptz not null default now(),
  minutes     int not null check (minutes > 0 and minutes <= 720),
  note        text,
  billable    boolean not null default true,
  invoiced_in bigint
);

create index time_entry_ticket_idx on crm.time_entry (ticket_id);
create index time_entry_month_idx on crm.time_entry (tenant_id, started_at);

create table crm.doc (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references core.tenant(id),
  company_id uuid not null references crm.company(id),
  kind       text not null check (kind in ('contract','invoice','act')),
  number     text not null,
  issued_on  date not null default current_date,
  due_on     date,
  amount     numeric(12,2) not null,
  currency   text not null default 'KZT',
  status     text not null default 'draft' check (status in
               ('draft','issued','paid','partly_paid','overdue','cancelled')),
  file_path  text,
  ticket_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (tenant_id, kind, number)
);

alter table crm.time_entry
  add constraint time_entry_doc_fk foreign key (invoiced_in) references crm.doc(id);

create table crm.payment (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references core.tenant(id),
  doc_id     bigint references crm.doc(id),
  company_id uuid not null references crm.company(id),
  paid_on    date not null default current_date,
  amount     numeric(12,2) not null check (amount > 0),
  source     text not null default 'manual' check (source in ('manual','bank_statement')),
  note       text
);

-- ── З-А. Счёт не выставляется на ноль ────────────────────────────────────────
create or replace function crm.g_invoice_not_zero() returns trigger
language plpgsql as $$
begin
  if new.kind = 'invoice' and new.status <> 'draft' and coalesce(new.amount,0) <= 0 then
    raise exception 'счёт % на нулевую сумму выставить нельзя', new.number;
  end if;
  return new;
end $$;

create trigger doc_ga before insert or update on crm.doc
  for each row execute function crm.g_invoice_not_zero();

-- ── З-Б. Час не попадает в два счёта ─────────────────────────────────────────
-- Двойное выставление невозможно по схеме (invoiced_in — одна колонка);
-- триггер запрещает молча перебить уже проставленную ссылку.
create or replace function crm.g_hour_once() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.invoiced_in is not null
     and new.invoiced_in is distinct from old.invoiced_in then
    raise exception 'час % уже выставлен в счёте %', old.id, old.invoiced_in;
  end if;
  return new;
end $$;

create trigger time_entry_gb before update on crm.time_entry
  for each row execute function crm.g_hour_once();

-- ── З-В. Просрочка считается базой, а не ставится руками ─────────────────────
create or replace function crm.mark_overdue() returns int
language sql security definer set search_path = crm, public
as $$
  with moved as (
    update crm.doc d set status = 'overdue'
     where d.kind = 'invoice' and d.status in ('issued','partly_paid')
       and d.due_on is not null and d.due_on < current_date
       and coalesce((select sum(p.amount) from crm.payment p where p.doc_id = d.id), 0) < d.amount
    returning 1
  ) select count(*)::int from moved;
$$;

-- ── З-Д. Оценка не принимается сама ──────────────────────────────────────────
create or replace function crm.g_estimate_human() returns trigger
language plpgsql as $$
begin
  if new.status in ('accepted','edited') and new.decided_by is null then
    raise exception 'оценка принимается только человеком: decided_by обязателен';
  end if;
  if new.status in ('accepted','edited','rejected') and new.decided_at is null then
    new.decided_at := now();
  end if;
  return new;
end $$;

create trigger estimate_gd before insert or update on crm.estimate
  for each row execute function crm.g_estimate_human();

-- Отметка времени изменения заявки
create or replace function crm.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger ticket_touch before update on crm.ticket
  for each row execute function crm.touch_updated_at();
