-- 026. Дыра в изоляции клиентов: разделы журнала были открыты напрямую.
--
-- Что нашлось. Журнал `core.action_log` и учёт расхода `core.usage_event`
-- разбиты на разделы по месяцам. RLS включён на РОДИТЕЛЬСКОЙ таблице, и
-- через неё всё работает правильно: клиент видит только свои строки.
--
-- Но PostgreSQL не применяет политики родителя к обращению НАПРЯМУЮ в
-- раздел. А раздел — обычная таблица в схеме `core`, которая открыта
-- в Data API, и права на неё выдавались командой «на все таблицы схемы».
--
-- Проверка на чистой базе, два клиента, по одной записи каждому:
--
--   select count(*) from core.action_log              → 1   (правильно)
--   select count(*) from core.action_log_2026m09      → 2   (чужая запись)
--
-- То есть любой вошедший в панель мог прочитать журнал действий другого
-- клиента, обратившись к разделу по имени. Пока клиент один, это ничего
-- не значит; со вторым это утечка. Панель при этом показывала «ни одной
-- таблицы без разграничения доступа» — потому что её проверка исключала
-- разделы из подсчёта, и об этом никто не узнал бы.
--
-- Закрывается тремя способами сразу, потому что цена ошибки высокая:
--
--   1. RLS и политика на каждом существующем разделе;
--   2. права на разделы отзываются — приложение обращается только к
--      родителю, и напрямую разделы ему не нужны. Для партиционированной
--      таблицы права проверяются на той таблице, что названа в запросе,
--      поэтому чтение через родителя от этого не страдает;
--   3. функции создания разделов делают то же самое для будущих месяцев —
--      иначе через год появится новый открытый раздел, и всё вернётся.
--
-- И четвёртое: проверка в панели начинает считать разделы. Диагностика,
-- которая молчит о настоящей дыре, хуже отсутствия диагностики.

-- ── 1 и 2. Существующие разделы ─────────────────────────────────────────────

do $$
declare r record; rl text; roles text[] := array['authenticated','jarvis_worker'];
begin
  for r in
    select c.oid, c.relname, c.relnamespace::regnamespace::text as sch
      from pg_class c
      join pg_inherits i on i.inhrelid = c.oid
      join pg_class p on p.oid = i.inhparent
     where c.relkind = 'r'
       and p.relname in ('action_log','usage_event')
       and p.relnamespace::regnamespace::text = 'core'
  loop
    execute format('alter table %I.%I enable row level security', r.sch, r.relname);
    execute format('alter table %I.%I force row level security', r.sch, r.relname);

    foreach rl in array roles loop
      if exists (select 1 from pg_roles where rolname = rl) then
        execute format('drop policy if exists %I on %I.%I',
                       r.relname || '_' || rl, r.sch, r.relname);
        execute format(
          'create policy %I on %I.%I for all to %I using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())',
          r.relname || '_' || rl, r.sch, r.relname, rl);
      end if;
    end loop;

    -- Прямой доступ к разделу приложению не нужен ни в одном месте.
    foreach rl in array array['authenticated','anon','jarvis_worker'] loop
      if exists (select 1 from pg_roles where rolname = rl) then
        execute format('revoke all on %I.%I from %I', r.sch, r.relname, rl);
      end if;
    end loop;
  end loop;
end $$;

-- ── 3. Будущие разделы ──────────────────────────────────────────────────────
--
-- Обе функции переписываются целиком: закрывать раздел надо в тот же
-- момент, когда он создаётся. Отдельным шагом «не забыть потом» — значит
-- однажды забыть.

