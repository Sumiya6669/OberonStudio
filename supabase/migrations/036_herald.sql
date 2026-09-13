-- 036. Вестнику дают работу.
--
-- Сценарий «Вестник» в n8n написан и цел, но выключен, и это правильно: за всё
-- время в очереди не появилось ни одного задания вида herald.notify. Он умеет
-- доставлять — только доставлять было нечего. Ставит задания база, а не
-- сценарий: событие и уведомление о нём должны быть в одной транзакции, иначе
-- заявка сохранится, а сообщение потеряется.

-- ── 1. Экранирование ────────────────────────────────────────────────────────
-- Вестник отправляет с parse_mode = HTML. Тема заявки приходит из формы на
-- сайте, то есть от постороннего. Угловая скобка в теме — и Telegram отвечает
-- «can't parse entities», сообщение не уходит, задание уходит в отказ.

create or replace function core.tg_escape(p text) returns text
language sql immutable set search_path = pg_catalog
as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

comment on function core.tg_escape(text) is
  'Экранирует текст для Telegram parse_mode=HTML.';

-- ── 2. Постановка задания Вестнику ──────────────────────────────────────────
--
-- Кому: людям своего клиента, у которых известен chat_id. Известен chat_id и
-- «нам разрешено писать» — разные факты, но второй проверяет сам Вестник и на
-- неразрешённом заводит эскалацию. Здесь отсекается только то, о чём заранее
-- известно, что адреса нет вовсе: задание такому человеку ничего не даст.
--
-- Возвращает число поставленных заданий, чтобы вызывающий мог понять, что
-- сообщать оказалось некому.

create or replace function core.herald_notify(
  p_tenant uuid,
  p_text   text,
  p_dedupe text,
  p_person uuid default null)
returns int
language plpgsql security definer set search_path = core, pg_temp
as $$
declare n int := 0;
begin
  insert into core.job (tenant_id, job_type, agent_kind, priority, payload, dedupe_key)
  select p_tenant, 'herald.notify', 'herald', 3,
         jsonb_build_object('person_id', pr.id, 'text', p_text),
         p_dedupe || ':' || pr.id
    from core.person pr
   where pr.tenant_id = p_tenant
     and pr.is_active
     and pr.tg_chat_id is not null
     and (p_person is not null and pr.id = p_person
          or p_person is null and exists (
               select 1 from core.person_role r
                where r.person_id = pr.id
                  and r.role_code in ('owner', 'operator')))
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end $$;

comment on function core.herald_notify(uuid, text, text, uuid) is
  'Ставит Вестнику задание доставить текст. Без p_person — всем владельцам и исполнителям клиента.';

revoke all on function core.herald_notify(uuid, text, text, uuid) from public;

-- ── 3. Новая заявка ─────────────────────────────────────────────────────────

create or replace function crm.g_ticket_herald() returns trigger
language plpgsql security definer set search_path = crm, core, pg_temp
as $$
declare v_txt text;
begin
  v_txt := format(
    E'🔔 <b>Новая заявка %s</b>\n%s\n\nКанал: %s\nОтветить до: %s\n\n%s',
    'OS-' || lpad(new.id::text, 5, '0'),
    core.tg_escape(new.subject),
    new.channel,
    to_char(coalesce(new.react_by, new.created_at + interval '4 hours')
              at time zone 'Asia/Almaty', 'DD.MM HH24:MI'),
    core.tg_escape(left(new.body, 600)));

  perform core.herald_notify(new.tenant_id, v_txt, 'ticket:' || new.id);
  return null;
end $$;

drop trigger if exists t_ticket_herald on crm.ticket;
create trigger t_ticket_herald after insert on crm.ticket
for each row execute function crm.g_ticket_herald();

-- ── 4. Ответ клиента по существующей заявке ─────────────────────────────────
--
-- Первое сообщение приходит вместе с заявкой — о ней уже сообщено пунктом 3,
-- и отправлять два уведомления об одном событии значит приучить не читать их.

create or replace function crm.g_ticket_message_herald() returns trigger
language plpgsql security definer set search_path = crm, core, pg_temp
as $$
declare v_txt text; v_subject text;
begin
  if new.author is distinct from 'client' then
    return null;
  end if;

  if not exists (select 1 from crm.ticket_message m
                  where m.ticket_id = new.ticket_id and m.id < new.id) then
    return null;
  end if;

  select t.subject into v_subject from crm.ticket t where t.id = new.ticket_id;

  v_txt := format(
    E'💬 <b>Ответ клиента по %s</b>\n%s\n\n%s',
    'OS-' || lpad(new.ticket_id::text, 5, '0'),
    core.tg_escape(coalesce(v_subject, '')),
    core.tg_escape(left(new.body, 900)));

  perform core.herald_notify(new.tenant_id, v_txt, 'msg:' || new.id);
  return null;
end $$;

drop trigger if exists t_ticket_message_herald on crm.ticket_message;
create trigger t_ticket_message_herald after insert on crm.ticket_message
for each row execute function crm.g_ticket_message_herald();

-- ── 5. Эскалация ────────────────────────────────────────────────────────────
--
-- Эскалация — это место, где система призналась, что сама не решит. Оно обязано
-- дойти до человека.
--
-- Кроме одного вида. external_error заводит сам Вестник, когда доставить не
-- удалось. Сообщать о неудачной доставке той же доставкой — кольцо: не дошло →
-- эскалация → снова не дошло → снова эскалация, и так до конца очереди.

create or replace function core.g_escalation_herald() returns trigger
language plpgsql security definer set search_path = core, pg_temp
as $$
declare v_txt text;
begin
  if new.kind = 'external_error' then
    return null;
  end if;

  v_txt := format(E'⚠️ <b>Нужно решение</b>\n%s\n\nПричина: %s',
                  core.tg_escape(new.summary), new.kind);

  perform core.herald_notify(new.tenant_id, v_txt, 'esc:' || new.id, new.to_person_id);
  return null;
end $$;

drop trigger if exists t_escalation_herald on core.escalation;
create trigger t_escalation_herald after insert on core.escalation
for each row execute function core.g_escalation_herald();

-- ── 6. Кому сегодня может дойти ─────────────────────────────────────────────

do $$
declare v_total int; v_addr int; v_ready int;
begin
  select count(*),
         count(*) filter (where p.tg_chat_id is not null),
         count(*) filter (where p.tg_chat_id is not null and p.tg_started_at is not null)
    into v_total, v_addr, v_ready
    from core.person p
    join core.person_role r on r.person_id = p.id and r.role_code in ('owner','operator')
   where p.is_active;

  raise notice 'владельцев и исполнителей: %, из них с адресом в Telegram: %, готовых принять: %',
               v_total, v_addr, v_ready;

  if v_ready = 0 then
    raise notice 'ВНИМАНИЕ: сообщения ставить некому. Нажмите «Старт» у бота — без этого Telegram не даст написать первым.';
  end if;
end $$;
