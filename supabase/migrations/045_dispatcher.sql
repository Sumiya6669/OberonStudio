-- 045. Диспетчер: заявка перестаёт застревать после оценки.
--
-- Что было. Регистратор разбирает обращение, Оценщик считает часы и цену —
-- и всё. Дальше заявка лежит и ждёт, пока владелец сам её прочитает, сам
-- решит, хватает ли данных, и сам напишет клиенту. Именно здесь заявки и
-- умирают: не потому, что про них забыли, а потому, что «надо сесть
-- и написать», а садиться некогда.
--
-- Что делает Диспетчер. Смотрит на разобранную заявку вместе с оценкой
-- и предлагает ОДНО из трёх:
--   ask_client    — данных не хватает, вот конкретные вопросы;
--   send_estimate — данных достаточно, вот текст с оценкой;
--   escalate      — это не наша задача или слишком рискованно.
--
-- Чего он не делает. Не отправляет. Предложение ложится в core.approval
-- и ждёт человека: одобрить, поправить или отклонить. Право у него —
-- 'propose', и порог автономии выставлен так, что автоматическим оно
-- не станет никогда: письмо клиенту от нашего имени — не то место, где
-- уместна «накопленная уверенность».
--
-- Почему у него есть модель, а у Контролёра с Приказчиком нет. Те отвечают
-- на вопрос «сколько строк», у которого есть однозначный ответ в базе.
-- Здесь вопрос другой: «хватает ли того, что написал клиент, чтобы взяться
-- за работу». Это суждение, и подделать его счётом нельзя.

-- ── 1. Новое действие: черновик ответа клиенту ──────────────────────────────

insert into core.action_type
  (code, title, target_system, has_side_effect, min_confidence, autonomy_threshold)
values
  ('ticket.reply', 'Черновик ответа клиенту', 'internal', false, 0.600, 999999)
on conflict (code) do update
  set title = excluded.title,
      autonomy_threshold = excluded.autonomy_threshold;

comment on table core.approval is
  'Предложения агентов, ждущие человека. Пустая таблица — не признак здоровья: это либо тишина, либо никто ничего не предлагает.';

-- ── 2. Право Диспетчера ─────────────────────────────────────────────────────

insert into core."grant" (tenant_id, agent_kind, action_type, mode, granted_by, note)
select t.id, 'dispatcher', 'ticket.reply', 'propose', p.id,
       'Только предлагать. Отправку клиенту решает человек.'
  from core.tenant t
  join core.person p on p.tenant_id = t.id
  join core.person_role r on r.person_id = p.id and r.role_code = 'owner'
 where p.is_active
on conflict do nothing;

-- ── 3. Задание ──────────────────────────────────────────────────────────────

insert into core.job_type (code, agent_kind, title, est_cost_usd, requires_payload)
values ('dispatcher.route', 'dispatcher', 'Что делать с заявкой дальше', 0.05, true)
on conflict (code) do update set agent_kind = excluded.agent_kind,
                                 title = excluded.title;

-- ── 4. Приём предложения от Диспетчера ──────────────────────────────────────

create or replace function crm.dispatch_propose(
  p_job        bigint,
  p_ticket     bigint,
  p_next       text,
  p_reason     text,
  p_message    text,
  p_confidence numeric)
returns bigint
language plpgsql security definer set search_path = crm, core, public, pg_temp
as $$
declare
  v_tenant uuid;
  v_id     bigint;
  v_subj   text;
