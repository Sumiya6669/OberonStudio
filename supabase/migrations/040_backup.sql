-- 040. Резервная копия, которую проверяют.
--
-- Копия, которую ни разу не разворачивали, — это надежда, а не копия. Узнать,
-- что она не годится, можно двумя способами: учением в спокойный день или
-- в тот единственный день, когда она понадобилась. Второй способ обходится
-- дороже ровно на всё.
--
-- Поэтому здесь не «выгрузка», а три вещи вместе: снять, развернуть обратно
-- в отдельную схему, сверить число строк по каждой таблице. В подпись к файлу
-- идёт результат сверки, а не слово «готово».
--
-- Чего в копии НЕТ и почему. Структуры: её восстанавливает цепочка миграций,
-- она лежит в репозитории и воспроизводится по порядку. Дублировать её в файле
-- значит завести второй источник правды о схеме, который однажды разойдётся
-- с первым.
--
-- Список таблиц копия берёт из самой базы, а не из перечисления в коде. Новая
-- таблица попадает в копию сама. Забытая обнаруживается при восстановлении,
-- то есть в самый неудачный момент.
--
-- Файл содержит персональные данные: имена, почты, телефоны, переписку по
-- заявкам. Это свойство любой честной копии, но помнить о нём надо, когда
-- решаете, куда её класть.

-- ── 1. Что копируем ─────────────────────────────────────────────────────────
--
-- Обычные и партиционированные таблицы наших схем. Разделы пропускаем: они
-- читаются через родителя, и копировать их отдельно значит удвоить данные.

create or replace function core.backup_tables()
returns table (sch text, tbl text)
language sql stable security definer set search_path = pg_catalog, public
as $$
  select n.nspname::text, c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p')
     and n.nspname in ('core', 'crm', 'acc', 'cms', 'dev', 'mem', 'bot')
     and not exists (select 1 from pg_inherits i where i.inhrelid = c.oid)
   order by 1, 2
$$;

comment on function core.backup_tables() is
  'Таблицы, попадающие в резервную копию. Список из базы, а не из кода.';

-- ── 2. Сколько строк где ────────────────────────────────────────────────────

create or replace function core.row_counts() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare r record; n bigint; out jsonb := '{}'::jsonb;
begin
  for r in select * from core.backup_tables() loop
    execute format('select count(*) from %I.%I', r.sch, r.tbl) into n;
    out := out || jsonb_build_object(r.sch || '.' || r.tbl, n);
  end loop;
  return out;
end $$;

-- ── 3. Снять копию ──────────────────────────────────────────────────────────

create or replace function core.backup_json() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare r record; rows jsonb; data jsonb := '{}'::jsonb; cnt int := 0;
begin
  for r in select * from core.backup_tables() loop
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from %I.%I t', r.sch, r.tbl)
       into rows;
    data := data || jsonb_build_object(r.sch || '.' || r.tbl, rows);
    cnt := cnt + 1;
  end loop;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'taken_at', to_char(now() at time zone 'Asia/Almaty', 'YYYY-MM-DD HH24:MI'),
      'tables', cnt,
      'note', 'Структура восстанавливается миграциями. Здесь только данные.'),
    'data', data);
end $$;

comment on function core.backup_json() is
  'Данные всех таблиц одним объектом. Структура — дело миграций.';

-- ── 4. Учение по восстановлению ─────────────────────────────────────────────
--
-- Разворачивается ТОТ ЖЕ объект, который уходит в файл, а не отдельный снимок:
-- иначе проверяли бы не то, что отдали. В отдельную схему со случайным именем,
-- которая тут же удаляется; рабочие данные учение не трогает вовсе.
--
-- ВАЖНОЕ ПРО ТО, ЧТО ИМЕННО ЗДЕСЬ ПРОВЕРЯЕТСЯ.
--
-- Первая версия сверяла число строк в файле с числом строк, восстановленных из
-- этого же файла. Прогон показал, чего такая сверка стоит: из копии выбросили
-- строки — учение сказало «пройдено»; из копии убрали таблицу целиком — снова
-- «пройдено». И правильно сказало: файл разворачивался полностью. Вопрос был
-- не тот. «Файл разворачивается» и «файл содержит вашу базу» — разные
-- утверждения, и нужно второе.
--
-- Поэтому сверок две:
--
--   восстановимость — сколько строк в файле против того, сколько легло
--                     обратно. Ловит типы, не пережившие json, и порчу файла;
--   полнота         — сколько строк в файле против того, сколько их в базе.
--                     Ловит таблицу, которая не попала в копию, и молчаливую
--                     потерю строк.
--
-- Полнота проверяется только если ей передали счёт строк. Счёт надо брать
-- В ТОМ ЖЕ ЗАПРОСЕ, что и копию: тогда обе функции видят один снимок данных, и
-- запись, сделанная между ними, не поднимет ложную тревогу. Сценарий так и
-- делает. Не передали счёт — полнота честно помечается непроверенной, а не
-- считается пройденной.

