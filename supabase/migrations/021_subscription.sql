-- 021. Абонементы и обязательства по срокам.
--
-- Чего не хватало. Система умела считать разовые работы: заявка, часы, счёт.
-- Но два самых денежных способа продавать услуги 1С так не описываются:
--
--   «сопровождение» — клиент платит каждый месяц и получает пакет часов;
--   «скорая»        — клиент платит за обращение, но покупает СРОК реакции.
--
-- В обоих случаях предмет сделки — не часы, а обещание. Пока обещание не
-- записано, его нельзя ни проверить, ни предъявить, ни выставить. Отсюда
-- две вещи в этой миграции: абонемент и срок.
--
-- Главное решение. Условия КОПИРУЮТСЯ в абонемент при продаже, а не
-- берутся из тарифа по ссылке. Тариф — это прайс на сегодня; абонемент —
-- то, о чём договорились тогда. Поменяли прайс — у старого клиента ничего
-- не изменилось. Иначе правка цены задним числом молча переписывала бы
-- уже проданное, ровно как правка проведённого документа.

-- ── Тариф: прайс на сегодня ─────────────────────────────────────────────────

create table if not exists crm.plan (
  tenant_id       uuid not null references core.tenant(id) on delete cascade,
  code            text not null,
  title           text not null,
  -- Что продаём: абонемент с пакетом часов или обращение с обещанным сроком.
  kind            text not null default 'subscription'
                  check (kind in ('subscription','incident','default')),
  price           numeric(12,2) not null default 0,
  currency        text not null default 'KZT',
  -- Пакет часов в месяц. 0 — часы не включены, всё сверх тарифа.
  included_minutes int not null default 0 check (included_minutes >= 0),
  -- Ставка за час сверх пакета. 0 — не задана, тогда берётся ставка клиента.
  overage_rate    numeric(10,2) not null default 0,
  -- Обещания. Минуты, а не часы: «в течение часа» и «до конца дня» —
  -- разные обещания, и хранить их в одних единицах удобнее, чем в двух.
  react_minutes   int check (react_minutes > 0),
  resolve_minutes int check (resolve_minutes > 0),
  -- Считать срок по календарю или по рабочему времени. Обещание «час»
  -- в пятницу в 23:50 означает разное в этих двух случаях, и клиент
  -- обязан знать, какое именно ему продали.
  clock           text not null default 'calendar' check (clock in ('calendar','business')),
  note            text,
  is_active       boolean not null default true,
  sort            int not null default 0,
  created_at      timestamptz not null default now(),
  primary key (tenant_id, code)
);

comment on table crm.plan is
  'Тарифы — прайс на сегодня. Проданные абонементы копируют условия и от правок прайса не зависят.';
comment on column crm.plan.clock is
  'calendar — срок идёт круглосуточно; business — только в рабочие часы.';

-- ── Абонемент: то, о чём договорились ───────────────────────────────────────

create table if not exists crm.subscription (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references core.tenant(id) on delete cascade,
  company_id      uuid not null references crm.company(id) on delete cascade,
  -- Ссылка на тариф остаётся, но только как след «из чего это выросло».
  -- Условия ниже — свои.
  plan_code       text,
  title           text not null,
  price           numeric(12,2) not null default 0,
  currency        text not null default 'KZT',
  included_minutes int not null default 0 check (included_minutes >= 0),
  overage_rate    numeric(10,2) not null default 0,
  react_minutes   int check (react_minutes > 0),
  resolve_minutes int check (resolve_minutes > 0),
  clock           text not null default 'calendar' check (clock in ('calendar','business')),
  -- День месяца для счёта. 0 — считать от начала календарного месяца.
  billing_day     int not null default 1 check (billing_day between 0 and 28),
  started_on      date not null default current_date,
  ends_on         date,
  status          text not null default 'active'
                  check (status in ('active','paused','ended')),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (tenant_id, plan_code) references crm.plan(tenant_id, code)
    on delete set null,
  check (ends_on is null or ends_on >= started_on)
);

create index if not exists subscription_company_idx
  on crm.subscription (tenant_id, company_id, status);

comment on table crm.subscription is
  'Абонемент клиента с условиями, зафиксированными на момент продажи.';

