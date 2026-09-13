-- 039. Оценщик перестаёт быть надписью.
--
-- Вид агента estimator заведён в реестре с первого дня, вид задания
-- estimator.draft — тоже. Обработчика к нему не существует ни в раннере, ни
-- где-либо ещё, и ни одно такое задание никогда не ставилось. То есть
-- «Оценщик» до сих пор был строчкой в таблице, а не работой.
--
-- Заявка приходит, регистратор её разбирает — и дальше она лежит, пока
-- человек не откроет панель. Оценка первой цифры занимает у человека минуты,
-- но происходит она через часы, и клиент всё это время ждёт.
--
-- Что делает база и что оставлено модели:
--   база  — кому оценивать можно, по какой ставке, что считать основанием,
--           когда двигать заявку и когда звать человека;
--   модель — сколько часов. Это единственное, чего правилом не выразить.

-- ── 1. Право, которое можно отозвать ────────────────────────────────────────

insert into core.action_type (code, title, target_system, has_side_effect,
                              min_confidence, autonomy_threshold)
values ('ticket.estimate', 'Черновик оценки по заявке', 'internal', true, 0.600, 50)
on conflict (code) do nothing;

-- ── 2. На чём основывать оценку ─────────────────────────────────────────────
--
-- Не «похожие тексты», а закрытые заявки того же типа и той же конфигурации,
-- по которым известно фактическое время. Это и есть обучающая выборка,
-- заложенная в схему полем hours_fact: правильные примеры в контексте вместо
-- дообучения.
--
-- Пусто — это нормальный ответ, а не ошибка. В начале работы истории нет, и
-- оценка тогда честно опирается на ничто; модель об этом узнает и понизит
-- уверенность сама.

create or replace function crm.estimate_basis(p_ticket bigint)
returns jsonb
language sql stable security invoker set search_path = crm, core, public
as $$
  with me as (select * from crm.ticket where id = p_ticket)
  select coalesce(jsonb_agg(x order by x.близость desc, x.closed_at desc), '[]'::jsonb)
    from (
      select t.id,
             t.subject,
             t.kind,
             t.system,
             e.hours_min, e.hours_max, e.hours_fact,
             t.updated_at as closed_at,
             (case when t.kind   is not distinct from (select kind   from me) then 2 else 0 end)
           + (case when t.system is not distinct from (select system from me) then 1 else 0 end)
               as близость
        from crm.ticket t
        join crm.estimate e on e.ticket_id = t.id
       where t.tenant_id = (select tenant_id from me)
         and t.id <> p_ticket
         and t.status = 'done'
         and e.hours_fact is not null
       order by близость desc, t.updated_at desc
       limit 8
    ) x;
$$;

comment on function crm.estimate_basis(bigint) is
  'Закрытые заявки с известным фактическим временем — основание для оценки. Пустой список это нормально.';

-- ── 3. Применение оценки ────────────────────────────────────────────────────
--
-- Цена считается по верхней границе часов, а не по средней. Оценка уходит
-- клиенту, и «вышло дороже, чем сказали» — это разговор, которого не должно
-- быть. Нижняя граница остаётся в карточке: если уложились быстрее, счёт
-- будет меньше названного, и это приятный исход, а не спор.

create or replace function crm.estimate_draft(
  p_ticket     bigint,
  p_hours_min  numeric,
  p_hours_max  numeric,
  p_confidence numeric default 0,
  p_rationale  text default '',
  p_basis      bigint[] default '{}'
) returns jsonb
language plpgsql security invoker set search_path = crm, core, public
as $$
declare
  v_t     crm.ticket;
  v_rate  numeric(10,2);
  v_min   numeric := greatest(coalesce(p_hours_min, 0), 0);
  v_max   numeric := greatest(coalesce(p_hours_max, 0), 0);
  v_conf  numeric := least(greatest(coalesce(p_confidence, 0), 0), 1);
  v_need  numeric;
  v_id    bigint;
  v_price numeric(12,2);
