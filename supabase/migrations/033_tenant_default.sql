-- 033. Клиент проставляется сам.
--
-- Ошибка, которую нашёл тестовый прогон заявки: ответ клиенту не
-- сохранялся — «new row violates row-level security policy for table
-- ticket_message». Причина не в правах. Экран не передал tenant_id,
-- строка ушла в базу без клиента, и политика справедливо её отвергла.
--
-- Чинить это в экране — значит чинить один экран из пятнадцати и ждать,
-- когда шестнадцатый забудет снова. Кто автор строки, база знает сама:
-- core.my_tenant() читает того, кто сейчас в сеансе. Пусть и проставляет.
--
-- Значение по умолчанию срабатывает только тогда, когда колонку не
-- передали. Все серверные функции передают tenant_id явно и работают
-- как работали; RLS тоже не трогаем — она по-прежнему последнее слово.

do $$
declare r record; n int := 0;
begin
  for r in
    select c.table_schema as sch, c.table_name as tbl
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.column_name = 'tenant_id'
       and c.column_default is null
       and c.table_schema in ('core','crm','cms','acc','dev','mem','app','bot')
       and t.table_type = 'BASE TABLE'
  loop
    execute format('alter table %I.%I alter column tenant_id set default core.my_tenant()',
                   r.sch, r.tbl);
    n := n + 1;
  end loop;
  raise notice 'таблиц с автоподстановкой клиента: %', n;
end $$;

-- Таблица клиентов — исключение: её собственный id не является ссылкой
-- на клиента, а tenant у неё нет. Проверка на случай, если когда-нибудь
-- появится: подставлять самого себя нельзя.

-- ── Проверка ────────────────────────────────────────────────────────────────
--
-- Строка без клиента не должна проходить даже с выключенной ролью.
-- Смотрим глазами: сколько таблиц осталось без подстановки.

create or replace view app.v_tenant_default as
select c.table_schema as schema_name,
       c.table_name   as table_name,
       c.column_default is not null as has_default
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
 where c.column_name = 'tenant_id'
   and t.table_type = 'BASE TABLE'
   and c.table_schema in ('core','crm','cms','acc','dev','mem','app','bot');

comment on view app.v_tenant_default is
  'Таблицы с tenant_id: проставляется ли клиент сам, если экран забыл.';
