-- 028. Закрытие месяца: один список вместо памяти.
--
-- Зачем. Месяц закрывается не одним действием, а пятью, и они разбросаны
-- по разным экранам: провести черновики учёта, внести расходы, выставить
-- счёта по абонементам, выставить часы тем, кто без абонемента, и только
-- потом смотреть на ставку. Пока это держится в голове, каждый месяц
-- что-то забывается — обычно счёт, потому что он единственный, кого
-- никто не напомнит.
--
-- Правило здесь одно и оно важное: СЧЁТ НИКОГДА НЕ ВЫСТАВЛЯЕТСЯ САМ.
-- База показывает, сколько получится, и ждёт человека. Автоматически
-- выставленный счёт, в котором ошибка, — это разговор с клиентом, который
-- дороже любой экономии времени.
--
-- Что здесь: две функции, отдающие ФАКТЫ по месяцу. Никаких действий они
-- не выполняют — действие остаётся за `subscription_invoice` и
-- `acc_invoice_from_time`, которые уже есть и требуют человека.
--
-- Почему функции, а не витрины: витрине нельзя передать месяц, а закрывать
-- приходится и прошлый (обычный случай), и позапрошлый (если забыли).

-- ── 1. Свод по месяцу ───────────────────────────────────────────────────────

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
  -- Действующим в месяце считается абонемент, пересекающийся с месяцем
  -- хотя бы одним днём: закрытый пятнадцатого числа всё равно надо
  -- выставить за половину месяца.
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
  -- Счёт за август, выставленный третьего сентября, относится к августу.
  -- Поэтому месяц определяется не датой выставления, а тем, за что счёт:
  -- по абонементам это номер, по часам — дата выставления.
  select count(*)::int as n, coalesce(sum(d.amount), 0) as amount
    from crm.doc d, bounds b
   where d.kind = 'invoice' and d.status <> 'paid'
     and (d.number like 'ABON-' || to_char(b.m_from, 'YYYY-MM') || '-%'
       or (d.number not like 'ABON-%'
           and d.issued_on >= b.m_from and d.issued_on < b.m_to))
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
  'Факты по месяцу для закрытия: черновики, расходы, часы, счета по абонементам, неоплаченное, ставка.';

-- ── 2. Абонементы месяца с суммой ДО выставления ────────────────────────────
--
-- Сумма считается тем же способом, что и в `subscription_invoice`: пакет
-- плюс перерасход по ставке. Иначе на экране была бы одна цифра, а в счёте
-- другая, и доверять экрану стало бы нельзя.

create or replace function app.month_close_subs(p_month date default null)
returns table (
  subscription_id  bigint,
  company_id       uuid,
  company          text,
  title            text,
  price            numeric,
  currency         text,
  included_minutes int,
  used_minutes     int,
  over_minutes     int,
  over_rate        numeric,
  amount_preview   numeric,
  invoice_number   text,
  invoice_id       bigint,
  invoice_status   text
)
language sql stable security invoker
set search_path = app, crm, core, public, pg_temp
as $$
with bounds as (
  select date_trunc('month',
           coalesce(p_month, (current_date - interval '1 month')))::date as m_from,
         (date_trunc('month',
           coalesce(p_month, (current_date - interval '1 month'))) + interval '1 month')::date as m_to
),
used as (
  select s.id as sid,
         coalesce(sum(te.minutes), 0)::int as minutes
    from crm.subscription s
    cross join bounds b
    left join crm.ticket t on t.company_id = s.company_id and t.tenant_id = s.tenant_id
    left join crm.time_entry te
           on te.ticket_id = t.id and te.billable and te.invoiced_in is null
          and te.started_at >= b.m_from and te.started_at < b.m_to
   where s.started_on < b.m_to and (s.ends_on is null or s.ends_on >= b.m_from)
   group by s.id
)
select s.id, s.company_id, c.title, s.title, s.price, s.currency,
       s.included_minutes, u.minutes,
       greatest(0, u.minutes - s.included_minutes),
       case when s.overage_rate > 0 then s.overage_rate
            else coalesce(c.hourly_rate, 0) end,
       -- Пока счёта нет — прикидка. Как только счёт выставлен, показываем
       -- ЕГО сумму: часы уже помечены выставленными, и пересчёт дал бы
       -- пакет без перерасхода, то есть цифру меньше выставленной.
       coalesce(d.amount,
                s.price + round(greatest(0, u.minutes - s.included_minutes) / 60.0
                                * case when s.overage_rate > 0 then s.overage_rate
                                       else coalesce(c.hourly_rate, 0) end, 2)),
       'ABON-' || to_char(b.m_from, 'YYYY-MM') || '-' || s.id,
       d.id, d.status
  from crm.subscription s
  cross join bounds b
  join used u on u.sid = s.id
  left join crm.company c on c.id = s.company_id
  left join crm.doc d
         on d.tenant_id = s.tenant_id and d.kind = 'invoice'
        and d.number = 'ABON-' || to_char(b.m_from, 'YYYY-MM') || '-' || s.id
 where s.started_on < b.m_to and (s.ends_on is null or s.ends_on >= b.m_from)
 order by (d.id is not null), c.title;
