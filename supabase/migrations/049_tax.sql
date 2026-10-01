-- 049. Налоговый учёт ИП на упрощёнке — слой поверх документов и оплат CRM.
--
-- 014 честно говорит: «это НЕ налоговый учёт». Эта миграция добавляет именно его,
-- но не дублирует деньги: счета, акты и оплаты остаются в crm.doc и crm.payment.
-- Здесь только то, чего налоговому учёту не хватает:
--   профиль ИП (режим, ставка маслихата, ОКЭД, счёт Kaspi Pay);
--   у акта — дата подписания: это дата дохода (НК ст. 725 п. 4) и начало
--     15 дней на ЭСФ (НК ст. 209 п. 7), а также номер ЭСФ, когда его выписали;
--   строки документов — для акта Р-1 и счёта;
--   вид покупателя (ТОО / ИП / физлицо) — от него зависит, нужен ли ЭСФ;
--   строки банковских выписок с классом «доход / не доход» и защитой от дублей.
--
-- Считает и решает Python-бухгалтер (Products for AI Tinker / ИИ-бухгалтер):
-- нормы меняются чаще, чем схема, и у каждой есть тест. База хранит и не даёт
-- испортить: проводит и подтверждает человек, агент только предлагает.
--
-- ДО ПРИМЕНЕНИЯ: прогнать на копии базы (хостинг в РК, после 10.10.2026).
-- На живой базе Supabase эта миграция не применялась.

create schema if not exists tax;
grant usage on schema tax to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema tax to authenticated';
  end if;
end $$;

-- ── Профиль ИП ───────────────────────────────────────────────────────────────
-- До регистрации ИП строки нет: бухгалтер работает в режиме подготовки.

create table tax.profile (
  tenant_id            uuid primary key references core.tenant(id),
  name                 text not null,                 -- «ИП Фамилия И.»
  iin                  text not null check (iin ~ '^\d{12}$'),
  registered_on        date not null,
  regime               text not null default 'simplified' check (regime in ('simplified')),
  rate                 numeric(4,2) not null default 4 check (rate between 2 and 6),   -- НК ст. 726
  city                 text,
  okved                text[] not null default '{}',
  bank                 text not null default 'Kaspi Pay',
  iban                 text,
  bik                  text,
  kbe                  text,
  kkm                  boolean not null default false,  -- есть онлайн-ККМ (Kaspi Касса и т. п.)
  declared_self_income numeric(14,2) not null default 0, -- база соцплатежей за себя; 0 — 1 МЗП
  updated_at           timestamptz not null default now()
);

-- ── Вид покупателя ───────────────────────────────────────────────────────────

create table tax.company_kind (
  tenant_id  uuid not null references core.tenant(id),
  company_id uuid primary key references crm.company(id),
  kind       text not null check (kind in ('ul','ip','fl'))
);

-- ── Строки документов (счёт, акт) ────────────────────────────────────────────

create table tax.doc_line (
  tenant_id uuid not null references core.tenant(id),
  doc_id    bigint not null references crm.doc(id) on delete cascade,
  n         int not null,
  name      text not null,
  qty       numeric(12,3) not null check (qty > 0),
  unit      text not null default 'усл.',
  price     numeric(14,2) not null check (price >= 0),
  primary key (doc_id, n)
);

-- ── Акт: подписание и ЭСФ ────────────────────────────────────────────────────

create table tax.act (
  tenant_id     uuid not null references core.tenant(id),
  doc_id        bigint primary key references crm.doc(id),
  signed_on     date,                                   -- дата дохода и оборота
  contract_no   text,
  invoice_id    bigint references crm.doc(id),
  pay_method    text not null default 'transfer' check (pay_method in ('transfer','qr_card','cash')),
  kkm_receipt   boolean not null default false,
  esf_number    text,                                   -- регистрационный номер в ИС ЭСФ
  esf_date      date,
  updated_at    timestamptz not null default now(),
  check (esf_number is null or signed_on is not null)
);

-- Акт — только к документу вида act, подписание — не раньше составления.
create or replace function tax.act_ga() returns trigger language plpgsql as $$
declare d crm.doc;
begin
  select * into d from crm.doc where id = new.doc_id;
  if d.kind <> 'act' then
    raise exception 'tax.act: документ % — не акт (%)', new.doc_id, d.kind;
  end if;
  if new.signed_on is not null and new.signed_on < d.issued_on then
    raise exception 'акт % подписан раньше, чем составлен', d.number;
  end if;
  new.tenant_id := d.tenant_id;
  new.updated_at := now();
  return new;
end $$;
create trigger act_ga before insert or update on tax.act for each row execute function tax.act_ga();

-- ── Строки выписок ───────────────────────────────────────────────────────────
-- Каждая строка банка один раз: ref — ключ из счёта, номера, даты и суммы.
-- Оплата покупателя, подтверждённая человеком, становится crm.payment.

