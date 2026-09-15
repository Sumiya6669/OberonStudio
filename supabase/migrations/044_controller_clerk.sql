-- 044. Контролёр и Приказчик получают работу.
--
-- Две записи в списке агентов до сих пор ничего не делали: Контролёр и
-- Приказчик числились, но ни одного задания им не полагалось. Система,
-- в которой агент есть в реестре и не существует в жизни, врёт о себе —
-- это ровно то, за что ругали Вестника до миграции 036.
--
-- Почему у обоих нет модели. Оба отвечают на вопросы, у которых есть
-- однозначный ответ в базе: «что просрочено» и «что осталось выставить».
-- Спрашивать это у модели — платить деньги за возможность получить
-- правдоподобную выдумку вместо счёта строк. Модель нужна там, где нужно
-- СУЖДЕНИЕ; здесь нужен пересчёт, а пересчитывать умеет SQL.
--
-- Контролёр (раз в неделю): проходит по обещаниям, которые система даёт
-- о себе, и показывает нарушенные. Пустой отчёт — нормальный отчёт.
-- Приказчик (первого числа): говорит, что нужно сделать, чтобы закрыть
-- прошлый месяц. Ничего не выставляет сам: счёт выставляет человек.

-- ── 0. Деньги словами человека ──────────────────────────────────────────────
-- to_char в локали C отдаёт «36,000.00». Для отчёта на русском нужно
-- «36 000,00»: разряды пробелом, копейки запятой.

create or replace function core.money(p numeric)
returns text language sql immutable
as $$ select case when p is null then '—'
              else translate(to_char(p, 'FM999G999G999G990D00'), ',.', ' ,') end $$;

comment on function core.money(numeric) is
  'Сумма для отчёта: разряды пробелом, копейки запятой. NULL — прочерк, а не ноль.';

-- ── 1. Самопроверка ─────────────────────────────────────────────────────────

create or replace function core.self_check(p_tenant uuid default null)
returns table (code text, title text, severity text, n int, detail text)
language sql stable security definer
set search_path = core, crm, acc, public, pg_temp
as $$
with t as (select coalesce(p_tenant, core.my_tenant()) as id),
m as (select date_trunc('month', current_date - interval '1 month')::date as m_from,
             date_trunc('month', current_date)::date as m_to)
-- 1. Задания, которые срываются раз за разом.
select 'job_failing', 'Задания падают повторно или брошены', 'high',
       count(*)::int,
       string_agg(distinct j.job_type || ' (' || j.status || ', попыток ' || j.attempts || ')', ', ')
  from core.job j, t
 where j.tenant_id = t.id
   and (j.status = 'dead' or (j.status in ('queued','failed') and j.attempts >= 3))
union all
-- 2. Задание в состоянии «идёт», у которого истекла аренда. Такое закрывает
--    Сторож; если оно тут — значит Сторож не работает.
select 'job_stuck', 'Задания зависли: аренда истекла, а Сторож не прибрал', 'high',
       count(*)::int,
       string_agg(j.id::text, ', ')
  from core.job j, t
 where j.tenant_id = t.id and j.status = 'leased'
   and j.lease_until is not null and j.lease_until < now() - interval '15 minutes'
union all
-- 3. Обещанный срок первого ответа нарушен.
select 'sla_first_reply', 'Просрочен срок первого ответа', 'high',
       count(*)::int,
       string_agg('#' || tk.id || ' ' || left(tk.subject, 40), '; ')
  from crm.ticket tk, t
 where tk.tenant_id = t.id and tk.first_reply_at is null
   and tk.react_by is not null and tk.react_by < now()
   and tk.status not in ('done','cancelled')
union all
-- 4. Заявка в работе, по которой давно ничего не происходило.
select 'ticket_silent', 'Заявки в работе без движения больше недели', 'medium',
       count(*)::int,
       string_agg('#' || tk.id || ' ' || left(tk.subject, 40), '; ')
  from crm.ticket tk, t
 where tk.tenant_id = t.id and tk.status in ('triaged','estimated','approved','in_work')
   and tk.updated_at < now() - interval '7 days'
union all
-- 5. Черновики учёта, которые никто не провёл.
select 'acc_drafts', 'Черновики учёта не проведены больше двух недель', 'medium',
       count(*)::int,
       string_agg(e.id || ' ' || left(coalesce(e.memo,''), 30), '; ')
  from acc.entry e, t
 where e.tenant_id = t.id and e.status = 'draft'
   and e.entry_date < current_date - 14