begin
  if p_next not in ('ask_client','send_estimate','escalate') then
    raise exception 'непонятное решение «%»: бывает ask_client, send_estimate или escalate', p_next;
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'у решения должно быть основание';
  end if;
  if p_next <> 'escalate' and coalesce(trim(p_message), '') = '' then
    raise exception 'ответ клиенту не может быть пустым';
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'уверенность должна быть от 0 до 1';
  end if;

  select t.tenant_id, t.subject into v_tenant, v_subj
    from crm.ticket t where t.id = p_ticket;
  if v_tenant is null then
    raise exception 'заявка % не найдена', p_ticket;
  end if;

  insert into core.approval
    (tenant_id, job_id, action_type, proposal, rationale, confidence, expires_at)
  values
    (v_tenant, p_job, 'ticket.reply',
     jsonb_build_object('ticket_id', p_ticket, 'next', p_next, 'message', p_message),
     trim(p_reason), p_confidence, now() + interval '3 days')
  returning id into v_id;

  -- Предложение, о котором никто не узнал, ничем не лучше его отсутствия.
  perform core.herald_notify(
    v_tenant,
    '<b>Диспетчер</b>' || E'\n' ||
    'Заявка #' || p_ticket || ' — ' || core.tg_escape(coalesce(v_subj, '')) || E'\n' ||
    case p_next
      when 'ask_client'    then 'Предлагает уточнить у клиента'
      when 'send_estimate' then 'Предлагает отправить оценку'
      else 'Предлагает эскалировать'
    end || E'\n\n' ||
    case when p_next = 'escalate' then '' else core.tg_escape(left(p_message, 600)) || E'\n\n' end ||
    '<i>' || core.tg_escape(left(trim(p_reason), 300)) || '</i>' || E'\n' ||
    'Решение № ' || v_id || ' ждёт вас: одобрить, поправить или отклонить.',
    'dispatch:' || v_id);

  return v_id;
end $$;

-- ── 5. Решение человека ─────────────────────────────────────────────────────

create or replace function public.approval_decide(
  p_id      bigint,
  p_verdict text,
  p_text    text default null,
  p_reason  text default null)
returns jsonb
language plpgsql security definer set search_path = crm, core, public, pg_temp
as $$
declare
  v_a       core.approval;
  v_person  uuid := core.my_person();
  v_ticket  bigint;
  v_body    text;
  v_status  text;
begin
  if v_person is null then
    raise exception 'решение принимает вошедший человек, а не агент';
  end if;
  if p_verdict not in ('approve','edit','reject') then
    raise exception 'бывает approve, edit или reject';
  end if;

  select * into v_a from core.approval where id = p_id and tenant_id = core.my_tenant();
  if v_a.id is null then raise exception 'решение % не найдено', p_id; end if;
  if v_a.status <> 'pending' then
    raise exception 'решение % уже %: повторно решать нечего', p_id, v_a.status;
  end if;

  if p_verdict = 'reject' and coalesce(trim(p_reason), '') = '' then
    raise exception 'у отказа должна быть причина: без неё агент не научится';
  end if;
  if p_verdict = 'edit' and coalesce(trim(p_text), '') = '' then
    raise exception 'правка без текста — это отказ, так и назовите';
  end if;

  v_ticket := (v_a.proposal->>'ticket_id')::bigint;
  v_body   := case when p_verdict = 'edit' then trim(p_text)
                   else v_a.proposal->>'message' end;
  v_status := case p_verdict when 'approve' then 'approved'
                             when 'edit'    then 'approved_edited'
                             else 'rejected' end;

  update core.approval
     set status = v_status,
         decided_by = v_person,
         decided_at = now(),
         edit_delta = case when p_verdict = 'edit'
                           then jsonb_build_object('message', trim(p_text)) end,
         reject_reason = case when p_verdict = 'reject' then trim(p_reason) end
   where id = p_id;

  -- Одобренный текст становится сообщением в переписке заявки. Отправку
  -- клиенту делает человек: канала доставки клиенту у системы пока нет,
  -- и делать вид, что есть, — хуже, чем честно этого не уметь.
  if p_verdict in ('approve','edit') and v_a.proposal->>'next' <> 'escalate' then
    insert into crm.ticket_message (tenant_id, ticket_id, author, body)
    values (v_a.tenant_id, v_ticket, 'owner', v_body);
  end if;

  -- Измерительный прибор: одобрено без правок и с правками — разное качество.
  insert into core.autonomy_stat (tenant_id, agent_kind, action_type,
                                  streak_clean, total_approved, total_edited, total_rejected)
  values (v_a.tenant_id, 'dispatcher', v_a.action_type,
          case when p_verdict = 'approve' then 1 else 0 end,
          case when p_verdict = 'approve' then 1 else 0 end,
          case when p_verdict = 'edit'    then 1 else 0 end,
          case when p_verdict = 'reject'  then 1 else 0 end)
  on conflict (tenant_id, agent_kind, action_type) do update
     set streak_clean = case when p_verdict = 'approve'
                             then core.autonomy_stat.streak_clean + 1 else 0 end,
         total_approved = core.autonomy_stat.total_approved + case when p_verdict = 'approve' then 1 else 0 end,
         total_edited   = core.autonomy_stat.total_edited   + case when p_verdict = 'edit'    then 1 else 0 end,
         total_rejected = core.autonomy_stat.total_rejected + case when p_verdict = 'reject'  then 1 else 0 end,
         last_reset_at    = case when p_verdict <> 'approve' then now() else core.autonomy_stat.last_reset_at end,
         last_reset_cause = case when p_verdict <> 'approve' then p_verdict else core.autonomy_stat.last_reset_cause end;

  return jsonb_build_object('ok', true, 'status', v_status, 'ticket_id', v_ticket);