begin
  select * into v_t from crm.ticket where id = p_ticket;
  if v_t.id is null then
    raise exception 'заявка % не найдена', p_ticket;
  end if;

  -- Оценка уже есть — второй черновик не нужен. Задание может прийти
  -- повторно после сбоя, и перезаписывать то, на что человек мог опереться,
  -- нельзя.
  if exists (select 1 from crm.estimate
              where ticket_id = p_ticket and status in ('draft','accepted','edited')) then
    return jsonb_build_object('applied', false, 'reason', 'оценка по заявке уже есть');
  end if;

  if v_max <= 0 then
    return jsonb_build_object('applied', false, 'reason', 'часы не названы');
  end if;
  -- Границы наоборот — это описка в ответе модели, а не решение. Раньше
  -- здесь нижняя опускалась до верхней, и «9–4» превращалось в «4–4»: цена
  -- выходила вдвое ниже той, что имелась в виду. Меняем местами: так и
  -- ближе к смыслу, и безопаснее, потому что потолок остаётся потолком.
  if v_min > v_max then
    select v_max, v_min into v_min, v_max;
  end if;

  -- Ставка клиента, а не средняя по больнице. Нет клиента — ставка по
  -- умолчанию, та же, что во всех остальных расчётах.
  select coalesce(c.hourly_rate, 10000) into v_rate
    from crm.company c where c.id = v_t.company_id;
  v_rate := coalesce(v_rate, 10000);

  v_price := round(v_max * v_rate, 2);

  insert into crm.estimate (tenant_id, ticket_id, hours_min, hours_max, rate,
                            price, confidence, rationale, basis_tickets, status)
  values (v_t.tenant_id, p_ticket, v_min, v_max, v_rate,
          v_price, v_conf, left(coalesce(p_rationale, ''), 4000),
          coalesce(p_basis, '{}'), 'draft')
  returning id into v_id;

  -- Заявка двигается только из «разобрано». Если человек уже увёл её дальше,
  -- черновик останется черновиком и состояние не тронется.
  update crm.ticket set status = 'estimated'
   where id = p_ticket and status = 'triaged';

  select min_confidence into v_need
    from core.action_type where code = 'ticket.estimate';

  -- Неуверенная оценка не прячется и не выбрасывается: она остаётся
  -- черновиком, но человек узнаёт, что верить ей не стоит.
  if v_conf < coalesce(v_need, 0.600) then
    insert into core.escalation (tenant_id, kind, summary)
    values (v_t.tenant_id, 'low_confidence',
            format('Оценка по заявке №%s сделана с уверенностью %s: %s–%s ч, %s ₸. Проверьте.',
                   p_ticket, round(v_conf, 2), v_min, v_max, v_price));
  end if;

  return jsonb_build_object(
    'applied', true, 'estimate_id', v_id,
    'hours_min', v_min, 'hours_max', v_max,
    'rate', v_rate, 'price', v_price,
    'confidence', v_conf,
    'low_confidence', v_conf < coalesce(v_need, 0.600));
end $$;

comment on function crm.estimate_draft(bigint, numeric, numeric, numeric, text, bigint[]) is
  'Черновик оценки: цена по верхней границе часов и ставке клиента. Не переписывает существующую оценку и не принимает её за человека.';

grant execute on function crm.estimate_basis(bigint) to jarvis_worker;
grant execute on function crm.estimate_draft(bigint, numeric, numeric, numeric, text, bigint[])
  to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function crm.estimate_basis(bigint) to authenticated';
    execute 'grant execute on function crm.estimate_draft(bigint, numeric, numeric, numeric, text, bigint[]) to authenticated';
  end if;
end $$;

-- ── 4. Разобранная заявка сама зовёт оценщика ───────────────────────────────
--
-- Задание ставит база, а не раннер: тогда оценка появится независимо от того,
-- кто разобрал заявку — агент, человек в панели или второй канал загрузки.
-- Правило, живущее в сценарии агента, обходится любым другим путём.

create or replace function crm.g_ticket_estimate() returns trigger
language plpgsql security definer set search_path = crm, core, pg_temp
as $$
begin
  if new.status <> 'triaged' or old.status is not distinct from 'triaged' then
    return null;
  end if;

  insert into core.job (tenant_id, job_type, agent_kind, priority, payload, dedupe_key)
  values (new.tenant_id, 'estimator.draft', 'estimator', 4,
          jsonb_build_object('ticket_id', new.id), 'estimate:' || new.id)
  on conflict do nothing;

  return null;
end $$;

drop trigger if exists t_ticket_estimate on crm.ticket;
create trigger t_ticket_estimate after update of status on crm.ticket
for each row execute function crm.g_ticket_estimate();

-- ── 5. Выдать оценщику право ────────────────────────────────────────────────
--
-- Режим propose, а не auto: черновик появляется сам, но принимает его человек.
-- Это уже обеспечено триггером crm.g_estimate_human, и право лишь повторяет
-- то же решение на своём уровне.

do $$
declare v_person uuid; v_tenant uuid;
begin
  select p.id, p.tenant_id into v_person, v_tenant
    from core.person p
    join core.person_role r on r.person_id = p.id and r.role_code = 'owner'
   where p.is_active
   order by p.created_at
   limit 1;

  if v_person is null then
    raise notice 'владельца ещё нет — право оценщику выдать некому, сделайте это в панели';
    return;
  end if;

  insert into core."grant" (tenant_id, agent_kind, action_type, mode, granted_by, note)
  values (v_tenant, 'estimator', 'ticket.estimate', 'propose', v_person,
          'Черновик оценки. Принимает человек.')
  on conflict do nothing;

  raise notice 'оценщику выдано право ticket.estimate в режиме propose';
end $$;
