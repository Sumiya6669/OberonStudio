-- 035. Студия называется Tinker.
--
-- Сайт переименован, а база продолжала здороваться старым именем: бот в
-- приветствии незнакомому человеку и почта в настройках сайта.
--
-- Текст бота лежит внутри bot.render. Переписывать всю функцию ради одной
-- строки — значит рисковать остальными пятьюстами строками; поэтому берём её
-- собственное определение, меняем в нём только это имя и возвращаем обратно.
-- Так правка ровно там, где нужна, и нигде больше.

do $$
declare src text; out text; n int;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'bot' and p.proname = 'render';

  if src is null then
    raise notice 'bot.render не найдена — пропускаю';
    return;
  end if;

  out := replace(src, 'Oberon Studio', 'Tinker');
  n := (length(src) - length(out)) / (length('Oberon Studio') - length('Tinker'));

  if n = 0 then
    raise notice 'в тексте бота старого имени нет — менять нечего';
  else
    execute out;
    raise notice 'в тексте бота заменено вхождений: %', n;
  end if;
end $$;


-- ── Заодно: настройки сайта нельзя было сохранить ───────────────────────────
--
-- Нашлось при переименовании. Триггер ревизий определял ключ строки так:
--
--   v_id := case v_entity when 'settings' then old.tenant_id else old.id end;
--
-- Выглядит безобидно, но PL/pgSQL разбирает выражение целиком, вместе с той
-- веткой, которая не выполнится. У cms.settings колонки id нет — и разбор
-- падает с «record "old" has no field "id"». Любое обновление настроек сайта
-- отваливалось; проходило только самое первое сохранение, потому что это
-- вставка, а триггер висит на update и delete.
--
-- Лечится тем, что ветки разводятся оператором if: невыполненная ветка тогда
-- и не разбирается.

create or replace function cms.g_revision() returns trigger
language plpgsql security definer set search_path = cms, core, public
as $fn$
declare v_entity text; v_id uuid;
begin
  if tg_table_name = 'settings' then
    v_entity := 'settings';
    v_id     := old.tenant_id;
  else
    v_entity := tg_table_name;
    v_id     := old.id;
  end if;

  insert into cms.revision (tenant_id, entity, row_id, snapshot, by_person, op)
  values (old.tenant_id, v_entity, v_id, to_jsonb(old), core.my_person(),
          case tg_op when 'DELETE' then 'delete' else 'update' end);

  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $fn$;

-- Почта и название в настройках сайта.
update cms.settings
   set data = jsonb_set(data, '{email}', '"hello@tinker.kz"')
 where data ? 'email' and data->>'email' like '%oberon%';

-- Проверка: старого имени в ответах бота больше нет.
do $$
declare bad int;
begin
  select count(*) into bad
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'bot' and p.proname = 'render'
     and pg_get_functiondef(p.oid) like '%Oberon%';
  if bad > 0 then
    raise exception 'в bot.render осталось старое имя';
  end if;
end $$;