create table tax.bank_line (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references core.tenant(id),
  ref         text not null,
  line_date   date not null,
  amount      numeric(14,2) not null check (amount > 0),
  direction   text not null check (direction in ('in','out')),
  purpose     text not null default '',
  payer       text not null default '',
  payer_bin   text not null default '',
  knp         text not null default '',
  kind        text not null check (kind in
                ('client','own','not_income','refund_out','social','tax','expense','unknown')),
  reason      text not null default '',
  company_id  uuid references crm.company(id),
  invoice_id  bigint references crm.doc(id),
  confirmed   boolean not null default false,
  confirmed_by uuid references core.person(id),
  payment_id  bigint references crm.payment(id),
  loaded_at   timestamptz not null default now(),
  unique (tenant_id, ref)
);

-- Подтверждает человек: агент (jarvis_worker) записывает строки, но confirmed
-- ставит только вошедший владелец — та же граница, что у acc.entry_post.
create or replace function tax.bank_line_gc() returns trigger language plpgsql as $$
begin
  if new.confirmed and not coalesce(old.confirmed, false) then
    if core.my_person() is null then
      raise exception 'подтвердить строку выписки может только человек';
    end if;
    new.confirmed_by := core.my_person();
  end if;
  return new;
end $$;
create trigger bank_line_gc before insert or update on tax.bank_line
  for each row execute function tax.bank_line_gc();

-- ── Витрины ──────────────────────────────────────────────────────────────────

-- Регистр доходов: подписанные акты + возвраты покупателям (НК ст. 724 п. 3, 725 п. 4).
create or replace view app.v_tax_income with (security_invoker = true) as
select a.tenant_id, a.signed_on as income_date, d.number as document, c.title as company, c.bin,
       d.amount, 'act'::text as basis
  from tax.act a
  join crm.doc d on d.id = a.doc_id and d.status <> 'cancelled'
  join crm.company c on c.id = d.company_id
 where a.signed_on is not null
union all
select b.tenant_id, b.line_date, left(b.purpose, 60), b.payer, b.payer_bin, -b.amount, 'refund'
  from tax.bank_line b
 where b.kind = 'refund_out';

-- Очередь ЭСФ: подписанные акты без номера ЭСФ и последний день выписки.
create or replace view app.v_tax_esf with (security_invoker = true) as
select a.tenant_id, d.number as act, c.title as company, coalesce(k.kind, 'ul') as buyer_kind,
       d.amount, a.signed_on, a.signed_on + 15 as esf_deadline, a.esf_number,
       case when a.esf_number is not null then 'issued'
            when coalesce(k.kind, 'ul') = 'fl' and (a.kkm_receipt or a.pay_method = 'qr_card') then 'on_request'
            when current_date > a.signed_on + 15 then 'overdue'
            else 'due' end as status
  from tax.act a
  join crm.doc d on d.id = a.doc_id and d.status <> 'cancelled'
  join crm.company c on c.id = d.company_id
  left join tax.company_kind k on k.company_id = d.company_id
 where a.signed_on is not null;

-- Все акты с налоговым слоем — для экрана «Налоги ИП»: и неподписанные тоже.
create or replace view app.v_tax_acts with (security_invoker = true) as
select d.tenant_id, d.id as doc_id, d.number, d.issued_on, d.amount, d.status, d.company_id,
       c.title as company, c.bin, coalesce(k.kind, 'ul') as buyer_kind,
       a.signed_on, a.pay_method, coalesce(a.kkm_receipt, false) as kkm_receipt, a.esf_number, a.esf_date
  from crm.doc d
  join crm.company c on c.id = d.company_id
  left join tax.act a on a.doc_id = d.id
  left join tax.company_kind k on k.company_id = d.company_id
 where d.kind = 'act' and d.status <> 'cancelled';

-- Строки выписок, которые ждут человека: не подтверждены.
create or replace view app.v_tax_bank with (security_invoker = true) as
select b.id, b.tenant_id, b.line_date, b.amount, b.direction, b.purpose, b.payer, b.payer_bin, b.knp,
       b.kind, b.reason, b.company_id, c.title as company, b.invoice_id, d.number as invoice, b.confirmed
  from tax.bank_line b
  left join crm.company c on c.id = b.company_id
  left join crm.doc d on d.id = b.invoice_id;

create or replace view app.v_tax_profile with (security_invoker = true) as
select * from tax.profile;

-- ── Действия экрана ─────────────────────────────────────────────────────────
-- Схема tax в API не открывается: экран ходит в app, функции — security invoker,
-- значит права и RLS те же, что у прямой записи в tax (только владелец).

create or replace function app.tax_profile_save(p jsonb) returns void
language plpgsql security invoker set search_path = app, tax, core, public, pg_temp as $$
begin
  insert into tax.profile (tenant_id, name, iin, registered_on, rate, city, okved, iban, bik, kbe, kkm,
                           declared_self_income)
  values (core.my_tenant(), p->>'name', p->>'iin', (p->>'registered_on')::date,
          coalesce((p->>'rate')::numeric, 4), p->>'city',
          coalesce(array(select jsonb_array_elements_text(p->'okved')), '{}'),
          p->>'iban', p->>'bik', p->>'kbe', coalesce((p->>'kkm')::boolean, false),
          coalesce((p->>'declared_self_income')::numeric, 0))
  on conflict (tenant_id) do update set
    name = excluded.name, iin = excluded.iin, registered_on = excluded.registered_on, rate = excluded.rate,
    city = excluded.city, okved = excluded.okved, iban = excluded.iban, bik = excluded.bik, kbe = excluded.kbe,
    kkm = excluded.kkm, declared_self_income = excluded.declared_self_income, updated_at = now();