create or replace function core.partition_seal(p_schema text, p_table text)
returns void language plpgsql as $$
declare rl text;
begin
  execute format('alter table %I.%I enable row level security', p_schema, p_table);
  execute format('alter table %I.%I force row level security', p_schema, p_table);

  foreach rl in array array['authenticated','jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('drop policy if exists %I on %I.%I', p_table || '_' || rl, p_schema, p_table);
      execute format(
        'create policy %I on %I.%I for all to %I using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())',
        p_table || '_' || rl, p_schema, p_table, rl);
    end if;
  end loop;

  foreach rl in array array['authenticated','anon','jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('revoke all on %I.%I from %I', p_schema, p_table, rl);
    end if;
  end loop;
end $$;

comment on function core.partition_seal(text, text) is
  'Закрывает раздел партиционированной таблицы: RLS, политика по клиенту и отзыв прямых прав.';

create or replace function core.action_log_ensure_partitions(p_months int default 12)
returns int language plpgsql as $$
declare i int; d date; nm text; cnt int := 0;
begin
  for i in 0 .. p_months loop
    d  := (date_trunc('month', current_date) + make_interval(months => i))::date;
    nm := format('action_log_%sm%s', to_char(d,'YYYY'), to_char(d,'MM'));
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'core' and c.relname = nm) then
      execute format(
        'create table core.%I partition of core.action_log for values from (%L) to (%L)',
        nm, d, (d + interval '1 month')::date);
      -- Сразу, а не потом: раздел без политики читается напрямую в обход
      -- родителя, и это утечка между клиентами.
      perform core.partition_seal('core', nm);
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end $$;

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
      perform core.partition_seal('core', nm);
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end $$;

-- ── 4. Проверка в панели начинает видеть разделы ─────────────────────────────

drop view if exists app.v_system_health cascade;
create view app.v_system_health with (security_invoker = true) as
select
  -- Разделы журнала и расхода на месяцы вперёд. Кончились разделы — запись
  -- в журнал начнёт падать, а падение записи в журнал заметят последним.
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core' and c.relname like 'action_log_%'
      and c.relname >= 'action_log_' || to_char(current_date, 'YYYY"m"MM'))
                                                              as log_partitions_ahead,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core' and c.relname like 'usage_event_%'
      and c.relname >= 'usage_event_' || to_char(current_date, 'YYYY"m"MM'))
                                                              as usage_partitions_ahead,
  -- Таблицы с tenant_id без включённого RLS: должно быть 0 всегда.
  --
  -- Разделы больше НЕ исключаются из подсчёта. Прежняя версия их
  -- пропускала и поэтому показывала ноль в то время, когда журнал одного
  -- клиента читался другим напрямую через раздел. Проверка, молчащая о
  -- настоящей дыре, вреднее отсутствующей.
  (select count(*) from pg_class c
    where c.relkind in ('r','p')
      and c.relnamespace::regnamespace::text in ('core','crm','dev','mem','acc','cms')
      and exists (select 1 from pg_attribute a where a.attrelid = c.oid
                    and a.attname = 'tenant_id' and a.attnum > 0 and not a.attisdropped)
      and not c.relrowsecurity)                               as tables_without_rls,
  (select count(*) from pg_policies
    where schemaname in ('core','crm','dev','mem','acc','cms'))
                                                              as policies_total,
  (select count(*) from core.job where status = 'leased' and lease_until < now())
                                                              as leases_expired,
  (select round(extract(epoch from (now() - min(created_at))) / 60)::int
     from core.job where status in ('queued','failed'))       as oldest_wait_min,
  (select count(*) from core.job where status = 'dead'
     and finished_at >= now() - interval '7 days')            as jobs_dead_week,
  (select count(*) from core.escalation where status = 'open') as escalations_open,
  (select count(*) from core.approval where status = 'pending') as approvals_pending,
  (select count(*) from core.approval
    where status = 'pending' and expires_at < now())          as approvals_overdue,
  (select max(at) from core.action_log where actor_ref like 'pc:%')
                                                              as runner_last_seen,
  (select count(*) from core.action_log where at >= date_trunc('month', current_date))
                                                              as log_rows_month,
  (select count(*) from core.action_log
    where outcome = 'refused' and at >= now() - interval '7 days')
                                                              as refusals_week,
  (select count(*) from core.action_log
    where outcome = 'error' and at >= now() - interval '7 days')
                                                              as errors_week,
  (select count(*) from acc.entry where status = 'draft')     as acc_drafts,
  (select count(*) from cms.page where status = 'draft')      as cms_page_drafts,
  (select count(*) from cms.item where status = 'draft')      as cms_item_drafts,
  (select count(*) from dev.config_snapshot where stale)      as configs_stale,
  (select count(*) from dev.config_snapshot where indexed_at is null) as configs_unindexed;

comment on view app.v_system_health is
  'Состояние системы: разделы вперёд, незакрытые таблицы, брошенные аренды, отказы и ошибки.';

grant select on app.v_system_health to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on app.v_system_health to authenticated';
  end if;
end $$;