-- Один действующий абонемент на клиента: два действующих означают, что
-- непонятно, чей пакет часов расходуется, и любая цифра будет спорной.
create unique index if not exists subscription_one_active_idx
  on crm.subscription (tenant_id, company_id)
  where status = 'active';

-- ── Сроки у заявки ──────────────────────────────────────────────────────────

alter table crm.ticket
  add column if not exists react_by       timestamptz,
  add column if not exists resolve_by     timestamptz,
  add column if not exists first_reply_at timestamptz,
  add column if not exists closed_at      timestamptz,
  add column if not exists subscription_id bigint references crm.subscription(id);

create index if not exists ticket_react_by_idx
  on crm.ticket (tenant_id, react_by) where first_reply_at is null;

comment on column crm.ticket.react_by is
  'До какого времени обещан первый ответ. Считается при приёме заявки из абонемента или тарифа по умолчанию.';
comment on column crm.ticket.first_reply_at is
  'Когда ответили в первый раз. Заполняется первым сообщением от нас, а не сменой статуса: клиент видит ответ, а не статус.';

-- ── Откуда берётся срок ─────────────────────────────────────────────────────
--
-- Порядок один и без исключений: действующий абонемент клиента, иначе
-- тариф с кодом default. Если и его нет — сроков нет, и это честно: пустой
-- срок означает «не обещали», а не «обещали и просрочили».

create or replace function crm.sla_apply() returns trigger
language plpgsql set search_path = crm, core, public
as $$
declare
  v_sub      crm.subscription;
  v_react    int;
  v_resolve  int;
  v_from     timestamptz := coalesce(new.received_at, new.created_at, now());
begin
  if new.company_id is not null then
    select * into v_sub from crm.subscription s
     where s.tenant_id = new.tenant_id and s.company_id = new.company_id
       and s.status = 'active'
       and s.started_on <= current_date
       and (s.ends_on is null or s.ends_on >= current_date)
     limit 1;
  end if;

  if v_sub.id is not null then
    new.subscription_id := v_sub.id;
    v_react   := v_sub.react_minutes;
    v_resolve := v_sub.resolve_minutes;
  else
    select p.react_minutes, p.resolve_minutes into v_react, v_resolve
      from crm.plan p
     where p.tenant_id = new.tenant_id and p.code = 'default' and p.is_active;
  end if;

  if v_react is not null then
    new.react_by := v_from + make_interval(mins => v_react);
  end if;
  if v_resolve is not null then
    new.resolve_by := v_from + make_interval(mins => v_resolve);
  end if;
  return new;
end $$;

drop trigger if exists ticket_sla on crm.ticket;
create trigger ticket_sla before insert on crm.ticket
  for each row execute function crm.sla_apply();

-- Первый ответ фиксируется сообщением от нас. Именно сообщением: смена
-- статуса на «в работе» клиенту не видна, а обещали мы ему ответ.
create or replace function crm.sla_first_reply() returns trigger
language plpgsql set search_path = crm, public
as $$
begin
  if new.author = 'me' or new.author like 'agent:%' then
    update crm.ticket t
       set first_reply_at = coalesce(t.first_reply_at, new.at)
     where t.id = new.ticket_id and t.first_reply_at is null;
  end if;
  return new;
end $$;

drop trigger if exists ticket_message_reply on crm.ticket_message;
create trigger ticket_message_reply after insert on crm.ticket_message
  for each row execute function crm.sla_first_reply();

create or replace function crm.ticket_closed_at() returns trigger
language plpgsql set search_path = crm, public
as $$
begin
  if new.status in ('done','cancelled') and old.status not in ('done','cancelled') then
    new.closed_at := coalesce(new.closed_at, now());
  elsif new.status not in ('done','cancelled') then
    new.closed_at := null;    -- переоткрыли: закрытия больше нет
  end if;
  return new;
end $$;

drop trigger if exists ticket_closed on crm.ticket;
create trigger ticket_closed before update of status on crm.ticket
  for each row execute function crm.ticket_closed_at();

-- ── Продажа и закрытие абонемента ───────────────────────────────────────────