create or replace function core.restore_drill(p jsonb, p_counts jsonb default null)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_schema text := '_drill_' || substr(md5(random()::text), 1, 8);
  r        record;
  v_key    text;
  v_rows   jsonb;
  v_copy   text;
  v_in     int;
  v_out    bigint;
  v_live   bigint;
  v_row_ok boolean;
  v_detail jsonb := '[]'::jsonb;
  v_restorable boolean := true;
  v_complete   boolean := true;
  v_total  bigint := 0;
  v_tables int := 0;
  v_start  timestamptz := clock_timestamp();
begin
  execute format('create schema %I', v_schema);

  for r in select * from core.backup_tables() loop
    v_key  := r.sch || '.' || r.tbl;
    v_rows := coalesce(p->'data'->v_key, '[]'::jsonb);
    v_in   := jsonb_array_length(v_rows);
    -- Точка в имени таблицы потребовала бы кавычек в каждом обращении;
    -- подчёркивание дешевле и однозначно.
    v_copy := r.sch || '_' || r.tbl;

    execute format('create table %I.%I as select * from %I.%I with no data',
                   v_schema, v_copy, r.sch, r.tbl);

    if v_in > 0 then
      execute format(
        'insert into %I.%I select * from jsonb_populate_recordset(null::%I.%I, $1)',
        v_schema, v_copy, r.sch, r.tbl) using v_rows;
    end if;

    execute format('select count(*) from %I.%I', v_schema, v_copy) into v_out;

    if v_out <> v_in then
      v_restorable := false;
    end if;

    -- Полнота: столько ли строк в файле, сколько их в базе.
    v_live := null;
    if p_counts is not null and p_counts ? v_key then
      v_live := (p_counts->>v_key)::bigint;
      if v_live <> v_in then
        v_complete := false;
      end if;
    end if;

    v_row_ok := v_out = v_in and (v_live is null or v_live = v_in);

    v_detail := v_detail || jsonb_build_object(
      'table', v_key,
      'in_base', v_live,
      'in_backup', v_in,
      'restored', v_out,
      'ok', v_row_ok);
    v_total  := v_total + v_out;
    v_tables := v_tables + 1;
  end loop;

  -- Таблица, появившаяся в базе после того, как файл сняли, в цикл выше не
  -- попадёт по данным, но попадёт по списку — а вот ключ в файле, которому не
  -- соответствует ни одна таблица, означает, что таблицу удалили или
  -- переименовали. Молчать об этом нельзя: при восстановлении эти данные
  -- окажется некуда класть.
  for v_key in
    select key from jsonb_object_keys(coalesce(p->'data', '{}'::jsonb)) key
    except
    select sch || '.' || tbl from core.backup_tables()
  loop
    v_complete := false;
    v_detail := v_detail || jsonb_build_object(
      'table', v_key, 'in_base', null, 'in_backup',
      jsonb_array_length(p->'data'->v_key), 'restored', 0, 'ok', false,
      'note', 'в файле есть, в базе такой таблицы нет');
  end loop;

  execute format('drop schema %I cascade', v_schema);

  return jsonb_build_object(
    'ok', v_restorable and v_complete,
    'restorable', v_restorable,
    'complete', case when p_counts is null then null else v_complete end,
    'tables', v_tables,
    'rows_restored', v_total,
    'seconds', round(extract(epoch from clock_timestamp() - v_start)::numeric, 1),
    'detail', v_detail);

exception when others then
  -- Схема учения не должна пережить неудачу: иначе следующая попытка
  -- упрётся в мусор от предыдущей.
  execute format('drop schema if exists %I cascade', v_schema);
  return jsonb_build_object('ok', false, 'restorable', false,
                            'error', sqlerrm, 'detail', v_detail);
end $$;

comment on function core.restore_drill(jsonb, jsonb) is
  'Разворачивает копию в отдельную схему. Сверяет восстановимость (файл против себя) и полноту (файл против базы). Рабочие данные не трогает.';

drop function if exists core.restore_drill(jsonb);

-- Доступ только раннеру и сценариям: это полный слепок базы, включая
-- переписку и контакты. В браузер такому попадать незачем.
revoke all on function core.backup_json()   from public;
revoke all on function core.row_counts()    from public;
revoke all on function core.restore_drill(jsonb, jsonb) from public;
revoke all on function core.backup_tables() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'jarvis_worker') then
    execute 'grant execute on function core.backup_tables(), core.row_counts(),
             core.backup_json(), core.restore_drill(jsonb, jsonb) to jarvis_worker';
  end if;
end $$;

-- ── 5. Учение прямо сейчас ──────────────────────────────────────────────────
-- Миграция, которая заводит проверку и не проводит её ни разу, ничем не лучше
-- копии, которую не разворачивали.

do $$
declare v jsonb; c jsonb; d jsonb;
begin
  -- Копия и счёт строк берутся рядом, как это делает сценарий: обе функции
  -- помечены stable и в одном операторе видят один и тот же снимок.
  select core.backup_json(), core.row_counts() into v, c;
  d := core.restore_drill(v, c);

  if (d->>'ok')::boolean then
    raise notice 'учение пройдено: таблиц %, строк %, за % с (восстановимость и полнота)',
                 d->>'tables', d->>'rows_restored', d->>'seconds';
  else
    raise exception 'учение НЕ пройдено: %', coalesce(d->>'error', d::text);
  end if;
end $$;