end $$;

-- Отметки по акту: дата подписания, способ оплаты физлица, чек ККМ, номер ЭСФ.
-- Номер ЭСФ вносит человек после выписки в ИС ЭСФ — сайт в ИС ЭСФ ничего не отправляет.
create or replace function app.tax_act_save(p_doc bigint, p jsonb) returns void
language plpgsql security invoker set search_path = app, tax, crm, core, public, pg_temp as $$
begin
  insert into tax.act (tenant_id, doc_id, signed_on, pay_method, kkm_receipt, esf_number, esf_date)
  values (core.my_tenant(), p_doc, (p->>'signed_on')::date, coalesce(p->>'pay_method', 'transfer'),
          coalesce((p->>'kkm_receipt')::boolean, false), nullif(p->>'esf_number', ''), (p->>'esf_date')::date)
  on conflict (doc_id) do update set
    signed_on   = case when p ? 'signed_on' then (p->>'signed_on')::date else tax.act.signed_on end,
    pay_method  = coalesce(p->>'pay_method', tax.act.pay_method),
    kkm_receipt = coalesce((p->>'kkm_receipt')::boolean, tax.act.kkm_receipt),
    esf_number  = case when p ? 'esf_number' then nullif(p->>'esf_number', '') else tax.act.esf_number end,
    esf_date    = case when p ? 'esf_date' then (p->>'esf_date')::date else tax.act.esf_date end;
end $$;

create or replace function app.tax_company_kind_save(p_company uuid, p_kind text) returns void
language sql security invoker set search_path = app, tax, core, public, pg_temp as $$
  insert into tax.company_kind (tenant_id, company_id, kind) values (core.my_tenant(), p_company, p_kind)
  on conflict (company_id) do update set kind = excluded.kind;
$$;

-- Класс строки выписки и подтверждение. confirmed ставит только человек (триггер bank_line_gc).
create or replace function app.tax_bank_line_set(p_id bigint, p_kind text, p_confirm boolean default false)
returns void language sql security invoker set search_path = app, tax, core, public, pg_temp as $$
  update tax.bank_line
     set kind = p_kind,
         reason = case when kind = p_kind then reason else 'указал владелец' end,
         confirmed = confirmed or p_confirm
   where id = p_id;
$$;

revoke all on function app.tax_profile_save(jsonb) from public;
revoke all on function app.tax_act_save(bigint, jsonb) from public;
revoke all on function app.tax_company_kind_save(uuid, text) from public;
revoke all on function app.tax_bank_line_set(bigint, text, boolean) from public;

-- ── Права: как у денег — только владелец ─────────────────────────────────────

grant select, insert, update, delete on all tables in schema tax to jarvis_worker;
grant usage, select on all sequences in schema tax to jarvis_worker;
grant execute on all functions in schema tax to jarvis_worker;
grant select on app.v_tax_income, app.v_tax_esf, app.v_tax_acts, app.v_tax_bank, app.v_tax_profile to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on all tables in schema tax to authenticated';
    execute 'grant usage, select on all sequences in schema tax to authenticated';
    execute 'grant select on app.v_tax_income, app.v_tax_esf, app.v_tax_acts, app.v_tax_bank, app.v_tax_profile '
            'to authenticated';
    execute 'grant execute on function app.tax_profile_save(jsonb), app.tax_act_save(bigint, jsonb), '
            'app.tax_company_kind_save(uuid, text), app.tax_bank_line_set(bigint, text, boolean) to authenticated';
  end if;
end $$;

do $$
declare r record; pol text;
begin
  for r in
    select c.relname as tbl from pg_class c
     where c.relkind = 'r' and c.relnamespace = 'tax'::regnamespace
  loop
    execute format('alter table tax.%I enable row level security', r.tbl);
    execute format('alter table tax.%I force row level security', r.tbl);
    if exists (select 1 from pg_roles where rolname = 'jarvis_worker') then
      pol := format('%s_jarvis_worker', r.tbl);
      execute format('drop policy if exists %I on tax.%I', pol, r.tbl);
      execute format('create policy %I on tax.%I for all to jarvis_worker
                        using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())', pol, r.tbl);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      pol := format('%s_authenticated', r.tbl);
      execute format('drop policy if exists %I on tax.%I', pol, r.tbl);
      execute format('create policy %I on tax.%I for all to authenticated
                        using (tenant_id = core.my_tenant() and core.is_owner())
                        with check (tenant_id = core.my_tenant() and core.is_owner())', pol, r.tbl);
    end if;
  end loop;
end $$;

comment on schema tax is
  'Налоговый учёт ИП на упрощёнке: профиль, акты (дата дохода, ЭСФ), строки документов, выписки. Только владелец.';
