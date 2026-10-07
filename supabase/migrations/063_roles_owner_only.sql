-- 063. Роли и допуск в панель меняет только владелец.
--
-- Дыра (аудит 07.10.2026): на core.person_role, core.person, core.allowed_email и core."grant" для
-- вошедших стоит одна общая политика «своя строка клиента» (008, 013) — без проверки роли. Значит,
-- любой допущенный сотрудник (operator, viewer…) мог одним запросом мимо панели:
--   * insert into core.person_role (…, role_code) values (…, 'owner') — сделать себя владельцем
--     и получить деньги, ставки и счета, закрытые миграцией 038;
--   * вписать в core.allowed_email любой адрес с ролью owner — завести себе второго владельца;
--   * переписать core.person.auth_user_id у строки владельца на свой — стать им;
--   * перевести право агента в core."grant" в режим auto.
--
-- Что здесь: на эти четыре таблицы — ОГРАНИЧИВАЮЩИЕ (as restrictive) политики для authenticated на
-- insert / update / delete: core.is_owner(). Ограничивающая политика складывается с прежней через И,
-- поэтому «своя строка клиента» продолжает действовать, а запись дополнительно требует владельца.
-- Чтение не меняется: панель по-прежнему показывает сотруднику список людей и прав.
-- «Не выдать роль выше своей» отсюда следует: выдавать роли может только владелец — старшая роль.
--
-- Не задеты: вход (core.link_me — security definer, заводит человека и роль из allowed_email от имени
-- владельца базы, политики для authenticated к нему не применяются); раннер (jarvis_worker — свои
-- политики); бот (bot.link — security definer).
--
-- Страховка от запирания: триггер не даёт убрать роль owner у последнего активного владельца клиента
-- (иначе деньги и этот же экран стали бы недоступны всем, а вернуть роль можно было бы только из SQL).
-- Панель (src/lib/supabase/queries.js → setPersonRoles) с этой миграцией меняет роли разницей
-- («добавить недостающие, потом убрать лишние»), а не «стереть всё и записать заново»: иначе владелец,
-- правящий свою карточку, на полпути терял бы роль owner и не мог дописать новые.
--
-- Повторный запуск безопасен: drop policy if exists / create or replace / drop trigger if exists.

-- ── 1. Запись — только владельцу ────────────────────────────────────────────

do $$
declare
  t   text;
  tbl text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'роли authenticated нет — политики не трогаю';
    return;
  end if;

  foreach t in array array['person_role', 'person', 'allowed_email', 'grant'] loop
    if not exists (select 1 from pg_class c
                    where c.relname = t and c.relnamespace = 'core'::regnamespace) then
      raise notice 'таблицы core.% нет — пропускаю', t;
      continue;
    end if;
    tbl := format('core.%I', t);
    execute format('alter table %s enable row level security', tbl);

    execute format('drop policy if exists %I on %s', t || '_owner_ins', tbl);
    execute format('drop policy if exists %I on %s', t || '_owner_upd', tbl);
    execute format('drop policy if exists %I on %s', t || '_owner_del', tbl);

    execute format('create policy %I on %s as restrictive for insert to authenticated
                      with check (core.is_owner())', t || '_owner_ins', tbl);
    execute format('create policy %I on %s as restrictive for update to authenticated
                      using (core.is_owner()) with check (core.is_owner())', t || '_owner_upd', tbl);
    execute format('create policy %I on %s as restrictive for delete to authenticated
                      using (core.is_owner())', t || '_owner_del', tbl);
  end loop;
end $$;

-- ── 2. Последнего владельца не убрать ───────────────────────────────────────

create or replace function core.g_keep_last_owner() returns trigger
language plpgsql security definer set search_path = core, pg_temp
as $$
begin
  if old.role_code <> 'owner' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.role_code = 'owner' and new.person_id = old.person_id
     and new.tenant_id = old.tenant_id then
    return new;
  end if;

  if not exists (
    select 1 from core.person_role r
      join core.person p on p.id = r.person_id
     where r.tenant_id = old.tenant_id and r.role_code = 'owner'
       and r.person_id <> old.person_id and p.is_active) then
    raise exception 'нельзя убрать роль владельца у последнего владельца'
      using hint = 'Сначала назначьте владельцем другого человека.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

comment on function core.g_keep_last_owner() is
  'Триггер core.person_role (063): у клиента всегда остаётся хотя бы один активный владелец.';

revoke all on function core.g_keep_last_owner() from public;

drop trigger if exists keep_last_owner on core.person_role;
create trigger keep_last_owner
  before update or delete on core.person_role
  for each row execute function core.g_keep_last_owner();

-- ── 3. Проверка ─────────────────────────────────────────────────────────────
-- Отчёт, а не изменение: сколько владельцев сейчас (должно быть ≥ 1) и какие политики стоят.

do $$
declare v_owners int;
begin
  select count(*) into v_owners
    from core.person p join core.person_role pr on pr.person_id = p.id
   where p.is_active and pr.role_code = 'owner';
  raise notice 'активных владельцев: %', v_owners;
end $$;

-- select tablename, policyname, permissive, cmd from pg_policies
--  where schemaname = 'core' and tablename in ('person_role','person','allowed_email','grant')
--  order by 1, 2;
