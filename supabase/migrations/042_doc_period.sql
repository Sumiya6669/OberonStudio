-- 042. Доход относится к периоду работы, а не ко дню выставления счёта.
--
-- Что нашли учениями. Часы отработаны в августе, счёт выставлен 14 сентября.
-- Запись учёта о доходе бралa дату выставления, и получилось так:
--
--   август:   6 проданных часов, доход 0,      убыток 65 000, ставка 0
--   сентябрь: 0 часов,           доход 72 000, прибыль 72 000, маржа 100 %
--
-- Обе строки — неправда, и обе выглядят как настоящий отчёт. Хуже того,
-- «Закрытие месяца» при этом показывало «можно закрывать» и фактическую
-- ставку 0. Цифра из воздуха, которую не с чем сверить, — ровно то, чего
-- эта система не должна делать.
--
-- Почему так вышло. У счёта была одна дата — issued_on, день выставления.
-- А у дохода дат две: когда выставили и ЗА ЧТО выставили. Вторая нигде не
-- хранилась, хотя обе функции выставления её знают: `invoice_from_time`
-- получает период параметром, `subscription_invoice` считает его из месяца.
--
-- Что делаем: храним период счёта и ставим запись о доходе на его конец.
-- День выставления при этом никуда не девается — он остаётся в issued_on
-- и в сроке оплаты. Для счёта без периода (ручного) всё как было.

alter table crm.doc
  add column if not exists period_from date,
  add column if not exists period_to   date;

comment on column crm.doc.period_from is 'Начало периода, за который выставлен счёт (включительно).';
comment on column crm.doc.period_to   is 'Конец периода, за который выставлен счёт (включительно). К этому месяцу относится доход.';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'crm.doc'::regclass and conname = 'doc_period_order') then
    alter table crm.doc add constraint doc_period_order
      check (period_from is null or period_to is null or period_to >= period_from);
  end if;
end $$;

-- ── 1. Счёт из часов помнит, за какой период он выставлен ───────────────────

create or replace function acc.invoice_from_time(p jsonb)
returns bigint
language plpgsql security invoker set search_path = acc, crm, core, public
as $$
declare
  v_tenant  uuid := core.my_tenant();
  v_company uuid := (p->>'company_id')::uuid;
  v_from    date := (p->>'from')::date;
  v_to      date := (p->>'to')::date;
  v_due     int  := coalesce((p->>'due_days')::int, 10);
  v_rate    numeric(10,2);
  v_minutes int;
  v_amount  numeric(14,2);
  v_doc     bigint;
  v_tickets bigint[];
begin
  if v_tenant is null then raise exception 'клиент не определён'; end if;
  if v_company is null then raise exception 'не указана компания'; end if;
  if v_from is null or v_to is null then raise exception 'не указан период'; end if;
  if v_to < v_from then raise exception 'конец периода раньше начала'; end if;

  select coalesce(c.hourly_rate, 10000) into v_rate
    from crm.company c where c.id = v_company;
  if v_rate is null then raise exception 'компания % не найдена', v_company; end if;

  select coalesce(sum(te.minutes), 0),
         coalesce(array_agg(distinct te.ticket_id), '{}')
    into v_minutes, v_tickets
    from crm.time_entry te
    join crm.ticket t on t.id = te.ticket_id
   where t.company_id = v_company
     and te.billable and te.invoiced_in is null
     and te.started_at >= v_from and te.started_at < v_to + 1;

  -- Пустой счёт не выставляется. Пустой успех — не успех.
  if v_minutes = 0 then
    raise exception 'за период с % по % нет невыставленных оплачиваемых часов',
      v_from, v_to;
  end if;

  v_amount := round(v_minutes / 60.0 * v_rate, 2);

  insert into crm.doc (tenant_id, company_id, kind, number, issued_on, due_on,
                       amount, currency, status, ticket_ids,
                       period_from, period_to)
  values (v_tenant, v_company, 'invoice', acc.next_number(v_tenant, 'invoice'),
          current_date, current_date + v_due, v_amount, 'KZT', 'issued', v_tickets,
          v_from, v_to)
  returning id into v_doc;

  update crm.time_entry te
     set invoiced_in = v_doc
   where te.id in (
     select te2.id from crm.time_entry te2
      join crm.ticket t on t.id = te2.ticket_id
     where t.company_id = v_company
       and te2.billable and te2.invoiced_in is null
       and te2.started_at >= v_from and te2.started_at < v_to + 1);

  return v_doc;
end $$;

-- ── 2. Запись о доходе встаёт на конец периода ──────────────────────────────

create or replace function acc.g_doc_entry() returns trigger
language plpgsql security definer set search_path = acc, crm, core, public
as $$
declare v_entry bigint; v_income text; v_date date;
begin
  if new.kind <> 'invoice' then return new; end if;
  if new.status not in ('issued','partly_paid','paid','overdue') then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;

  if exists (select 1 from acc.entry e
              where e.tenant_id = new.tenant_id and e.kind = 'invoice'
                and e.doc_id = new.id and e.status <> 'void') then
    return new;
  end if;

  v_income := case
    when exists (select 1 from acc.account a
                  where a.tenant_id = new.tenant_id and a.code = '6010')
    then '6010' else null end;
  if v_income is null then
    raise exception 'у клиента нет плана счетов: заведите его перед выставлением счетов';
  end if;

  -- Доход относится к тому месяцу, за который работали. Счёт без периода
  -- (выставленный руками) ведёт себя как раньше — по дате выставления.
  v_date := coalesce(new.period_to, new.issued_on);

  insert into acc.entry (tenant_id, kind, entry_date, memo, company_id, doc_id,
                         currency, source)
  values (new.tenant_id, 'invoice', v_date,
          format('Счёт %s', new.number), new.company_id, new.id,
          new.currency, 'auto')
  returning id into v_entry;

  insert into acc.posting (tenant_id, entry_id, account_code, side, amount, company_id)
  values (new.tenant_id, v_entry, '1210', 'dr', new.amount, new.company_id),
         (new.tenant_id, v_entry, v_income, 'cr', new.amount, new.company_id);

  return new;