$$;

comment on function app.month_close_subs(date) is
  'Абонементы, действовавшие в месяце: расход по пакету, перерасход и сумма счёта ДО выставления.';

-- ── 3. Часы без абонемента ──────────────────────────────────────────────────
--
-- Те, кому счёт выставляется по часам. Отдельно, потому что выставляет их
-- другая функция и разговор с клиентом другой.

create or replace function app.month_close_hours(p_month date default null)
returns table (
  company_id     uuid,
  company        text,
  hourly_rate    numeric,
  minutes        int,
  hours          numeric,
  amount_preview numeric
)
language sql stable security invoker
set search_path = app, crm, core, public, pg_temp
as $$
with bounds as (
  select date_trunc('month',
           coalesce(p_month, (current_date - interval '1 month')))::date as m_from,
         (date_trunc('month',
           coalesce(p_month, (current_date - interval '1 month'))) + interval '1 month')::date as m_to
)
select c.id, c.title, c.hourly_rate,
       sum(te.minutes)::int,
       round(sum(te.minutes) / 60.0, 1),
       round(sum(te.minutes) / 60.0 * coalesce(c.hourly_rate, 0), 2)
  from crm.time_entry te
  join crm.ticket t on t.id = te.ticket_id
  join crm.company c on c.id = t.company_id
  cross join bounds b
 where te.billable and te.invoiced_in is null
   and te.started_at >= b.m_from and te.started_at < b.m_to
   and not exists (select 1 from crm.subscription s
                    where s.company_id = c.id and s.status = 'active'
                      and s.started_on < b.m_to
                      and (s.ends_on is null or s.ends_on >= b.m_from))
 group by c.id, c.title, c.hourly_rate
 order by 5 desc;
$$;

comment on function app.month_close_hours(date) is
  'Клиенты без абонемента с неоплаченными часами за месяц и прикидка суммы.';

-- ── Права ───────────────────────────────────────────────────────────────────

revoke all on function app.month_close(date) from public;
revoke all on function app.month_close_subs(date) from public;
revoke all on function app.month_close_hours(date) from public;
grant execute on function app.month_close(date) to jarvis_worker;
grant execute on function app.month_close_subs(date) to jarvis_worker;
grant execute on function app.month_close_hours(date) to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function app.month_close(date) to authenticated';
    execute 'grant execute on function app.month_close_subs(date) to authenticated';
    execute 'grant execute on function app.month_close_hours(date) to authenticated';
  end if;
end $$;

