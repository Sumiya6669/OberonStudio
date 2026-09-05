-- 012. Доступ к функциям через PostgREST.
--
-- Две вещи, которые не видны, пока не попробуешь войти:
--
-- 1. supabase.rpc('имя') всегда ищет функцию в схеме public. Функция
--    core.link_me через такой вызов не находится — нужна обёртка в public.
-- 2. Права в 008 выдавались командой «на все функции схемы», а link_me и
--    resolve_company созданы в 009 и 010, то есть ПОСЛЕ. Такая команда
--    действует на существующие объекты, а не на будущие — новые функции
--    остались без прав.
--
-- Отсюда правило: любая функция, добавленная после 008, получает права
-- явно в своей же миграции. Ниже — и разовое исправление, и предустановка
-- прав по умолчанию, чтобы забыть об этом больше не пришлось.

-- Обёртка в public: её и вызывает панель при первом входе.
create or replace function public.link_me(p_email text, p_name text)
returns uuid
language sql security definer set search_path = core, public
as $$
  select core.link_me(p_email, p_name);
$$;

comment on function public.link_me(text, text) is
  'Связывает вошедшего пользователя Supabase Auth с человеком в системе. Вызывается панелью один раз при первом входе.';

-- Права на функции, созданные после общей выдачи в 008.
do $$
declare rl text;
begin
  foreach rl in array array['authenticated','jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('grant execute on all functions in schema core, crm, dev, mem to %I', rl);
      execute format('grant execute on function public.link_me(text, text) to %I', rl);
      -- Предустановка: функции, созданные ВЛАДЕЛЬЦЕМ в этих схемах дальше,
      -- получат права автоматически. Разовую выдачу это не отменяет.
      execute format('alter default privileges in schema core, crm, dev, mem grant execute on functions to %I', rl);
      execute format('alter default privileges in schema core, crm, dev, mem grant select, insert, update, delete on tables to %I', rl);
    end if;
  end loop;
end $$;

-- Журнал по-прежнему только дописывается: общая выдача выше могла вернуть права.
revoke update, delete, truncate on core.action_log from jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke update, delete, truncate on core.action_log from authenticated';
  end if;
end $$;

-- Проверка, что панель сможет позвать функции. Норма: три строки со значением true.
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as может_authenticated
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname = 'public' and p.proname in ('link_me','submit_lead'))
    or (n.nspname = 'core'   and p.proname = 'my_tenant')
 order by p.proname;