end $$;

-- ── 3. Счёт по абонементу тоже помнит период ────────────────────────────────
-- Меняется только вставка: period_from/period_to = границы месяца.

do $$
declare src text; new_src text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'subscription_invoice';

  new_src := replace(src,
    'insert into crm.doc (tenant_id, company_id, kind, number, issued_on, due_on,
                       amount, currency, status)
  values (v_tenant, v_sub.company_id, ''invoice'', v_number, current_date,
          current_date + 10, v_amount, v_sub.currency, ''draft'')',
    'insert into crm.doc (tenant_id, company_id, kind, number, issued_on, due_on,
                       amount, currency, status, period_from, period_to)
  values (v_tenant, v_sub.company_id, ''invoice'', v_number, current_date,
          current_date + 10, v_amount, v_sub.currency, ''draft'',
          v_from, (v_to - 1)::date)');

  if new_src = src then
    raise exception 'не нашёл вставку счёта в subscription_invoice — перепишите руками';
  end if;

  new_src := replace(new_src,
    'on conflict (tenant_id, kind, number) do update
     set amount = excluded.amount, issued_on = excluded.issued_on',
    'on conflict (tenant_id, kind, number) do update
     set amount = excluded.amount, issued_on = excluded.issued_on,
         period_from = excluded.period_from, period_to = excluded.period_to');

  execute new_src;
end $$;

-- ── 4. Закрытие месяца перестаёт угадывать месяц по номеру счёта ────────────
-- Было: «номер начинается на ABON- → месяц из номера, иначе из даты
-- выставления». Теперь у счёта есть период, и гадать не нужно.

create or replace function app.month_close(p_month date default null)
returns table (
  month              date,
  acc_drafts         int,
  expenses_count     int,
  expenses_amount    numeric,
  hours_total        numeric,
  hours_billable     numeric,
  hours_unbilled     numeric,
  subs_active        int,
  subs_invoiced      int,
  subs_pending       int,
  docs_unpaid        int,
  docs_unpaid_amount numeric,
  cost_per_hour      numeric,
  actual_rate        numeric,
  ready              boolean
)
language sql stable security invoker
set search_path = app, crm, acc, core, public, pg_temp
as $$
with bounds as (
  select date_trunc('month',
           coalesce(p_month, (current_date - interval '1 month')))::date as m_from,
         (date_trunc('month',
           coalesce(p_month, (current_date - interval '1 month'))) + interval '1 month')::date as m_to
),
drafts as (
  select count(*)::int as n from acc.entry e, bounds b
   where e.status = 'draft' and e.entry_date >= b.m_from and e.entry_date < b.m_to
),
spend as (
  select count(distinct e.id)::int as n,
         coalesce(sum(case when p.side = 'dr' then p.amount else -p.amount end), 0) as amount
    from acc.entry e
    join acc.posting p on p.entry_id = e.id
    join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
    cross join bounds b
   where e.status = 'posted' and a.kind = 'expense'
     and e.entry_date >= b.m_from and e.entry_date < b.m_to
),
work as (
  select coalesce(sum(te.minutes), 0) / 60.0                              as total,
         coalesce(sum(te.minutes) filter (where te.billable), 0) / 60.0   as billable,
         coalesce(sum(te.minutes) filter (where te.billable
                    and te.invoiced_in is null), 0) / 60.0                as unbilled
    from crm.time_entry te, bounds b
   where te.started_at >= b.m_from and te.started_at < b.m_to
),
subs as (
  select count(*)::int as active,
         count(*) filter (where d.id is not null)::int as invoiced
    from crm.subscription s
    cross join bounds b
    left join crm.doc d
           on d.tenant_id = s.tenant_id
          and d.kind = 'invoice'
          and d.number = 'ABON-' || to_char(b.m_from, 'YYYY-MM') || '-' || s.id
   where s.started_on < b.m_to
     and (s.ends_on is null or s.ends_on >= b.m_from)
),
unpaid as (
  -- Месяц счёта — это период, за который он выставлен. Если периода нет
  -- (счёт заведён руками), остаётся день выставления.
  select count(*)::int as n, coalesce(sum(d.amount), 0) as amount
    from crm.doc d, bounds b
   where d.kind = 'invoice' and d.status <> 'paid'
     and coalesce(d.period_to, d.issued_on) >= b.m_from
     and coalesce(d.period_to, d.issued_on) <  b.m_to
),
rate as (
  select r.cost_per_hour, r.actual_rate
    from app.v_rate_health r, bounds b
   where r.month = b.m_from
)
select b.m_from,
       d.n, s.n, s.amount,
       round(w.total::numeric, 1), round(w.billable::numeric, 1), round(w.unbilled::numeric, 1),
       sb.active, sb.invoiced, sb.active - sb.invoiced,
       u.n, u.amount,
       r.cost_per_hour, r.actual_rate,
       (d.n = 0 and sb.active = sb.invoiced and w.unbilled = 0)
  from bounds b, drafts d, spend s, work w, subs sb, unpaid u
  left join rate r on true;
$$;

comment on function app.month_close(date) is
  'Факты по месяцу для закрытия: черновики, расходы, часы, счета по абонементам, неоплаченное, ставка. Месяц счёта — период, за который он выставлен.';
