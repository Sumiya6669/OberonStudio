-- 013. Кто вообще может стать пользователем панели.
--
-- Дыра, которую закрываем: core.link_me из миграции 009 заводила человека
-- владельцем клиента «oberon» ЛЮБОМУ, кто вошёл. В Supabase публичная
-- регистрация по почте включена по умолчанию — значит любой желающий мог
-- зарегистрироваться, войти в /admin и стать владельцем ваших заявок.
--
-- Настройку «выключить регистрацию» можно случайно вернуть галочкой в
-- интерфейсе. Правило в базе вернуть галочкой нельзя — поэтому список
-- допущенных живёт таблицей, а не настройкой.

create table core.allowed_email (
  email      text primary key,
  tenant_id  uuid not null references core.tenant(id),
  role_code  text not null references core.role(code) default 'owner',
  note       text,
  added_at   timestamptz not null default now()
);

alter table core.allowed_email enable row level security;
alter table core.allowed_email force row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create policy allowed_email_authenticated on core.allowed_email
             for all to authenticated
             using (tenant_id = core.my_tenant())
             with check (tenant_id = core.my_tenant())';
  end if;
  if exists (select 1 from pg_roles where rolname = 'jarvis_worker') then
    execute 'create policy allowed_email_jarvis_worker on core.allowed_email
             for all to jarvis_worker
             using (tenant_id = core.my_tenant())
             with check (tenant_id = core.my_tenant())';
  end if;
end $$;

-- Кому можно войти. Правьте этот список, а не настройки Supabase.
insert into core.allowed_email (email, tenant_id, role_code, note)
select 'albert.gaan@optimus-kz.kz', t.id, 'owner', 'Основатель'
  from core.tenant t where t.code = 'oberon'
on conflict (email) do nothing;

-- Переписанная link_me: клиент и роль берутся из списка, а не из аргументов.
--
-- Почта берётся из auth.users по auth.uid(), а НЕ из параметра: параметр
-- приходит из браузера, и подставить туда чужой адрес может кто угодно.
create or replace function core.link_me(p_email text, p_name text)
returns uuid
language plpgsql security definer set search_path = core, public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_tenant uuid;
  v_role   text;
  v_person uuid;
begin
  if v_uid is null then
    raise exception 'вызывать из-под вошедшего пользователя';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    raise exception 'у пользователя нет адреса почты';
  end if;

  select a.tenant_id, a.role_code into v_tenant, v_role
    from core.allowed_email a where lower(a.email) = v_email;

  if v_tenant is null then
    raise exception 'адрес % не допущен в панель', v_email
      using hint = 'добавьте его в core.allowed_email';
  end if;

  insert into core.person (tenant_id, auth_user_id, full_name, email, is_active)
       values (v_tenant, v_uid, coalesce(nullif(trim(p_name), ''), v_email), v_email, true)
  on conflict (tenant_id, auth_user_id) do update
       set email = excluded.email,
           full_name = coalesce(nullif(trim(p_name), ''), core.person.full_name)
  returning id into v_person;

  insert into core.person_role (tenant_id, person_id, role_code)
       values (v_tenant, v_person, v_role)
  on conflict do nothing;

  return v_person;
end $$;

do $$
declare rl text;
begin
  foreach rl in array array['authenticated','jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('grant execute on function core.link_me(text, text) to %I', rl);
      execute format('grant execute on function public.link_me(text, text) to %I', rl);
      execute format('grant select, insert, update, delete on core.allowed_email to %I', rl);
    end if;
  end loop;
end $$;

-- Кто сейчас допущен. Норма: только те, кого вы вписали сами.
select a.email, t.code as клиент, a.role_code as роль, a.note
  from core.allowed_email a join core.tenant t on t.id = a.tenant_id
 order by a.email;
