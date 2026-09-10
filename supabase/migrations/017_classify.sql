-- 017. Разбор заявки переезжает из n8n в раннер, и одна честная починка очереди.
--
-- Зачем переезд. Классификацию делал узел модели внутри n8n со своим ключом
-- API. Это давало три отдельные неприятности: второй путь к модели (а значит
-- второй счёт и второе место, где считается расход), шаг, невидимый в разделе
-- «ИИ» (он происходил внутри n8n, а не в журнале действий), и требование
-- отдельного ключа. Раннер уже ходит к модели через подписку и уже пишет
-- каждый шаг в журнал — значит разбор заявки должен идти там же.
--
-- Плата за это названа прямо: пока ПК выключен, заявки не разбираются.
-- Они ждут в очереди, а приём заявки по-прежнему делает облако — это
-- единственное, на что даётся обещание по времени.

-- ── Пределы агента на клиента ────────────────────────────────────────────────
--
-- core.agent_kind — общий реестр без tenant_id: он одинаков для всех клиентов,
-- и политика доступа к нему разрешает ТОЛЬКО чтение. Это правильно: предел
-- параллельности одного клиента не должен меняться из панели другого.
--
-- Но выключатель и предел одновременности — как раз то, что трогают в работе.
-- Поэтому здесь появляется переопределение на клиента. Пустое значение
-- означает «как в общем реестре», а не «ноль»: строка-переопределение
-- с одним заполненным полем не должна обнулять остальные.
--
-- Найдено прогоном: экран «Реестры агентов» правил общий реестр напрямую и
-- молча не сохранял ничего, потому что политика запрещает запись. Выключатель
-- в интерфейсе, которого нет в базе, — обещание, на которое полагаются.

create table core.agent_limit (
  tenant_id    uuid not null references core.tenant(id),
  agent_kind   text not null references core.agent_kind(code),
  max_parallel smallint check (max_parallel between 1 and 32),
  is_active    boolean,
  note         text,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, agent_kind)
);

alter table core.agent_limit enable row level security;
alter table core.agent_limit force row level security;

do $$
declare rl text;
begin
  foreach rl in array array['jarvis_worker','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format(
        'grant select, insert, update, delete on core.agent_limit to %I', rl);
      execute format(
        'create policy %I on core.agent_limit for all to %I
           using (tenant_id = core.my_tenant())
           with check (tenant_id = core.my_tenant())',
        'agent_limit_' || rl, rl);
    end if;
  end loop;
end $$;

comment on table core.agent_limit is
  'Переопределение выключателя и предела одновременности агента для одного клиента. NULL = как в общем реестре.';

-- ── Починка: выключенный агент обязан переставать брать задания ──────────────
--
-- В core.job_claim проверялась активность ВИДА ЗАДАНИЯ (job_type.is_active),
-- но не активность самого агента (agent_kind.is_active). То есть выключатель
-- агента в реестре ничего не выключал: агент продолжал забирать задания.
--
-- Экран «Реестры агентов» обещает обратное — «выключенный агент не берёт новые
-- задания». Обещание в интерфейсе, которого не выполняет база, хуже
-- отсутствующего выключателя: на него полагаются.

create or replace function core.job_claim(
  p_agent_kind text,
  p_worker     text,
  p_limit      int default 1
) returns setof core.job
language plpgsql security definer set search_path = core, public
as $$
declare
  v_tenant uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_max    smallint;
  v_active boolean;
  v_busy   int;
