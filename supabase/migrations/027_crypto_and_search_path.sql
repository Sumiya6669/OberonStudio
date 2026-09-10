-- 027. Криптофункции нашлись не там, где их искали.
--
-- Что нашлось. В боевой базе Supabase расширение pgcrypto установлено в
-- схему `extensions`, а не в `public`. А две функции звали `digest(...)`
-- без схемы, имея жёстко заданный `search_path` без `extensions`:
--
--   public.submit_lead  — приём заявки с сайта;
--   core.log_action     — запись в журнал действий агентов.
--
-- Жёсткий search_path в security definer функции — правильная защита, и
-- убирать её нельзя. Но она же означает, что `digest` не находится:
--
--   ЗАЯВКА УПАЛА: function digest(text, unknown) does not exist
--   ЖУРНАЛ УПАЛ:  function digest(text, unknown) does not exist
--
-- То есть форма на сайте не приняла бы ни одной заявки, а журнал
-- действий не записал бы ни одного действия раннера. Ни то, ни другое
-- не было заметно: заявок ещё не было, раннер ещё не запускался.
--
-- Как воспроизведено. На чистой базе применены все 26 миграций, затем
-- pgcrypto перенесено в схему `extensions` — так же, как в Supabase. Обе
-- функции упали ровно с этой ошибкой; после этой миграции обе проходят.
--
-- Почему починка не «добавить extensions в search_path каждой функции».
-- Тогда каждая новая функция обязана помнить, где живёт pgcrypto, и
-- однажды не вспомнит. Место, которое знает про расширение, должно быть
-- одно: `core.sha256_hex`. Остальные зовут её.
--
-- Второе в этой миграции: 15 функций (в основном триггерных) вообще не
-- имели заданного search_path. Ни одна из них не security definer,
-- поэтому подмены объектов через search_path тут не случилось бы, но
-- закрепить дешевле, чем объяснять. Это же снимает 15 предупреждений
-- проверяльщика Supabase.

-- ── 1. Одно место, которое знает, где живёт pgcrypto ────────────────────────
--
-- `extensions` — схема Supabase, `public` — расположение при локальной
-- установке. PostgreSQL молча пропускает несуществующие схемы в
-- search_path, поэтому одна и та же функция работает в обеих базах.

create or replace function core.sha256_hex(p_text text)
returns text
language sql immutable
set search_path = extensions, public, pg_catalog
as $$ select encode(digest(coalesce(p_text, ''), 'sha256'), 'hex') $$;

comment on function core.sha256_hex(text) is
  'Отпечаток текста. Единственное место, знающее, в какой схеме стоит pgcrypto.';

grant execute on function core.sha256_hex(text) to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function core.sha256_hex(text) to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function core.sha256_hex(text) to anon';
  end if;
end $$;

-- Проверка сразу, а не «потом посмотрим»: если pgcrypto нет ни в одной из
-- схем, миграция должна упасть здесь, а не через месяц на живой заявке.
do $$
begin
  if length(core.sha256_hex('проверка')) <> 64 then
    raise exception 'core.sha256_hex вернула не отпечаток';
  end if;
end $$;

-- ── 2. Журнал действий ──────────────────────────────────────────────────────

create or replace function core.log_action(
  p_actor_kind text, p_actor_ref text, p_action_type text,
  p_target_system text, p_target_ref text, p_params jsonb,
  p_outcome text, p_job_id bigint default null,
  p_cost_usd numeric default 0, p_error text default null
) returns bigint
language plpgsql security definer set search_path = core, public, pg_temp
as $$
declare v_id bigint;
begin
  insert into core.action_log (tenant_id, actor_kind, actor_ref, action_type,
         target_system, target_ref, params, params_digest, outcome, job_id,
         cost_usd, error_text)
  values (core.my_tenant(), p_actor_kind, p_actor_ref, p_action_type,
          p_target_system, p_target_ref, p_params,
          core.sha256_hex(p_params::text),
          p_outcome, p_job_id, coalesce(p_cost_usd,0), p_error)
  returning id into v_id;
  return v_id;
