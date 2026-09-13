-- 038. Роли начинают что-то значить.
--
-- Роли в базе были с самого начала: core.role, core.person_role, и запись о
-- роли заводилась при первом входе из core.allowed_email. Но не было ни
-- одного места, где роль на что-то влияла. Любой, кого впустили, видел всё:
-- ставку, себестоимость часа, прибыль по клиенту, счета и платежи.
--
-- Пока в системе один человек, это незаметно. Заметно станет ровно в тот
-- день, когда появится второй — и окажется, что впустить помощника разобрать
-- заявки значит показать ему маржу по каждому клиенту.
--
-- Что здесь сделано: деньги и ставки закрыты всем, кроме владельца. Не
-- «спрятаны в интерфейсе» — закрыты в базе, потому что спрятанное в
-- интерфейсе достаётся одним запросом мимо интерфейса.
--
-- Чего здесь НЕ сделано и почему. Заявки, переписка, время и задания
-- остаются общими: помощник для того и заводится, чтобы с ними работать.
-- Раздельный доступ к ним — отдельная задача, и решать её надо тогда, когда
-- появится второй человек и станет понятно, что именно ему нельзя.

-- ── 1. Кто я такой ──────────────────────────────────────────────────────────

create or replace function core.my_roles() returns text[]
language sql stable security definer set search_path = core, pg_temp
as $$
  select coalesce(array_agg(r.role_code), '{}'::text[])
    from core.person_role r
   where r.person_id = core.my_person()
$$;

comment on function core.my_roles() is 'Роли вошедшего человека.';

create or replace function core.is_owner() returns boolean
language sql stable security definer set search_path = core, pg_temp
as $$
  select exists (
    select 1 from core.person_role r
     where r.person_id = core.my_person() and r.role_code = 'owner')
$$;

comment on function core.is_owner() is
  'Владелец ли вошедший. Для раннера не применяется: у него своя политика.';

create or replace function core.require_owner() returns void
language plpgsql stable security definer set search_path = core, pg_temp
as $$
begin
  if not core.is_owner() then
    raise exception 'нужны права владельца'
      using hint = 'Это действие касается денег и доступно только владельцу.';
  end if;
end $$;

-- Панели нужна та же правда, что и базе: если меню решит по-своему, оно
-- покажет раздел, который всё равно отдаст пустоту. Поэтому роли она
-- спрашивает у базы, а PostgREST видит только public — отсюда обёртка.

create or replace function public.my_roles() returns text[]
language sql stable security definer set search_path = core, public
as $$
  select core.my_roles();
$$;

comment on function public.my_roles() is
  'Роли вошедшего. Вызывается панелью, чтобы не показывать то, чего всё равно не покажет база.';

do $$
declare rl text;
begin
  foreach rl in array array['authenticated','jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('grant execute on function core.my_roles(), core.is_owner() to %I', rl);
      execute format('grant execute on function public.my_roles() to %I', rl);
    end if;
  end loop;
end $$;

-- ── 2. Денежные таблицы — только владельцу ──────────────────────────────────
--
-- Меняется ТОЛЬКО политика для authenticated, то есть для человека в
-- браузере. Политика раннера (jarvis_worker) остаётся прежней: раннер не
-- человек, ролей у него нет, и без доступа к проводкам он перестанет
-- закрывать месяц.

do $$
declare
  r record;
  money text[][] := array[
    ['acc','account'], ['acc','entry'], ['acc','posting'], ['acc','numbering'],
    ['crm','doc'], ['crm','payment'], ['crm','estimate']
  ];
  i int;
  sch text; tbl text; pol text; n int := 0;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'роли authenticated нет — политики не трогаю';
    return;
  end if;

  for i in 1 .. array_length(money, 1) loop
    sch := money[i][1];
    tbl := money[i][2];

    if not exists (select 1 from pg_class c
                    where c.relname = tbl
                      and c.relnamespace = sch::regnamespace) then
      raise notice 'таблицы %.% нет — пропускаю', sch, tbl;
      continue;
    end if;

    pol := format('%s_authenticated', tbl);
    execute format('drop policy if exists %I on %I.%I', pol, sch, tbl);
    execute format(
      'create policy %I on %I.%I for all to authenticated
         using (tenant_id = core.my_tenant() and core.is_owner())
         with check (tenant_id = core.my_tenant() and core.is_owner())',
      pol, sch, tbl);
    n := n + 1;
  end loop;

  raise notice 'денежных таблиц закрыто от невладельцев: %', n;
end $$;

-- ── 3. Функции, выставляющие счета ──────────────────────────────────────────
--
-- Политика таблицы такую функцию не останавливает: она security definer и
-- работает правами владельца базы. Значит, проверка нужна внутри. Тела
-- переписываются не заново, а правкой собственного определения: менять в
-- полутора сотнях строк одну — безопаснее, чем перепечатывать полторы сотни.

do $$
declare
  fn text; src text; out text; n int := 0;
begin
  foreach fn in array array[
    'public.subscription_new(uuid,text,date,numeric,integer)',
    'public.subscription_end(bigint,date)',
    'public.subscription_invoice(bigint,date)'
  ] loop
    begin
      src := pg_get_functiondef(fn::regprocedure);
    exception when undefined_function or undefined_object then
      raise notice 'функции % нет — пропускаю', fn;
      continue;
    end;

    if src like '%core.require_owner()%' then
      raise notice '% уже проверяет владельца', fn;
      continue;
    end if;

    -- Проверка входа — первый end if в теле; за ним и вставляем. Именно
    -- первый: regexp_replace без флага g меняет одно вхождение. Однострочный
    -- guard и многострочный выглядят по-разному, поэтому ищется не отступ, а
    -- сам end if.
    out := regexp_replace(src, 'end if;',
                          E'end if;\n  perform core.require_owner();', '');
    if out = src then
      raise exception 'в % не нашлось места для проверки', fn;
    end if;

    execute out;
    n := n + 1;
  end loop;

  raise notice 'функций с проверкой владельца: %', n;
end $$;

-- ── 4. Кто сейчас чем является ──────────────────────────────────────────────
--
-- Отчёт, а не изменение. Если у живого человека нет роли owner, он потеряет
-- доступ к деньгам — и узнать об этом надо сейчас, а не когда он откроет
-- пустой раздел.

do $$
declare r record; v_owners int; v_people int;
begin
  select count(*) into v_people from core.person where is_active;
  if v_people = 0 then
    raise notice 'людей ещё нет — проверять некого (чистая база)';
    return;
  end if;

  for r in
    select p.full_name, p.email, coalesce(array_agg(pr.role_code) filter (where pr.role_code is not null), '{}') as roles
      from core.person p
      left join core.person_role pr on pr.person_id = p.id
     where p.is_active
     group by p.id, p.full_name, p.email
     order by p.full_name
  loop
    raise notice 'человек: % <%> — роли: %', r.full_name, coalesce(r.email,'без почты'), r.roles;
  end loop;

  select count(*) into v_owners
    from core.person p join core.person_role pr on pr.person_id = p.id
   where p.is_active and pr.role_code = 'owner';

  if v_owners = 0 then
    raise exception 'ни у кого нет роли owner — после этой миграции деньги стали бы недоступны всем';
  end if;

  raise notice 'владельцев: %', v_owners;
end $$;