create or replace function public.subscription_new(
  p_company uuid, p_plan text, p_from date default current_date,
  p_price numeric default null, p_included_minutes int default null
) returns bigint
language plpgsql security definer set search_path = crm, core, public
as $$
declare v_tenant uuid := core.my_tenant(); v_plan crm.plan; v_id bigint;
begin
  if v_tenant is null or core.my_person() is null then
    raise exception 'абонемент продаёт человек';
  end if;

  select * into v_plan from crm.plan
   where tenant_id = v_tenant and code = p_plan and is_active;
  if v_plan.code is null then
    raise exception 'тариф % не найден или выключен', p_plan;
  end if;

  -- Прежний абонемент закрывается днём раньше нового: пересечение означало
  -- бы два действующих пакета часов у одного клиента.
  --
  -- greatest со днём начала — для случая «продали утром, поменяли тариф
  -- днём»: минус день ушёл бы раньше начала, и запись стала бы
  -- невозможной. Такой абонемент честно живёт один день, а не отменяется
  -- задним числом: он существовал, и в истории это должно остаться.
  update crm.subscription
     set status = 'ended',
         ends_on = greatest(started_on, p_from - 1),
         updated_at = now()
   where tenant_id = v_tenant and company_id = p_company and status = 'active';

  insert into crm.subscription (
    tenant_id, company_id, plan_code, title, price, currency,
    included_minutes, overage_rate, react_minutes, resolve_minutes, clock,
    started_on)
  values (
    v_tenant, p_company, v_plan.code, v_plan.title,
    coalesce(p_price, v_plan.price), v_plan.currency,
    coalesce(p_included_minutes, v_plan.included_minutes), v_plan.overage_rate,
    v_plan.react_minutes, v_plan.resolve_minutes, v_plan.clock, p_from)
  returning id into v_id;

  update crm.company set status = 'support'
   where id = p_company and tenant_id = v_tenant and status in ('lead','active');

  return v_id;
end $$;

create or replace function public.subscription_end(p_id bigint, p_on date default current_date)
returns void
language plpgsql security definer set search_path = crm, core, public
as $$
begin
  if core.my_person() is null then raise exception 'нужен вход человека'; end if;
  update crm.subscription
     set status = 'ended', ends_on = p_on, updated_at = now()
   where id = p_id and tenant_id = core.my_tenant();
end $$;

-- ── Счёт за период ──────────────────────────────────────────────────────────
--
-- Считает пакет плюс перерасход. Часы, попавшие в счёт, помечаются — иначе
-- следующий месяц посчитал бы их второй раз, и это была бы не ошибка
-- округления, а выставленный дважды час.

create or replace function public.subscription_invoice(p_id bigint, p_month date default null)
returns bigint
language plpgsql security definer set search_path = crm, core, public
as $$
declare
  v_tenant  uuid := core.my_tenant();
  v_sub     crm.subscription;
  v_from    date;
  v_to      date;
  v_used    int;
  v_over    int;
  v_rate    numeric(10,2);
  v_amount  numeric(12,2);
  v_doc     bigint;
  v_number  text;
begin
  if v_tenant is null or core.my_person() is null then
    raise exception 'счёт выставляет человек';
  end if;

  select * into v_sub from crm.subscription where id = p_id and tenant_id = v_tenant;
  if v_sub.id is null then raise exception 'абонемент не найден'; end if;

  v_from := date_trunc('month', coalesce(p_month, current_date))::date;
  v_to   := (v_from + interval '1 month')::date;

  select coalesce(sum(te.minutes), 0) into v_used
    from crm.time_entry te
    join crm.ticket t on t.id = te.ticket_id
   where te.tenant_id = v_tenant
     and t.company_id = v_sub.company_id
     and te.billable
     and te.invoiced_in is null
     and te.started_at >= v_from and te.started_at < v_to;

  v_over := greatest(0, v_used - v_sub.included_minutes);
  v_rate := case when v_sub.overage_rate > 0 then v_sub.overage_rate
                 else coalesce((select hourly_rate from crm.company
                                 where id = v_sub.company_id), 0) end;
  v_amount := v_sub.price + round(v_over / 60.0 * v_rate, 2);

  if v_amount <= 0 then
    raise exception 'счёт на ноль не выставляется: проверьте цену абонемента и ставку';
  end if;

  v_number := 'ABON-' || to_char(v_from, 'YYYY-MM') || '-' || v_sub.id;

  insert into crm.doc (tenant_id, company_id, kind, number, issued_on, due_on,
                       amount, currency, status)
  values (v_tenant, v_sub.company_id, 'invoice', v_number, current_date,
          current_date + 10, v_amount, v_sub.currency, 'draft')
  on conflict (tenant_id, kind, number) do update
     set amount = excluded.amount, issued_on = excluded.issued_on
  returning id into v_doc;

  -- Часы закрываем этим счётом, но только те, что в него вошли.
  update crm.time_entry te
     set invoiced_in = v_doc
    from crm.ticket t
   where t.id = te.ticket_id
     and te.tenant_id = v_tenant
     and t.company_id = v_sub.company_id
     and te.billable
     and te.invoiced_in is null
     and te.started_at >= v_from and te.started_at < v_to;

  return v_doc;
