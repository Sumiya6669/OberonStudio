-- 008. Разграничение доступа. Политики создаются генератором, а не руками:
-- забыть таблицу невозможно, и критерий К-2 это проверяет запросом.

-- Права на объекты. Строки всё равно отсекает RLS.
grant usage on schema core, crm, dev, mem to jarvis_worker;
grant select, insert, update, delete on all tables in schema core, crm, dev, mem
  to jarvis_worker;
grant usage, select on all sequences in schema core, crm, dev, mem to jarvis_worker;
grant execute on all functions in schema core, crm, dev, mem to jarvis_worker;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema core, crm, dev, mem to authenticated';
    execute 'grant select, insert, update, delete on all tables in schema core, crm, dev, mem to authenticated';
    execute 'grant usage, select on all sequences in schema core, crm, dev, mem to authenticated';
    execute 'grant execute on all functions in schema core, crm, dev, mem to authenticated';
  end if;
end $$;

-- Журнал только дописывается — снимаем права после общей выдачи.
revoke update, delete, truncate on core.action_log from jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke update, delete, truncate on core.action_log from authenticated';
  end if;
end $$;

-- ── Генератор политик ────────────────────────────────────────────────────────
-- Для каждой таблицы с tenant_id: своя строка видна, чужая нет.
-- Разделы партиционированных таблиц пропускаются: они наследуют политику родителя.
do $$
declare r record; roles text[] := array['jarvis_worker','authenticated'];
        rl text; pol text;
begin
  for r in
    select c.relnamespace::regnamespace::text as sch, c.relname as tbl
      from pg_class c
     where c.relkind in ('r','p')
       and c.relnamespace::regnamespace::text in ('core','crm','dev','mem')
       and not exists (select 1 from pg_inherits i where i.inhrelid = c.oid)
       and exists (select 1 from pg_attribute a
                    where a.attrelid = c.oid and a.attname = 'tenant_id'
                      and a.attnum > 0 and not a.attisdropped)
     order by 1, 2
  loop
    execute format('alter table %I.%I enable row level security', r.sch, r.tbl);
    execute format('alter table %I.%I force row level security', r.sch, r.tbl);

    foreach rl in array roles loop
      if exists (select 1 from pg_roles where rolname = rl) then
        pol := format('%s_%s', r.tbl, rl);
        execute format('drop policy if exists %I on %I.%I', pol, r.sch, r.tbl);
        execute format(
          'create policy %I on %I.%I for all to %I using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())',
          pol, r.sch, r.tbl, rl);
      end if;
    end loop;
  end loop;
end $$;

-- Реестры без tenant_id: общие для всех, только чтение.
do $$
declare r record; roles text[] := array['jarvis_worker','authenticated']; rl text; pol text;
begin
  for r in
    select unnest(array['tenant','role','agent_kind','job_type','action_type','provider']) as tbl
  loop
    execute format('alter table core.%I enable row level security', r.tbl);
    foreach rl in array roles loop
      if exists (select 1 from pg_roles where rolname = rl) then
        pol := format('%s_read_%s', r.tbl, rl);
        execute format('drop policy if exists %I on core.%I', pol, r.tbl);
        execute format('create policy %I on core.%I for select to %I using (true)',
                       pol, r.tbl, rl);
      end if;
    end loop;
  end loop;
end $$;

-- core.tenant: свою строку видно, чужую нет
drop policy if exists tenant_read_authenticated on core.tenant;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create policy tenant_read_authenticated on core.tenant for select to authenticated using (id = core.my_tenant())';
  end if;
end $$;