begin
  if v_tenant is null then
    raise exception 'app.tenant_id не объявлен: захват заданий запрещён';
  end if;

  -- Действующие значения: переопределение клиента поверх общего реестра.
  select coalesce(l.max_parallel, ak.max_parallel),
         coalesce(l.is_active,    ak.is_active)
    into v_max, v_active
    from core.agent_kind ak
    left join core.agent_limit l
           on l.agent_kind = ak.code and l.tenant_id = v_tenant
   where ak.code = p_agent_kind;
  if v_max is null then
    raise exception 'неизвестный вид агента: %', p_agent_kind;
  end if;

  -- Выключен — не берёт новые. Уже взятые доводит до конца: их аренда живёт,
  -- и обрывать работу на середине хуже, чем дать ей закончиться.
  if not v_active then
    return;
  end if;

  select count(*) into v_busy from core.job
   where agent_kind = p_agent_kind and status = 'leased' and tenant_id = v_tenant;

  p_limit := least(p_limit, greatest(v_max - v_busy, 0));
  if p_limit = 0 then
    return;
  end if;

  return query
  with picked as (
    select j.id, jt.lease_sec
      from core.job j
      join core.job_type jt on jt.code = j.job_type
     where j.status in ('queued','failed')
       and j.agent_kind = p_agent_kind
       and j.tenant_id = v_tenant
       and j.next_attempt_at <= now()
       and jt.is_active
     order by j.priority, j.next_attempt_at
     limit p_limit
     for update of j skip locked
  )
  update core.job j
     set status      = 'leased',
         attempts    = j.attempts + 1,
         lease_owner = p_worker,
         lease_until = now() + make_interval(secs => p.lease_sec),
         started_at  = coalesce(j.started_at, now()),
         updated_at  = now()
    from picked p
   where j.id = p.id
  returning j.*;
end $$;

comment on function core.job_claim(text, text, int) is
  'Захват заданий агентом. Соблюдает выключатель и предел параллельности из реестра.';

-- ── Применение разбора к заявке ──────────────────────────────────────────────
-- Правила живут здесь, а не в раннере, потому что их три и все три о том,
-- чего модели делать нельзя.

create or replace function crm.ticket_classify(
  p_ticket     bigint,
  p_kind       text,
  p_system     text default null,
  p_subject    text default null,
  p_confidence numeric default 0
) returns jsonb
language plpgsql security invoker set search_path = crm, core, public
as $$
declare
  v_row     crm.ticket;
  v_kind    text;
  v_conf    numeric := least(greatest(coalesce(p_confidence, 0), 0), 1);
  v_subject text := nullif(trim(coalesce(p_subject, '')), '');
  v_system  text := nullif(trim(coalesce(p_system, '')), '');
  v_min     numeric;
  v_low     boolean;
  v_took    boolean := false;
begin
  select * into v_row from crm.ticket where id = p_ticket;
  if v_row.id is null then
    raise exception 'заявка % не найдена', p_ticket;
  end if;

  -- Правило 1. Повторный разбор не переписывает то, что уже решено.
  -- Задание может прийти второй раз (повтор после сбоя, ручная постановка),
  -- и заявка, которую человек уже оценил, не должна вернуться в «разобрано».
  if v_row.status <> 'new' then
    return jsonb_build_object(
      'applied', false,
      'reason', format('заявка уже в состоянии «%s»', v_row.status));
  end if;

  -- Правило 2. Тип берётся только из известного набора. Модель может вернуть
  -- что угодно, включая слово из вопроса клиента; неизвестное — это 'other'.
  v_kind := case
    when p_kind in ('bug','feature','consult','update','integration','other')
    then p_kind else 'other' end;

  -- Правило 3. Тему модель уточняет только если её ещё никто не писал.
  -- Автозаголовок формы начинается известной строкой. Всё остальное — либо
  -- тема письма клиента, либо формулировка человека, и переписывать её незачем.
  if v_subject is not null and v_row.subject like 'Заявка с сайта:%' then
    v_took := true;
  end if;

  select min_confidence into v_min
    from core.action_type where code = 'ticket.classify';
  v_low := v_conf < coalesce(v_min, 0.700);

  update crm.ticket
     set kind            = v_kind,
         kind_confidence  = v_conf,
         system          = coalesce(v_system, system),
         subject         = case when v_took then left(v_subject, 300) else subject end,
         status          = 'triaged'
   where id = p_ticket and status = 'new';

  -- Низкая уверенность не прячется. Заявка двигается дальше — держать её в
  -- «новых» бессмысленно, её всё равно уже посмотрели, — но человек узнаёт,
  -- что разбору не стоит верить.
  if v_low then
    insert into core.escalation (tenant_id, kind, summary)
    values (v_row.tenant_id, 'low_confidence',
            format('Заявка №%s разобрана с уверенностью %s: тип «%s». Проверьте вручную.',
                   p_ticket, round(v_conf, 2), v_kind));
  end if;

  return jsonb_build_object(
    'applied', true,
    'kind', v_kind,
    'confidence', v_conf,
    'system', v_system,
    'subject_taken', v_took,
    'low_confidence', v_low);
