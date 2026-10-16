-- 068. «3D-офис агентов» в панели (ИИ → 3D-офис): живое состояние агентов одним вызовом.
--
-- Зачем: экран показывает каждого агента из core.agent_kind за своим столом — работает, ждёт,
-- упал, сколько задач в очереди, когда начинал и заканчивал, последнее действие. Без этой миграции
-- экран рисует агентов из статичного реестра в коде (src/lib/admin/agentsRegistry.js) и пишет
-- «живые данные включатся после 068».
--
-- Что здесь:
--   * core.office_scrub(text) — короткий обезличенный текст ошибки для экрана: почта, ссылки,
--     телефоны, числа от 5 цифр (ИИН/БИН, суммы, номера), длинные строки без пробелов (ключи,
--     токены, uuid) заменяются метками, пробелы схлопываются, не длиннее 160 знаков. Имена людей
--     так не вычистить — поэтому показываем только тексты ошибок самих заданий и журнала агентов,
--     а payload / result / params / target_ref не отдаём вовсе.
--   * public.agents_office(p_alive_hours) — сводка по каждому виду агента одним jsonb: код, название,
--     включён ли и max_parallel (с переопределением клиента core.agent_limit, как app.v_agent_board
--     из 017), сколько задач сейчас в работе / в очереди / ждут повтора / заблокированы / ждут
--     человека, готово и с ошибкой за 24 ч и 7 дн, время последнего начала и завершения, последняя
--     ошибка (обрезанная, обезличенная), последнее действие из журнала, признак «живой» (была
--     активность за p_alive_hours часов, 1–720, по умолчанию 24), виды заданий агента; и время
--     последнего отклика раннера на ПК (как runner_last_seen в ai_pulse, 016).
--   * public.agents_office_jobs(p_agent_kind, p_limit) — последние задачи агента (тип, статус,
--     время, длительность, попытки, стоимость, короткая ошибка) и последние шаги его журнала
--     (действие, итог, время, длительность, короткая ошибка). Без payload, result, params.
--
-- Права — как у сводки посещений (067): ТОЛЬКО authenticated + активный человек (core.my_person)
-- с ролью панели (core.my_roles — owner / approver / operator / viewer). anon EXECUTE не имеет,
-- вошедший без роли получает ошибку прав 42501. Данные — только своего клиента (core.my_tenant()).
-- Функции ничего не пишут (stable). n8n здесь ни при чём: читаются только core.job, core.job_type,
-- core.agent_kind, core.agent_limit, core.action_log, core.action_type.
--
-- Повторный запуск безопасен: create or replace, revoke/grant.

-- ── 1. Обезличивание текста ошибки ─────────────────────────────────────────

create or replace function core.office_scrub(p text)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when p is null or btrim(p) = '' then null
    else (
      select case when length(s) > 160 then left(s, 159) || '…' else s end
        from (
          select btrim(regexp_replace(
                   regexp_replace(
                     regexp_replace(
                       regexp_replace(
                         regexp_replace(
                           regexp_replace(p,
                             '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[почта]', 'g'),
                           'https?://[^[:space:]]+', '[ссылка]', 'g'),
                         '\d{5,}', '[число]', 'g'),
                       -- телефон с разделителями: +7 (701) 123-45-67, 8 701 123 45 67
                       '\+?\d{1,3}[[:space:](-]*\d{3}[[:space:])-]*\d{3}[[:space:]-]*\d{2}[[:space:]-]*\d{2}',
                       '[телефон]', 'g'),
                     '[A-Za-z0-9_\-]{24,}', '[ключ]', 'g'),
                   '[[:space:]]+', ' ', 'g')) as s
        ) x
    )
  end
$$;

comment on function core.office_scrub(text) is
  'Короткий обезличенный текст ошибки для экрана «3D-офис» (068): без почты, ссылок, телефонов, длинных чисел и ключей; до 160 знаков.';

-- ── 2. Сводка по агентам ────────────────────────────────────────────────────

create or replace function public.agents_office(p_alive_hours int default 24)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tenant uuid;
  v_alive  int := least(greatest(coalesce(p_alive_hours, 24), 1), 720);