union all
-- 6. Отработанные и не выставленные часы прошлого месяца.
select 'hours_unbilled', 'Часы прошлого месяца не выставлены', 'high',
       case when coalesce(sum(te.minutes), 0) = 0 then 0 else 1 end,
       case when coalesce(sum(te.minutes), 0) = 0 then null
            else round(sum(te.minutes) / 60.0, 1) || ' ч' end
  from crm.time_entry te, t, m
 where te.tenant_id = t.id and te.billable and te.invoiced_in is null
   and te.started_at >= m.m_from and te.started_at < m.m_to
union all
-- 7. Счета, срок оплаты которых прошёл.
select 'doc_overdue', 'Счета просрочены', 'high',
       count(*)::int,
       string_agg(d.number || ' — ' || core.money(d.amount) || ' ' || d.currency, '; ')
  from crm.doc d, t
 where d.tenant_id = t.id and d.kind = 'invoice'
   and d.status in ('issued','partly_paid','overdue')
   and d.due_on < current_date
union all
-- 8. Эскалации, на которые никто не ответил.
select 'escalation_open', 'Эскалации без ответа больше суток', 'high',
       count(*)::int,
       string_agg(e.kind || ': ' || left(coalesce(e.summary,''), 40), '; ')
  from core.escalation e, t
 where e.tenant_id = t.id and e.status = 'open'
   and e.created_at < now() - interval '1 day'
union all
-- 9. Владелец, которому Вестник не может написать.
select 'owner_unreachable', 'Владельцу некуда слать уведомления', 'high',
       count(*)::int,
       string_agg(p.full_name, ', ')
  from core.person p
  join core.person_role r on r.person_id = p.id
  cross join t
 where p.tenant_id = t.id and r.role_code = 'owner'
   and p.is_active and p.tg_chat_id is null
union all
-- 10. Агент, чьи предложения перестали принимать.
select 'agent_rejected', 'Предложения агента отклоняют чаще, чем принимают', 'medium',
       count(*)::int,
       string_agg(a.agent_kind || '/' || a.action_type, ', ')
  from core.autonomy_stat a, t
 where a.tenant_id = t.id
   and a.total_approved + a.total_edited + a.total_rejected >= 5
   and a.total_rejected > a.total_approved
$$;

comment on function core.self_check(uuid) is
  'Проверки, которые система обязана проходить сама. Строка в ответе = нарушенное обещание.';

-- ── 2. Отчёт Контролёра текстом ─────────────────────────────────────────────

create or replace function core.self_check_text(p_tenant uuid default null)
returns text
language plpgsql stable security definer
set search_path = core, public, pg_temp
as $$
declare
  v_tenant uuid := coalesce(p_tenant, core.my_tenant());
  r record;
  v_out text := '';
  v_bad int := 0;
begin
  for r in select * from core.self_check(v_tenant) where n > 0 order by
             case severity when 'high' then 1 else 2 end, code
  loop
    v_bad := v_bad + 1;
    v_out := v_out
      || case r.severity when 'high' then '❗ ' else '• ' end
      || core.tg_escape(r.title) || ': <b>' || r.n || '</b>'
      || coalesce(E'\n   <i>' || core.tg_escape(left(r.detail, 300)) || '</i>', '')
      || E'\n';
  end loop;

  if v_bad = 0 then
    return '<b>Контролёр</b>' || E'\n' ||
           'Проверено ' || (select count(*) from core.self_check(v_tenant)) ||
           ' обещаний, нарушенных нет.';
  end if;

  return '<b>Контролёр</b>' || E'\n' ||
         'Нарушено обещаний: ' || v_bad || ' из ' ||
         (select count(*) from core.self_check(v_tenant)) || E'\n\n' || v_out;
end $$;

comment on function core.self_check_text(uuid) is
  'Отчёт самопроверки для Telegram. Пустой отчёт — нормальный отчёт.';

-- ── 3. Приказчик: что нужно, чтобы закрыть месяц ────────────────────────────

create or replace function crm.month_prep_text(p_month date default null)
returns text
language plpgsql stable security definer
set search_path = crm, acc, app, core, public, pg_temp
as $$
declare
  v_month date := date_trunc('month',
                    coalesce(p_month, current_date - interval '1 month'))::date;
  c record;
  r record;
  v_out text;
  v_list text := '';
  v_n int := 0;