end $$;

comment on function core.log_action(text,text,text,text,text,jsonb,text,bigint,numeric,text) is
  'Запись в журнал действий. Отпечаток параметров считает база.';

-- ── 3. Приём заявки ─────────────────────────────────────────────────────────
--
-- Тело то же, что в 025, кроме одной строки: отпечаток считает
-- core.sha256_hex. Переписывается целиком, потому что заменить одну
-- строку в функции нельзя.

create or replace function public.submit_lead(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = crm, core, public, pg_temp
as $$
declare
  v_tenant  uuid;
  v_email   text := nullif(trim(payload->>'email'), '');
  v_phone   text := nullif(trim(payload->>'phone'), '');
  v_name    text := nullif(trim(payload->>'name'), '');
  v_channel text := coalesce(nullif(payload->>'channel',''), 'site');
  v_subject text;
  v_body    text;
  v_dedupe  text;
  v_company uuid;
  v_ticket  bigint;
  v_react   timestamptz;
  v_page    text := left(coalesce(
                      nullif(trim(payload->>'landing'), ''),
                      nullif(trim(payload->>'page'), '')), 300);
  v_form    text := left(nullif(trim(payload->>'page'), ''), 300);
  v_ref     text := left(nullif(trim(payload->>'referrer'), ''), 500);
  v_utm     jsonb;
begin
  select id into v_tenant from core.tenant
   where code = coalesce(nullif(payload->>'tenant',''), 'oberon');
  if v_tenant is null then
    raise exception 'клиент не найден';
  end if;

  if v_name is null or (v_phone is null and v_email is null) then
    raise exception 'нужны имя и хотя бы один контакт';
  end if;

  if v_channel not in ('site','email','telegram','phone','manual') then
    v_channel := 'site';
  end if;

  if not core.rate_take(v_tenant, 'lead:' || v_channel, 'hour', 60) then
    raise exception 'слишком много обращений, попробуйте позже';
  end if;

  select coalesce(jsonb_object_agg(key, left(value, 200)), '{}'::jsonb)
    into v_utm
    from jsonb_each_text(coalesce(payload->'utm', '{}'::jsonb))
   where key in ('utm_source','utm_medium','utm_campaign','utm_content','utm_term')
     and nullif(trim(value), '') is not null;

  v_body := left(coalesce(nullif(trim(payload->>'message'), ''), '(без текста)'), 8000);
  v_subject := left(coalesce(
      nullif(trim(payload->>'subject'), ''),
      nullif(trim(payload->>'service'), ''),
      'Заявка с сайта: ' || v_name), 300);

  -- Защита от двойной отправки формы: тот же контакт и тот же текст за час.
  v_dedupe := core.sha256_hex(
      coalesce(v_email,'') || '|' || coalesce(v_phone,'') || '|' ||
      left(v_body, 200) || '|' || to_char(now(), 'YYYY-MM-DD-HH24'));

  select id, react_by into v_ticket, v_react from crm.ticket
   where tenant_id = v_tenant and dedupe_key = v_dedupe;
  if v_ticket is not null then
    return jsonb_build_object(
      'ticket_id', v_ticket,
      'ref', 'OS-' || lpad(v_ticket::text, 5, '0'),
      'react_by', v_react,
      'duplicate', true);
  end if;

  v_company := crm.resolve_company(v_tenant, v_email, v_phone,
                                   nullif(payload->>'tg_chat_id','')::bigint);

  insert into crm.ticket (tenant_id, company_id, channel, external_ref, subject, body,
                          priority, status, dedupe_key, received_at,
                          landing_page, referrer, utm)
  values (v_tenant, v_company, v_channel, coalesce(v_email, v_phone), v_subject, v_body,
          case when v_company is null then 6 else 5 end,
          'new', v_dedupe, coalesce((payload->>'received_at')::timestamptz, now()),
          v_page, v_ref, coalesce(v_utm, '{}'::jsonb))
  returning id, react_by into v_ticket, v_react;

  insert into crm.ticket_message (tenant_id, ticket_id, author, body)
  values (v_tenant, v_ticket, 'client',
          format(E'%s\n\nИмя: %s\nТелефон: %s\nEmail: %s\nКомпания: %s\nСтраница: %s',
                 v_body, v_name, coalesce(v_phone,'—'), coalesce(v_email,'—'),
                 coalesce(payload->>'company','—'), coalesce(v_form, v_page, '—')));

  insert into core.job (tenant_id, job_type, agent_kind, priority, payload, dedupe_key)
  values (v_tenant, 'registrar.intake', 'registrar', 4,
          jsonb_build_object('ticket_id', v_ticket), 'ticket:' || v_ticket);

  return jsonb_build_object(
    'ticket_id', v_ticket,
    'ref', 'OS-' || lpad(v_ticket::text, 5, '0'),
    'react_by', v_react,
    'duplicate', false);
end $$;

comment on function public.submit_lead(jsonb) is
  'Приём заявки. Возвращает расписку: номер обращения и время, до которого обещан ответ.';

revoke all on function public.submit_lead(jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.submit_lead(jsonb) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.submit_lead(jsonb) to authenticated';
  end if;
end $$;
grant execute on function public.submit_lead(jsonb) to jarvis_worker;

-- ── 4. Закрепить search_path у всех своих функций ───────────────────────────
--
-- Перебором, а не списком: список устареет на следующей миграции. Функции
-- расширений не трогаем — они не наши.

do $$
declare r record; v_sp text;
begin
  for r in
    select p.oid, n.nspname as sch, p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('core','crm','cms','acc','dev','mem','app')
       and (p.proconfig is null
            or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
       and not exists (select 1 from pg_depend d
                        where d.objid = p.oid and d.deptype = 'e')
  loop
    v_sp := case when r.sch = 'core' then 'core, public, pg_temp'
                 else r.sch || ', core, public, pg_temp' end;
    execute format('alter function %s set search_path = %s', r.sig, v_sp);
  end loop;
end $$;

-- ── 5. Гигиена базы — на экран, а не в память ──────────────────────────────
--
-- Отдельная витрина, а не колонки в v_system_health: у неё другая природа
-- (не «что сейчас происходит», а «нет ли структурных дыр»), и её видно
-- целиком одним взглядом. hash_ok проверяет pgcrypto ВЫЗОВОМ: витрина,
-- которая сама зовёт функцию, не может врать о её работоспособности.

create or replace view app.v_db_hygiene with (security_invoker = true) as
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('core','crm','cms','acc','dev','mem','app')
      and (p.proconfig is null
           or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'))
                                                        as functions_unpinned,
  (select count(*) from pg_class c
    where c.relkind in ('r','p')
      and c.relnamespace::regnamespace::text in ('core','crm','dev','mem','acc','cms')
      and exists (select 1 from pg_attribute a where a.attrelid = c.oid
                    and a.attname = 'tenant_id' and a.attnum > 0 and not a.attisdropped)
      and not c.relrowsecurity)                          as tables_without_rls,
  (select count(*) from pg_class c
     join pg_inherits i on i.inhrelid = c.oid
     join pg_class p on p.oid = i.inhparent
    where p.relnamespace::regnamespace::text = 'core'
      and p.relname in ('action_log','usage_event')
      and not c.relrowsecurity)                          as partitions_open,
  (select count(*) from pg_class c
    where c.relkind in ('r','p') and c.relrowsecurity
      and c.relnamespace::regnamespace::text in ('core','crm','dev','mem','acc','cms')
      and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid))
                                                         as rls_without_policy,
  (select count(*) from pg_class c
    where c.relkind = 'v'
      and c.relnamespace::regnamespace::text in ('app','public')
      and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%')
                                                         as views_as_owner,
  (length(core.sha256_hex('проверка')) = 64)             as hash_ok;

comment on view app.v_db_hygiene is
  'Структурные дыры: незакреплённый search_path, таблицы и разделы без RLS, витрины от владельца, живость pgcrypto.';

grant select on app.v_db_hygiene to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on app.v_db_hygiene to authenticated';
  end if;
end $$;