begin
  if core.my_person() is null
     or not (core.my_roles() && array['owner', 'approver', 'operator', 'viewer']::text[]) then
    raise exception 'офис агентов виден только в панели'
      using errcode = '42501', hint = 'Нужен вход в панель с ролью.';
  end if;
  v_tenant := core.my_tenant();

  return jsonb_build_object(
    'at', now(),
    'alive_hours', v_alive,
    -- Раннер на ПК отмечается в журнале строками от 'pc:<имя>' (как в ai_pulse, 016).
    'runner_last_seen', (
      select max(l.at) from core.action_log l
       where l.tenant_id = v_tenant and l.actor_ref like 'pc:%'
         and l.at >= now() - interval '30 days'),
    'agents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code',              ak.code,
               'title',             ak.title,
               'is_active',         coalesce(lim.is_active, ak.is_active),
               'max_parallel',      coalesce(lim.max_parallel, ak.max_parallel),
               'running',           coalesce(js.running, 0),
               'lease_expired',     coalesce(js.lease_expired, 0),
               'queued',            coalesce(js.queued, 0),
               'retrying',          coalesce(js.retrying, 0),
               'blocked',           coalesce(js.blocked, 0),
               'awaiting',          coalesce(js.awaiting, 0),
               'done_24h',          coalesce(js.done_24h, 0),
               'done_7d',           coalesce(js.done_7d, 0),
               'errors_24h',        coalesce(js.errors_24h, 0),
               'errors_7d',         coalesce(js.errors_7d, 0),
               'last_started_at',   js.last_started_at,
               'last_finished_at',  js.last_finished_at,
               'last_activity_at',  act.last_at,
               'alive',             coalesce(act.last_at >= now() - make_interval(hours => v_alive), false),
               'last_error',        le.err,
               'last_error_at',     le.at,
               'last_error_job',    le.job_type,
               'last_step_at',      ls.at,
               'last_step_title',   ls.title,
               'last_step_outcome', ls.outcome,
               'job_types',         coalesce(jt.items, '[]'::jsonb))
             order by ak.code)
        from core.agent_kind ak
        left join core.agent_limit lim on lim.agent_kind = ak.code and lim.tenant_id = v_tenant
        -- Счётчики заданий: живые — все, завершённые — за 30 дней (для «последнего начала/конца»).
        left join lateral (
          select count(*) filter (where j.status = 'leased')                                   as running,
                 count(*) filter (where j.status = 'leased' and j.lease_until < now())         as lease_expired,
                 count(*) filter (where j.status = 'queued')                                   as queued,
                 count(*) filter (where j.status = 'failed')                                   as retrying,
                 count(*) filter (where j.status = 'blocked')                                  as blocked,
                 count(*) filter (where j.status = 'awaiting')                                 as awaiting,
                 count(*) filter (where j.status in ('done', 'done_empty')
                                    and j.finished_at >= now() - interval '24 hours')          as done_24h,
                 count(*) filter (where j.status in ('done', 'done_empty')
                                    and j.finished_at >= now() - interval '7 days')            as done_7d,
                 count(*) filter (where j.status in ('failed', 'dead')
                                    and j.updated_at >= now() - interval '24 hours')           as errors_24h,
                 count(*) filter (where j.status in ('failed', 'dead')
                                    and j.updated_at >= now() - interval '7 days')             as errors_7d,
                 max(j.started_at)                                                             as last_started_at,
                 max(j.finished_at)                                                            as last_finished_at,
                 max(j.updated_at) filter (where j.status <> 'queued' or j.attempts > 0)       as last_change_at
            from core.job j
           where j.tenant_id = v_tenant and j.agent_kind = ak.code
             and (j.status in ('queued', 'leased', 'blocked', 'awaiting', 'failed')
                  or j.updated_at >= now() - interval '30 days')
        ) js on true
        -- Последняя ошибка: задание, которое сейчас ждёт повтора, упало окончательно или вернулось
        -- в очередь сборщиком аренд. Задание, которое потом выполнилось, ошибкой не считается.
        left join lateral (
          select core.office_scrub(e.error_text) as err, e.updated_at as at, e.job_type
            from core.job e
           where e.tenant_id = v_tenant and e.agent_kind = ak.code
             and e.error_text is not null
             and e.status in ('failed', 'dead', 'queued')
             and e.updated_at >= now() - interval '30 days'
           order by e.updated_at desc
           limit 1
        ) le on true
        -- Последний шаг журнала: раннер пишет исполнителя как 'agent:<вид агента>'.
        left join lateral (
          select l.at, coalesce(at2.title, l.action_type) as title, l.outcome
            from core.action_log l
            left join core.action_type at2 on at2.code = l.action_type
           where l.tenant_id = v_tenant and l.actor_ref = 'agent:' || ak.code
             and l.at >= now() - interval '30 days'
           order by l.at desc
           limit 1
        ) ls on true
        left join lateral (
          -- greatest пропускает null: пусто, только если активности не было вовсе
          select greatest(js.last_started_at, js.last_finished_at, js.last_change_at, ls.at) as last_at
        ) act on true
        left join lateral (
          select jsonb_agg(jsonb_build_object('code', t.code, 'title', t.title) order by t.code) as items
            from core.job_type t
           where t.agent_kind = ak.code and t.is_active
        ) jt on true), '[]'::jsonb));
end $$;

comment on function public.agents_office(int) is
  'Сводка по агентам для экрана «3D-офис» (068): очередь, работа, итоги за 24 ч / 7 дн, последняя ошибка без ПД. Только вошедшим в панель с ролью.';

-- ── 3. Задачи и журнал одного агента ────────────────────────────────────────