end $$;

comment on function public.approval_decide(bigint, text, text, text) is
  'Одобрить, поправить или отклонить предложение агента. Отказ без причины не принимается.';

-- ── 6. Кто зовёт Диспетчера ─────────────────────────────────────────────────
-- Оценка готова — значит есть о чём говорить с клиентом.

create or replace function crm.g_estimate_dispatch() returns trigger
language plpgsql security definer set search_path = crm, core, public
as $$
begin
  insert into core.job (tenant_id, job_type, agent_kind, priority, payload, dedupe_key)
  values (new.tenant_id, 'dispatcher.route', 'dispatcher', 4,
          jsonb_build_object('ticket_id', new.ticket_id, 'estimate_id', new.id),
          'dispatcher.route:' || new.id)
  on conflict do nothing;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 't_estimate_dispatch'
                    and tgrelid = 'crm.estimate'::regclass) then
    create trigger t_estimate_dispatch after insert on crm.estimate
      for each row execute function crm.g_estimate_dispatch();
  end if;
end $$;

-- ── 7. Что видит Диспетчер ──────────────────────────────────────────────────

create or replace function crm.dispatch_basis(p_ticket bigint)
returns jsonb
language sql stable security definer set search_path = crm, core, public, pg_temp
as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id, 'subject', t.subject, 'body', t.body,
      'kind', t.kind, 'system', t.system,
      'kind_confidence', t.kind_confidence,
      'channel', t.channel, 'status', t.status,
      'react_by', t.react_by),
    'company', jsonb_build_object(
      'title', c.title, 'hourly_rate', c.hourly_rate),
    'estimate', (
      select jsonb_build_object(
               'hours_min', e.hours_min, 'hours_max', e.hours_max,
               'price', e.price, 'confidence', e.confidence,
               'rationale', e.rationale)
        from crm.estimate e
       where e.ticket_id = t.id
       order by e.id desc limit 1),
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object('author', m.author, 'body', m.body)
                                order by m.at), '[]'::jsonb)
        from crm.ticket_message m where m.ticket_id = t.id))
  from crm.ticket t
  left join crm.company c on c.id = t.company_id
 where t.id = p_ticket;
$$;

-- ── 8. Права ────────────────────────────────────────────────────────────────

revoke all on function crm.dispatch_propose(bigint,bigint,text,text,text,numeric) from public, anon;
revoke all on function crm.dispatch_basis(bigint) from public, anon;
revoke all on function public.approval_decide(bigint,text,text,text) from public, anon;

grant execute on function crm.dispatch_propose(bigint,bigint,text,text,text,numeric) to jarvis_worker;
grant execute on function crm.dispatch_basis(bigint) to jarvis_worker;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.approval_decide(bigint,text,text,text) to authenticated';
    execute 'grant execute on function crm.dispatch_basis(bigint) to authenticated';
  end if;
end $$;
