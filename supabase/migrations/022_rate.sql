-- 022. Ставка и точка безубыточности.
--
-- Зачем. Одиночка и маленькая студия почти всегда назначают ставку «как у
-- всех» или «сколько не стыдно попросить». В обоих случаях цифра взята не
-- из своих расходов, и убыточный месяц выглядит как обычный: деньги ведь
-- приходили. Понимание приходит через год, когда кончаются деньги.
--
-- Считать нужно не «сколько я хочу за час», а обратное: сколько часов из
-- месяца реально оплачиваемые, и сколько на них ложится всех расходов.
-- Ключевое здесь — ОПЛАЧИВАЕМАЯ ЗАГРУЗКА. Работая сорок часов в неделю,
-- продать удаётся редко больше половины: остальное уходит на переписку,
-- продажи, счета, обновления, собственную систему. Расходы же ложатся на
-- проданные часы, а не на все.
--
-- Отсюда цифра, которой обычно не знают: минимальная ставка = все расходы
-- за месяц, делённые на проданные часы того же месяца. Ниже неё каждый
-- час работы уносит деньги, сколько бы их ни приходило на счёт.
--
-- Витрина отдаёт только ФАКТЫ по месяцам. «Что если» считает панель: это
-- разговор с самим собой, ему нечего делать в базе.

drop view if exists app.v_rate_health cascade;
create view app.v_rate_health with (security_invoker = true) as
with money as (
  select date_trunc('month', e.entry_date)::date as month, e.tenant_id,
         coalesce(sum(case when a.kind = 'income'
                           then case when p.side = 'cr' then p.amount else -p.amount end
                      end), 0) as income,
         coalesce(sum(case when a.kind = 'expense'
                           then case when p.side = 'dr' then p.amount else -p.amount end
                      end), 0) as expenses
    from acc.entry e
    join acc.posting p on p.entry_id = e.id
    join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
   where e.status = 'posted' and a.kind in ('income','expense')
   group by 1, 2
),
work as (
  select date_trunc('month', te.started_at)::date as month, te.tenant_id,
         sum(te.minutes) / 60.0                                   as hours_total,
         sum(te.minutes) filter (where te.billable) / 60.0        as hours_billable,
         count(distinct date_trunc('day', te.started_at))         as work_days
    from crm.time_entry te
   group by 1, 2
)
select coalesce(m.month, w.month)         as month,
       coalesce(m.tenant_id, w.tenant_id) as tenant_id,
       coalesce(m.income, 0)              as income,
       coalesce(m.expenses, 0)            as expenses,
       coalesce(m.income, 0) - coalesce(m.expenses, 0) as profit,
       round(coalesce(w.hours_total, 0)::numeric, 1)    as hours_total,
       round(coalesce(w.hours_billable, 0)::numeric, 1) as hours_billable,
       coalesce(w.work_days, 0)                         as work_days,

       -- Оплачиваемая загрузка: какая доля отработанного вообще продана.
       round(100.0 * coalesce(w.hours_billable, 0) / nullif(w.hours_total, 0), 0)
         as billable_pct,

       -- Себестоимость проданного часа. Она же — минимальная ставка:
       -- ниже неё час работы уносит деньги.
       round(coalesce(m.expenses, 0) / nullif(w.hours_billable, 0), 0)
         as cost_per_hour,

       -- Фактическая средняя ставка: что в самом деле получилось, а не прайс.
       round(coalesce(m.income, 0) / nullif(w.hours_billable, 0), 0)
         as actual_rate,

       round((coalesce(m.income, 0) - coalesce(m.expenses, 0))
             / nullif(w.hours_billable, 0), 0) as margin_per_hour,

       -- Сколько часов надо было продать по своей же средней ставке, чтобы
       -- выйти в ноль. Больше отработанного — месяц закрыт в убыток.
       round(coalesce(m.expenses, 0)
             / nullif(coalesce(m.income, 0) / nullif(w.hours_billable, 0), 0), 1)
         as breakeven_hours
  from money m
  full join work w on w.month = m.month and w.tenant_id = m.tenant_id;

comment on view app.v_rate_health is
  'По месяцам: расходы, проданные часы, оплачиваемая загрузка, себестоимость и фактическая ставка часа.';

grant select on app.v_rate_health to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on app.v_rate_health to authenticated';
  end if;
end $$;

-- ── Средние за последние месяцы ─────────────────────────────────────────────
--
-- Один месяц ничего не говорит: в нём мог быть один крупный счёт или
-- отпуск. Решение о ставке принимается по нескольким месяцам, поэтому
-- отдельная витрина со средними — чтобы панель не считала их сама и не
-- разошлась с базой в способе счёта.

drop view if exists app.v_rate_baseline cascade;
create view app.v_rate_baseline with (security_invoker = true) as
with recent as (
  select * from app.v_rate_health
   where month >= (date_trunc('month', now()) - interval '3 months')::date
     and month < date_trunc('month', now())::date
)
select tenant_id,
       count(*)                                          as months,
       round(avg(expenses), 0)                           as avg_expenses,
       round(avg(hours_billable)::numeric, 1)            as avg_hours_billable,
       round(avg(hours_total)::numeric, 1)               as avg_hours_total,
       round(avg(billable_pct))                          as avg_billable_pct,
       round(sum(expenses) / nullif(sum(hours_billable), 0), 0) as cost_per_hour,
       round(sum(income)   / nullif(sum(hours_billable), 0), 0) as actual_rate
  from recent
 group by tenant_id;

comment on view app.v_rate_baseline is
  'Средние за три полных месяца до текущего: основа для решения о ставке. Текущий месяц исключён — он ещё не закрыт.';

grant select on app.v_rate_baseline to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on app.v_rate_baseline to authenticated';
  end if;
end $$;