create or replace function public.agents_office_jobs(p_agent_kind text, p_limit int default 20)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tenant uuid;
  v_limit  int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if core.my_person() is null
     or not (core.my_roles() && array['owner', 'approver', 'operator', 'viewer']::text[]) then
    raise exception 'офис агентов виден только в панели'
      using errcode = '42501', hint = 'Нужен вход в панель с ролью.';
  end if;
  if not exists (select 1 from core.agent_kind ak where ak.code = p_agent_kind) then
    raise exception 'неизвестный вид агента' using errcode = '22023';
  end if;
  v_tenant := core.my_tenant();

  return jsonb_build_object(
    'agent_kind', p_agent_kind,
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',              x.id,
               'job_type',        x.job_type,
               'title',           x.title,
               'status',          x.status,
               'priority',        x.priority,
               'attempts',        x.attempts,
               'max_attempts',    x.max_attempts,
               'created_at',      x.created_at,
               'started_at',      x.started_at,
               'finished_at',     x.finished_at,
               'duration_sec',    x.duration_sec,
               'next_attempt_at', x.next_attempt_at,
               'cost_usd',        x.cost_act_usd,
               'error',           x.err)
             order by x.created_at desc, x.id desc)
        from (select j.id, j.job_type, t.title, j.status, j.priority, j.attempts, t.max_attempts,
                     j.created_at, j.started_at, j.finished_at,
                     case when j.finished_at is not null and j.started_at is not null
                          then greatest(0, extract(epoch from (j.finished_at - j.started_at)))::int end
                       as duration_sec,
                     case when j.status in ('queued', 'failed') then j.next_attempt_at end as next_attempt_at,
                     j.cost_act_usd,
                     core.office_scrub(j.error_text) as err
                from core.job j
                left join core.job_type t on t.code = j.job_type
               where j.tenant_id = v_tenant and j.agent_kind = p_agent_kind
               order by j.created_at desc, j.id desc
               limit v_limit) x), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'at',            s.at,
               'action_type',   s.action_type,
               'title',         s.title,
               'target_system', s.target_system,
               'outcome',       s.outcome,
               'job_id',        s.job_id,
               'duration_ms',   s.duration_ms,
               'cost_usd',      s.cost_usd,
               'error',         s.err)
             order by s.at desc)
        from (select l.at, l.action_type, coalesce(a.title, l.action_type) as title, l.target_system,
                     l.outcome, l.job_id, l.duration_ms, l.cost_usd,
                     core.office_scrub(l.error_text) as err
                from core.action_log l
                left join core.action_type a on a.code = l.action_type
               where l.tenant_id = v_tenant and l.actor_ref = 'agent:' || p_agent_kind
                 and l.at >= now() - interval '30 days'
               order by l.at desc
               limit v_limit) s), '[]'::jsonb));
end $$;

comment on function public.agents_office_jobs(text, int) is
  'Последние задачи и шаги журнала одного агента для экрана «3D-офис» (068), без payload/result/params. Только вошедшим в панель с ролью.';

-- ── 4. Права ────────────────────────────────────────────────────────────────

-- Помощник вызывается только изнутри security definer-функций (права владельца) — никому не выдаём.
revoke all on function core.office_scrub(text) from public;
revoke all on function public.agents_office(int) from public;
revoke all on function public.agents_office_jobs(text, int) from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated', 'jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('revoke all on function core.office_scrub(text) from %I', rl);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.agents_office(int) from anon';
    execute 'revoke all on function public.agents_office_jobs(text, int) from anon';
  end if;
  foreach rl in array array['authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('grant execute on function public.agents_office(int) to %I', rl);
      execute format('grant execute on function public.agents_office_jobs(text, int) to %I', rl);
    end if;
  end loop;
end $$;

-- ── Проверка после применения ───────────────────────────────────────────────
--
-- 1) Права (ожидается: сводка и задачи — false у anon, true у authenticated; помощник — false у обоих):
-- select r as роль,
--        has_function_privilege(r, 'public.agents_office(int)', 'execute')            as сводка,
--        has_function_privilege(r, 'public.agents_office_jobs(text,int)', 'execute')  as задачи,
--        has_function_privilege(r, 'core.office_scrub(text)', 'execute')              as обезличивание
--   from unnest(array['anon','authenticated']) r;
--
-- 2) Обезличивание (ожидается: «[почта] [телефон] БИН [число] ключ [ключ] [ссылка] 2026-10-17 12:00»):
-- select core.office_scrub('a.b@mail.kz +7 (701) 123-45-67 БИН 123456789012 ключ example_token_not_a_real_key_0001 https://x.kz/?t=1 2026-10-17 12:00');
--
-- 3) anon не видит — одним запуском, в конце rollback. Ожидается ОШИБКА «permission denied»:
-- begin;
-- select set_config('request.jwt.claims', '{"role":"anon"}', true);
-- set local role anon;
-- select public.agents_office(24);
-- rollback;
--
-- 4) Вошедший без человека/роли получает 42501 «офис агентов виден только в панели» — так ответит
--    и SQL Editor (там нет вошедшего человека, core.my_person() пуст; так и задумано).
--
-- 5) Из панели: ИИ → 3D-офис. Надпись «живые данные включатся после 068» должна пропасть,
--    у агентов из базы появятся очередь, «в работе», итоги за 24 ч и последние задачи.