end $$;

revoke all on function public.subscription_new(uuid, text, date, numeric, int) from public;
revoke all on function public.subscription_end(bigint, date) from public;
revoke all on function public.subscription_invoice(bigint, date) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.subscription_new(uuid, text, date, numeric, int) to authenticated';
    execute 'grant execute on function public.subscription_end(bigint, date) to authenticated';
    execute 'grant execute on function public.subscription_invoice(bigint, date) to authenticated';
  end if;
end $$;

-- ── Витрины ─────────────────────────────────────────────────────────────────

drop view if exists app.v_subscription cascade;
create view app.v_subscription with (security_invoker = true) as
with used as (
  select t.company_id,
         sum(te.minutes) filter (
           where te.started_at >= date_trunc('month', now())) as used_month,
         sum(te.minutes) filter (
           where te.started_at >= date_trunc('month', now()) and te.invoiced_in is null
         ) as unbilled_month
    from crm.time_entry te
    join crm.ticket t on t.id = te.ticket_id
   where te.billable
   group by t.company_id
)
select s.id, s.tenant_id, s.company_id, c.title as company, s.title,
       s.price, s.currency, s.status, s.started_on, s.ends_on,
       s.included_minutes,
       coalesce(u.used_month, 0)                                as used_minutes,
       greatest(0, s.included_minutes - coalesce(u.used_month, 0)) as left_minutes,
       greatest(0, coalesce(u.used_month, 0) - s.included_minutes) as over_minutes,
       coalesce(u.unbilled_month, 0)                            as unbilled_minutes,
       case when s.included_minutes > 0
            then round(coalesce(u.used_month, 0)::numeric * 100 / s.included_minutes, 0)
            else null end                                       as used_pct,
       s.react_minutes, s.resolve_minutes, s.clock, s.overage_rate,
       exists (select 1 from crm.doc d
                where d.tenant_id = s.tenant_id and d.company_id = s.company_id
                  and d.kind = 'invoice' and d.status in ('issued','overdue','partly_paid')
                  and d.due_on < current_date)                  as has_overdue_invoice
  from crm.subscription s
  join crm.company c on c.id = s.company_id
  left join used u on u.company_id = s.company_id;

comment on view app.v_subscription is
  'Абонементы: сколько включено, сколько израсходовано в этом месяце, что не выставлено.';

-- Просрочка обещаний. Отдельно реакция и сдача: это разные обещания и
-- разные разговоры с клиентом.
drop view if exists app.v_sla_breach cascade;
create view app.v_sla_breach with (security_invoker = true) as
select t.id, t.tenant_id, t.subject, t.status, t.priority,
       c.title as company,
       t.react_by, t.first_reply_at, t.resolve_by, t.closed_at,
       (t.react_by is not null and t.first_reply_at is null and t.react_by < now())
         as react_overdue,
       (t.resolve_by is not null and t.closed_at is null and t.resolve_by < now())
         as resolve_overdue,
       case when t.react_by is not null and t.first_reply_at is null
            then greatest(0, extract(epoch from (now() - t.react_by))/60)::int end
         as react_late_minutes,
       case when t.resolve_by is not null and t.closed_at is null
            then greatest(0, extract(epoch from (now() - t.resolve_by))/60)::int end
         as resolve_late_minutes,
       t.created_at
  from crm.ticket t
  left join crm.company c on c.id = t.company_id
 where t.status not in ('done','cancelled')
   and ((t.react_by is not null and t.first_reply_at is null and t.react_by < now())
     or (t.resolve_by is not null and t.closed_at is null and t.resolve_by < now()));