end $$;

comment on function crm.ticket_classify(bigint, text, text, text, numeric) is
  'Применение разбора заявки. Не переписывает решённое, не выдумывает тип, не трогает тему человека.';

grant execute on function crm.ticket_classify(bigint, text, text, text, numeric)
  to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function crm.ticket_classify(bigint, text, text, text, numeric) to authenticated';
  end if;
end $$;

-- Обёртка для панели: PostgREST зовёт функции только из схемы public.
create or replace function public.ticket_classify(
  p_ticket bigint, p_kind text, p_system text default null,
  p_subject text default null, p_confidence numeric default 0
) returns jsonb
language sql security invoker set search_path = public
as $$ select crm.ticket_classify(p_ticket, p_kind, p_system, p_subject, p_confidence) $$;

revoke all on function public.ticket_classify(bigint, text, text, text, numeric) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.ticket_classify(bigint, text, text, text, numeric) to authenticated';
  end if;
end $$;

-- ── Разбор заявки становится работой раннера ─────────────────────────────────
-- Вид задания registrar.intake уже существует и уже ставится в очередь
-- функцией public.submit_lead. Меняются только сроки под живого исполнителя,
-- который просыпается вместе с рабочим днём: аренда короткая (шаг быстрый),
-- а повторов меньше — если ПК выключен, задание ждёт, а не тратит попытки.

update core.job_type
   set lease_sec        = 600,
       backoff_base_sec = 300,
       max_attempts     = 3,
       est_cost_usd     = 0.004,
       title            = 'Разбор входящего обращения'
 where code = 'registrar.intake';

-- ── Доска агентов: действующие значения, а не значения общего реестра ───────

drop view if exists app.v_agent_board cascade;
create view app.v_agent_board with (security_invoker = true) as
select ak.code, ak.title,
       coalesce(l.is_active, ak.is_active)       as is_active,
       coalesce(l.max_parallel, ak.max_parallel) as max_parallel,
       ak.is_active                              as is_active_registry,
       ak.max_parallel                           as max_parallel_registry,
       (l.tenant_id is not null)                 as overridden,
       l.note                                    as limit_note,
       t.id as tenant_id,
       count(j.id) filter (where j.status = 'leased')                    as running,
       count(j.id) filter (where j.status in ('queued','failed'))        as waiting,
       count(j.id) filter (where j.status = 'blocked')                   as blocked,
       count(j.id) filter (where j.status = 'awaiting')                  as awaiting,
       count(j.id) filter (where j.status = 'leased'
                             and j.lease_until < now())                  as lease_expired,
       count(j.id) filter (where j.status in ('done','done_empty')
                             and j.finished_at >= now() - interval '24 hours') as done_day,
       count(j.id) filter (where j.status = 'done_empty'
                             and j.finished_at >= now() - interval '24 hours') as empty_day,
       count(j.id) filter (where j.status = 'dead'
                             and j.finished_at >= now() - interval '7 days')   as dead_week,
       coalesce(sum(j.cost_act_usd) filter (
                  where j.finished_at >= now() - interval '24 hours'), 0)      as cost_day,
       max(j.finished_at)                                                as last_finished_at,
       round((percentile_cont(0.5) within group (
         order by extract(epoch from (j.finished_at - j.started_at))
       ) filter (where j.finished_at is not null and j.started_at is not null
                   and j.finished_at >= now() - interval '7 days'))::numeric, 0)
                                                                         as median_sec
  from core.agent_kind ak
  cross join (select id from core.tenant where id = core.my_tenant()) t
  left join core.agent_limit l on l.agent_kind = ak.code and l.tenant_id = t.id
  left join core.job j on j.agent_kind = ak.code and j.tenant_id = t.id
 group by ak.code, ak.title, ak.is_active, ak.max_parallel,
          l.is_active, l.max_parallel, l.tenant_id, l.note, t.id;

grant select on app.v_agent_board to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on app.v_agent_board to authenticated';
  end if;
end $$;