begin
  select * into c from app.month_close(v_month);

  v_out := '<b>Приказчик</b>' || E'\n' ||
           'Закрываем ' || to_char(v_month, 'MM.YYYY') || E'\n\n' ||
           'Отработано: ' || c.hours_total || ' ч, из них оплачиваемых ' ||
             c.hours_billable || ' ч' || E'\n' ||
           'Расходов внесено: ' || c.expenses_count || ' на ' ||
             core.money(c.expenses_amount) || E'\n';

  -- Без внесённых расходов себестоимость часа равна нулю арифметически,
  -- но не по смыслу. Ноль здесь выглядел бы как посчитанная цифра, а это
  -- просто пустая графа, поэтому строки нет вовсе.
  if c.expenses_count > 0 then
    v_out := v_out || 'Себестоимость часа: ' || core.money(c.cost_per_hour) ||
             ', фактическая ставка: ' || core.money(c.actual_rate) || E'\n';
  end if;

  v_out := v_out || E'\n<b>Что сделать</b>\n';

  if c.acc_drafts > 0 then
    v_n := v_n + 1;
    v_out := v_out || v_n || '. Провести черновики учёта: ' || c.acc_drafts || E'\n';
  end if;

  for r in select * from app.month_close_subs(v_month) where invoice_id is null loop
    v_n := v_n + 1;
    v_list := v_list || v_n || '. Выставить абонемент «' || core.tg_escape(r.title) ||
              '» для ' || core.tg_escape(r.company) || ': ' ||
              core.money(r.amount_preview) || E'\n';
  end loop;
  v_out := v_out || v_list;
  v_list := '';

  for r in select * from app.month_close_hours(v_month) loop
    v_n := v_n + 1;
    v_list := v_list || v_n || '. Выставить часы: ' || core.tg_escape(r.company) ||
              ' — ' || r.hours || ' ч, примерно ' ||
              core.money(r.amount_preview) || E'\n';
  end loop;
  v_out := v_out || v_list;

  if c.expenses_count = 0 then
    v_n := v_n + 1;
    v_out := v_out || v_n ||
             '. Внести расходы месяца — без них себестоимость часа посчитать не из чего' || E'\n';
  end if;

  if v_n = 0 then
    v_out := v_out || 'Ничего. Месяц закрыт.' || E'\n';
  end if;

  if c.docs_unpaid > 0 then
    v_out := v_out || E'\n' || 'Не оплачено счетов: ' || c.docs_unpaid || ' на ' ||
             core.money(c.docs_unpaid_amount);
  end if;

  v_out := v_out || E'\n\n<i>Счёт выставляет человек. Приказчик только считает.</i>';
  return v_out;
end $$;

comment on function crm.month_prep_text(date) is
  'Список того, что осталось сделать для закрытия месяца. Ничего не выставляет сам.';

-- ── 4. Задания для обоих ────────────────────────────────────────────────────

insert into core.job_type (code, agent_kind, title, est_cost_usd, requires_payload)
values ('clerk.month_close', 'clerk', 'Сводка на закрытие месяца', 0, false)
on conflict (code) do update set agent_kind = excluded.agent_kind,
                                 title     = excluded.title,
                                 est_cost_usd = excluded.est_cost_usd;

-- Контролёру модель тоже не нужна: он считает строки, а не рассуждает.
update core.job_type set est_cost_usd = 0 where code = 'controller.weekly';

-- ── 5. Права ────────────────────────────────────────────────────────────────

revoke all on function core.money(numeric)         from public, anon;
revoke all on function core.self_check(uuid)       from public, anon, authenticated;
revoke all on function core.self_check_text(uuid)  from public, anon, authenticated;
revoke all on function crm.month_prep_text(date)   from public, anon, authenticated;

grant execute on function core.money(numeric)       to jarvis_worker;
grant execute on function core.self_check(uuid)      to jarvis_worker;
grant execute on function core.self_check_text(uuid) to jarvis_worker;
grant execute on function crm.month_prep_text(date)  to jarvis_worker;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    -- Владельцу эти отчёты видеть можно: они про его собственную студию.
    execute 'grant execute on function core.self_check(uuid) to authenticated';
    execute 'grant execute on function core.self_check_text(uuid) to authenticated';
    execute 'grant execute on function crm.month_prep_text(date) to authenticated';
  end if;
end $$;