-- ── 4. Повторное «выставить счёт» уменьшало счёт. Починено ──────────────────
--
-- Найдено прогоном этого же экрана. Кнопку «выставить счёт» нажали дважды —
-- обычное дело, если первый раз показалось, что не сработало:
--
--   первое нажатие:  пакет 90 000 + перерасход 120 мин × 8 000/ч = 106 000
--   второе нажатие:  90 000
--
-- Почему. `subscription_invoice` считает перерасход по часам, у которых
-- ещё не отмечен счёт. После первого нажатия часы уже отмечены, поэтому
-- второй расчёт видит ноль перерасхода — и `on conflict do update set
-- amount` перезаписывает сумму вниз. Часы при этом остаются отмеченными:
-- перерасход не пропадает в ноль, он пропадает НАВСЕГДА, потому что в
-- следующий месяц уже не попадёт.
--
-- Починка: при пересчёте учитываются часы, отмеченные ЭТИМ ЖЕ счётом.
-- Тогда повторное нажатие даёт ту же сумму, что и первое.
--
-- И второе: выставленный или оплаченный счёт пересчёту не подлежит вообще.
-- Клиент его уже видел; менять сумму молча нельзя. Нужна другая сумма —
-- значит отмена и новый счёт, и это осознанное действие человека.

create or replace function public.subscription_invoice(p_id bigint, p_month date default null)
returns bigint
language plpgsql security definer set search_path = crm, core, public, pg_temp
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
  v_status  text;
  v_number  text;
begin
  if v_tenant is null or core.my_person() is null then
    raise exception 'счёт выставляет человек';
  end if;

  select * into v_sub from crm.subscription where id = p_id and tenant_id = v_tenant;
  if v_sub.id is null then raise exception 'абонемент не найден'; end if;

  v_from := date_trunc('month', coalesce(p_month, current_date))::date;
  v_to   := (v_from + interval '1 month')::date;

  v_number := 'ABON-' || to_char(v_from, 'YYYY-MM') || '-' || v_sub.id;

  -- Что уже есть по этому периоду.
  select id, status into v_doc, v_status
    from crm.doc
   where tenant_id = v_tenant and kind = 'invoice' and number = v_number;

  if v_doc is not null and v_status <> 'draft' then
    -- Не ошибка вызывающего, а защита клиента: счёт уже ушёл.
    raise exception 'счёт % уже % — пересчитать его нельзя. Отмените счёт и выставьте новый',
      v_number, v_status;
  end if;

  -- Часы периода: ещё не выставленные ИЛИ выставленные этим же счётом.
  -- Второе слагаемое и есть починка: без него повторный расчёт видит ноль.
  select coalesce(sum(te.minutes), 0) into v_used
    from crm.time_entry te
    join crm.ticket t on t.id = te.ticket_id
   where te.tenant_id = v_tenant
     and t.company_id = v_sub.company_id
     and te.billable
     and (te.invoiced_in is null or te.invoiced_in = v_doc)
     and te.started_at >= v_from and te.started_at < v_to;

  v_over := greatest(0, v_used - v_sub.included_minutes);
  v_rate := case when v_sub.overage_rate > 0 then v_sub.overage_rate
                 else coalesce((select hourly_rate from crm.company
                                 where id = v_sub.company_id), 0) end;
  v_amount := v_sub.price + round(v_over / 60.0 * v_rate, 2);

  if v_amount <= 0 then
    raise exception 'счёт на ноль не выставляется: проверьте цену абонемента и ставку';
  end if;

  insert into crm.doc (tenant_id, company_id, kind, number, issued_on, due_on,
                       amount, currency, status)
  values (v_tenant, v_sub.company_id, 'invoice', v_number, current_date,
          current_date + 10, v_amount, v_sub.currency, 'draft')
  on conflict (tenant_id, kind, number) do update
     set amount = excluded.amount, issued_on = excluded.issued_on
  returning id into v_doc;

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

comment on function public.subscription_invoice(bigint, date) is
  'Счёт за период по абонементу: пакет плюс перерасход. Повторный вызов даёт ту же сумму; выставленный счёт не пересчитывается.';

revoke all on function public.subscription_invoice(bigint, date) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.subscription_invoice(bigint, date) to authenticated';
  end if;
end $$;
grant execute on function public.subscription_invoice(bigint, date) to jarvis_worker;