comment on view app.v_sla_breach is
  'Заявки, по которым обещание уже нарушено: реакция или срок сдачи.';

-- Держим ли мы обещание вообще. Без этой цифры «ответ в течение часа» —
-- лозунг на сайте, а не факт.
drop view if exists app.v_sla_month cascade;
create view app.v_sla_month with (security_invoker = true) as
select t.tenant_id,
       date_trunc('month', t.created_at)::date as month,
       count(*) filter (where t.react_by is not null)               as promised,
       count(*) filter (where t.react_by is not null
                          and t.first_reply_at is not null
                          and t.first_reply_at <= t.react_by)        as in_time,
       count(*) filter (where t.react_by is not null
                          and (t.first_reply_at is null or t.first_reply_at > t.react_by)
                          and t.react_by < now())                    as late,
       round(avg(extract(epoch from (t.first_reply_at - coalesce(t.received_at, t.created_at)))/60)
             filter (where t.first_reply_at is not null))::int        as avg_reply_minutes
  from crm.ticket t
 group by t.tenant_id, 2;

comment on view app.v_sla_month is
  'Сколько обещаний по реакции сдержано за месяц и среднее время первого ответа.';

-- ── Права и RLS ─────────────────────────────────────────────────────────────

grant select, insert, update on crm.plan to jarvis_worker;
grant select, insert, update on crm.subscription to jarvis_worker;
grant usage, select on sequence crm.subscription_id_seq to jarvis_worker;
grant select on app.v_subscription, app.v_sla_breach, app.v_sla_month to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on crm.plan to authenticated';
    execute 'grant select, insert, update, delete on crm.subscription to authenticated';
    execute 'grant usage, select on sequence crm.subscription_id_seq to authenticated';
    execute 'grant select on app.v_subscription, app.v_sla_breach, app.v_sla_month to authenticated';
  end if;
end $$;

do $$
declare r record; rl text; roles text[] := array['authenticated','jarvis_worker'];
begin
  for r in select unnest(array['plan','subscription']) as tbl loop
    execute format('alter table crm.%I enable row level security', r.tbl);
    execute format('alter table crm.%I force row level security', r.tbl);
    foreach rl in array roles loop
      if exists (select 1 from pg_roles where rolname = rl) then
        execute format('drop policy if exists %I on crm.%I', r.tbl || '_' || rl, r.tbl);
        execute format(
          'create policy %I on crm.%I for all to %I using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())',
          r.tbl || '_' || rl, r.tbl, rl);
      end if;
    end loop;
  end loop;
end $$;

-- ── Тарифы по умолчанию ─────────────────────────────────────────────────────
--
-- Цены намеренно нулевые: их задаёт владелец в панели. Ноль читается как
-- «не задано» и мешает выставить счёт — это лучше, чем правдоподобная
-- цифра, взятая с потолка и однажды попавшая клиенту в счёт.
--
-- Сроки, наоборот, заданы: час на реакцию сайт уже обещает, и обещание
-- должно быть записано там, где его можно проверить.

do $$
declare r record;
begin
  for r in select id from core.tenant loop
    insert into crm.plan (tenant_id, code, title, kind, price, included_minutes,
                          react_minutes, resolve_minutes, clock, sort, note)
    values
      (r.id, 'default', 'Без абонемента', 'default', 0, 0,
       60, 2880, 'calendar', 0,
       'Сроки для заявок от клиентов без абонемента. Час на первый ответ — то, что обещает сайт.'),
      (r.id, 'incident', 'Скорая по 1С', 'incident', 0, 0,
       60, 480, 'business', 10,
       'Оплата за обращение. Цену задайте в панели.'),
      (r.id, 'watch', 'Обмены под наблюдением', 'subscription', 0, 120,
       120, 1440, 'business', 20,
       'Ежедневная проверка обменов плюс два часа работ в месяц. Цену задайте в панели.'),
      (r.id, 'support', 'Сопровождение', 'subscription', 0, 300,
       60, 1440, 'business', 30,
       'Пакет часов в месяц, приоритет в очереди. Цену и объём задайте в панели.')
    on conflict (tenant_id, code) do nothing;
  end loop;
end $$;
