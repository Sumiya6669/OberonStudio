-- 032. Телеграм-бот: две стороны одного окна.
--
-- Зачем. Владелец живёт в телефоне, а панель — в браузере. Между «пришла
-- заявка» и «ответил» стоит: открыть ноутбук, зайти, найти. В эти минуты
-- и уходит обещание ответить за час. Клиенту, наоборот, нужен не доступ
-- в панель, а три вещи: написать, посмотреть, что с его обращением, и
-- увидеть, сколько часов осталось в абонементе.
--
-- Главное решение: ВСЯ ЛОГИКА БОТА ЖИВЁТ ЗДЕСЬ, а не в сценарии n8n.
-- Сценарий получает сообщение, зовёт одну функцию и отправляет то, что
-- она вернула. Причины две. Первая: правила доступа — кто что видит —
-- должны стоять там же, где данные, иначе однажды кнопка покажет клиенту
-- чужую заявку. Вторая: логику в базе можно прогнать запросом и увидеть
-- ответ, а логику в n8n проверяют только руками в телефоне.
--
-- Кто есть кто определяется не списком в настройках, а тем, что уже есть
-- в базе: chat_id записан у человека (core.person) — владелец; записан у
-- контакта клиента (crm.contact) — клиент; не записан нигде — незнакомец,
-- которому доступно ровно одно: оставить обращение, как через форму.
--
-- Привязка идёт по одноразовому коду, а не по номеру телефона: номер
-- называется голосом, подслушивается и подделывается, а код выдаётся в
-- панели конкретному контакту и живёт неделю.

create schema if not exists bot;
comment on schema bot is 'Телеграм-бот: состояние диалогов и вся логика ответов.';

grant usage on schema bot to jarvis_worker;

-- ── Состояние диалога ───────────────────────────────────────────────────────
--
-- Нужно ровно для одного: бот спросил «напишите текст обращения» и должен
-- помнить, что следующее сообщение — это ответ на его вопрос, а не новая
-- команда. Долгой памяти здесь нет намеренно.

create table if not exists bot.session (
  chat_id     bigint primary key,
  tenant_id   uuid        not null references core.tenant(id) on delete cascade,
  state       text        not null default 'idle',
  payload     jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

comment on table bot.session is 'Ожидание ввода: что бот спросил и к чему это относится.';

-- ── Приглашение ─────────────────────────────────────────────────────────────

create table if not exists bot.invite (
  code        text        primary key,
  tenant_id   uuid        not null references core.tenant(id) on delete cascade,
  person_id   uuid        references core.person(id) on delete cascade,
  contact_id  uuid        references crm.contact(id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '7 days',
  used_at     timestamptz,
  used_by     bigint,
  created_at  timestamptz not null default now(),
  constraint invite_one_side check (num_nonnulls(person_id, contact_id) = 1)
);

comment on table bot.invite is 'Одноразовый код привязки чата к человеку или контакту клиента.';

alter table bot.session enable row level security;
alter table bot.invite  enable row level security;
alter table bot.session force row level security;
alter table bot.invite  force row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'jarvis_worker') then
    execute 'grant select, insert, update, delete on bot.session to jarvis_worker';
    execute 'grant select, insert, update on bot.invite to jarvis_worker';
    execute 'drop policy if exists session_worker on bot.session';
    execute 'drop policy if exists invite_worker on bot.invite';
    execute 'create policy session_worker on bot.session for all to jarvis_worker using (true) with check (true)';
    execute 'create policy invite_worker on bot.invite for all to jarvis_worker using (true) with check (true)';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    -- Панель выдаёт коды приглашений, но переписку бота не читает.
    execute 'grant select, insert on bot.invite to authenticated';
    execute 'drop policy if exists invite_person on bot.invite';
    execute 'create policy invite_person on bot.invite for all to authenticated using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())';
  end if;
end $$;

-- ── Кто пишет ───────────────────────────────────────────────────────────────

create or replace function bot.whoami(p_chat_id bigint)
returns table (tenant_id uuid, role text, person_id uuid, contact_id uuid,
               company_id uuid, title text)
language sql stable security definer set search_path = bot, core, crm, public, pg_temp
as $$
  (select p.tenant_id, 'owner'::text, p.id, null::uuid, null::uuid, p.full_name
     from core.person p
    where p.tg_chat_id = p_chat_id and p.is_active
    limit 1)
  union all
  (select c.tenant_id, 'client'::text, null::uuid, c.id, c.company_id,
          coalesce(nullif(co.title, ''), c.full_name)
     from crm.contact c
     left join crm.company co on co.id = c.company_id
    where c.tg_chat_id = p_chat_id
      and not exists (select 1 from core.person p2
                       where p2.tg_chat_id = p_chat_id and p2.is_active)
    limit 1);
$$;

comment on function bot.whoami(bigint) is
  'Роль чата: владелец, клиент или никто. Определяется данными, а не списком в настройках.';

-- ── Привязка по коду ────────────────────────────────────────────────────────

create or replace function bot.link(p_chat_id bigint, p_code text)
returns text
language plpgsql security definer set search_path = bot, core, crm, public, pg_temp
as $$
declare v bot.invite;
begin
  select * into v from bot.invite
   where code = upper(trim(p_code)) and used_at is null and expires_at > now();
  if v.code is null then
    return 'Код не подошёл: он либо использован, либо просрочен. Попросите новый.';
  end if;

  if v.person_id is not null then
    update core.person set tg_chat_id = p_chat_id, tg_started_at = now()
     where id = v.person_id;
  else
    update crm.contact set tg_chat_id = p_chat_id, tg_started_at = now()
     where id = v.contact_id;
  end if;

  update bot.invite set used_at = now(), used_by = p_chat_id where code = v.code;
  return 'Готово, узнал вас. Нажмите «Меню».';
end $$;

-- ── Разметка ────────────────────────────────────────────────────────────────
--
-- Клавиатура собирается здесь же: кнопки — часть ответа, а не оформление.
-- Сценарий n8n не должен знать, какие кнопки бывают.

create or replace function bot.btn(p_text text, p_data text)
returns jsonb language sql immutable
as $$ select jsonb_build_object('text', p_text, 'callback_data', p_data) $$;

create or replace function bot.kb(variadic p_rows jsonb[])
returns jsonb language sql immutable
as $$ select jsonb_build_object('inline_keyboard', to_jsonb(p_rows)) $$;

-- ── Ответ бота ──────────────────────────────────────────────────────────────
--
-- Одна функция на весь бот. Возвращает jsonb: текст, клавиатура и то,
-- ждёт ли бот следующего сообщения как ввода.

create or replace function bot.render(p_chat_id bigint, p_input text)
returns jsonb
language plpgsql security definer set search_path = bot, core, crm, acc, app, public, pg_temp
as $$
declare
  w          record;
  v_action   text := coalesce(nullif(trim(p_input), ''), 'menu');
  v_state    text := 'idle';
  v_payload  jsonb := '{}'::jsonb;
  v_id       bigint;
  v_text     text;
  v_kb       jsonb;
  r          record;
  v_lines    text := '';
  v_n        int;
  v_sum      numeric;
  v_hyg      jsonb;
  v_tenant   uuid;
begin
  select * into w from bot.whoami(p_chat_id);

  -- Что бот спрашивал в прошлый раз.
  select s.state, s.payload into v_state, v_payload from bot.session s where s.chat_id = p_chat_id;
  v_state := coalesce(v_state, 'idle');

  -- Команды всегда сильнее ожидания ввода: человек имеет право передумать.
  if v_action like '/%' or v_action ~ '^[a-z]+(:[a-zA-Z0-9_-]+)*$' then
    if v_action in ('/start', '/menu') then v_action := 'menu'; end if;
  elsif v_state <> 'idle' then
    v_action := v_state || '!' || v_action;   -- ввод к ожидающему состоянию
  else
    v_action := 'free!' || v_action;          -- просто написал текст
  end if;

  -- ── Незнакомый чат ────────────────────────────────────────────────────────
  if w.role is null then
    select id into v_tenant from core.tenant where code = 'oberon';

    if v_action like 'link!%' then
      v_text := bot.link(p_chat_id, split_part(v_action, '!', 2));
      delete from bot.session where chat_id = p_chat_id;
      return jsonb_build_object('text', v_text, 'keyboard', bot.kb(
        jsonb_build_array(bot.btn('Меню', 'menu'))));
    end if;

    if v_action = 'link' then
      insert into bot.session (chat_id, tenant_id, state) values (p_chat_id, v_tenant, 'link')
      on conflict (chat_id) do update set state = 'link', updated_at = now();
      return jsonb_build_object('text',
        E'Пришлите код привязки — его выдаёт Oberon Studio в панели.\nКод из шести знаков, живёт неделю.');
    end if;

    if v_action = 'ask' then
      insert into bot.session (chat_id, tenant_id, state) values (p_chat_id, v_tenant, 'ask')
      on conflict (chat_id) do update set state = 'ask', updated_at = now();
      return jsonb_build_object('text',
        E'Опишите, что случилось, — несколькими предложениями.\nЧем конкретнее, тем быстрее отвечу: что за конфигурация, что делали, что написала программа.');
    end if;

    if v_action like 'ask!%' or v_action like 'free!%' then
      -- Обращение от незнакомого чата принимается так же, как с сайта:
      -- тем же путём, с теми же сроками и с тем же номером.
      v_text := split_part(v_action, '!', 2);
      if length(coalesce(v_text, '')) < 10 then
        insert into bot.session (chat_id, tenant_id, state) values (p_chat_id, v_tenant, 'ask')
        on conflict (chat_id) do update set state = 'ask', updated_at = now();
        return jsonb_build_object('text',
          'Опишите, что случилось, — несколькими предложениями. Чем конкретнее, тем быстрее отвечу.');
      end if;
      v_payload := public.submit_lead(jsonb_build_object(
        'name', 'Telegram ' || p_chat_id::text,
        'phone', 'tg:' || p_chat_id::text,
        'channel', 'telegram',
        'tg_chat_id', p_chat_id::text,
        'message', v_text));
      delete from bot.session where chat_id = p_chat_id;
      return jsonb_build_object('text', format(
        E'Принято. Номер обращения %s.\nОтвечу до %s.',
        v_payload->>'ref',
        to_char((v_payload->>'react_by')::timestamptz at time zone 'Asia/Almaty', 'DD.MM в HH24:MI')));
    end if;

    return jsonb_build_object('text',
      E'Это бот Oberon Studio — 1С, интеграции и автоматизация.\n\nМожно оставить обращение: отвечу в течение часа в рабочее время. Если вы уже клиент — привяжите чат по коду из панели, тогда будут видны ваши обращения, часы и счета.',
      'keyboard', bot.kb(
        jsonb_build_array(bot.btn('Оставить обращение', 'ask')),
        jsonb_build_array(bot.btn('Я клиент, есть код', 'link'))));
  end if;

  -- ── Клиент ────────────────────────────────────────────────────────────────
  if w.role = 'client' then
    if v_action = 'ask' then
      insert into bot.session (chat_id, tenant_id, state) values (p_chat_id, w.tenant_id, 'ask')
      on conflict (chat_id) do update set state = 'ask', updated_at = now();
      return jsonb_build_object('text',
        'Опишите задачу несколькими предложениями: что за база, что делали и что пошло не так.');
    end if;

    if v_action like 'ask!%' or v_action like 'free!%' then
      v_text := split_part(v_action, '!', 2);
      if length(coalesce(v_text, '')) < 10 then
        insert into bot.session (chat_id, tenant_id, state) values (p_chat_id, w.tenant_id, 'ask')
        on conflict (chat_id) do update set state = 'ask', updated_at = now();
        return jsonb_build_object('text', 'Опишите задачу несколькими предложениями.');
      end if;
      insert into crm.ticket (tenant_id, company_id, contact_id, channel, subject, body,
                              priority, status, received_at)
      values (w.tenant_id, w.company_id, w.contact_id, 'telegram',
              left(v_text, 120), v_text, 5, 'new', now())
      returning id into v_id;
      insert into crm.ticket_message (tenant_id, ticket_id, author, body)
      values (w.tenant_id, v_id, 'client', v_text);
      insert into core.job (tenant_id, job_type, agent_kind, priority, payload, dedupe_key)
      values (w.tenant_id, 'registrar.intake', 'registrar', 4,
              jsonb_build_object('ticket_id', v_id), 'ticket:' || v_id);
      delete from bot.session where chat_id = p_chat_id;
      return jsonb_build_object('text', format(
        E'Принято, номер %s.\nОтвечу до %s.',
        'OS-' || lpad(v_id::text, 5, '0'),
        to_char((select react_by from crm.ticket where id = v_id) at time zone 'Asia/Almaty',
                'DD.MM в HH24:MI')),
        'keyboard', bot.kb(jsonb_build_array(bot.btn('Мои обращения', 'my'))));
    end if;

    if v_action = 'my' then
      for r in
        select t.id, t.subject, t.status, t.react_by, t.first_reply_at
          from crm.ticket t
         where t.tenant_id = w.tenant_id and t.company_id is not distinct from w.company_id
         order by t.created_at desc limit 10
      loop
        v_lines := v_lines || format(E'%s — %s%s\n',
          'OS-' || lpad(r.id::text, 5, '0'), r.subject,
          case when r.status in ('done','cancelled') then ' (закрыто)'
               when r.first_reply_at is null then ' (жду ответа)'
               else ' (в работе)' end);
      end loop;
      return jsonb_build_object('text',
        coalesce(nullif(v_lines, ''), 'Обращений пока нет.'),
        'keyboard', bot.kb(
          jsonb_build_array(bot.btn('Новое обращение', 'ask')),
          jsonb_build_array(bot.btn('Меню', 'menu'))));
    end if;

    if v_action = 'plan' then
      select s.title, s.included_minutes, s.price, s.react_minutes,
             coalesce((select sum(te.minutes) from crm.time_entry te
                        join crm.ticket t on t.id = te.ticket_id
                       where t.company_id = s.company_id and te.billable
                         and te.started_at >= date_trunc('month', now())), 0) as used
        into r
        from crm.subscription s
       where s.tenant_id = w.tenant_id and s.company_id = w.company_id and s.status = 'active'
       limit 1;
      if r.title is null then
        return jsonb_build_object('text',
          E'Абонемента нет — работы считаются по часам.\nЕсли нужен пакет часов с обещанием ответа, напишите, подберём.',
          'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
      end if;
      return jsonb_build_object('text', format(
        E'Тариф: %s\nВключено: %s ч в месяц\nИзрасходовано: %s ч\nОстаток: %s ч\nОбещание по ответу: %s мин',
        r.title, round(r.included_minutes / 60.0, 1), round(r.used / 60.0, 1),
        round(greatest(0, r.included_minutes - r.used) / 60.0, 1), r.react_minutes),
        'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
    end if;

    if v_action = 'invoices' then
      for r in
        select d.number, d.amount, d.currency, d.status, d.due_on
          from crm.doc d
         where d.tenant_id = w.tenant_id and d.company_id = w.company_id and d.kind = 'invoice'
         order by d.issued_on desc limit 10
      loop
        v_lines := v_lines || format(E'%s — %s %s (%s)\n', r.number,
          trim(to_char(r.amount, 'FM999 999 990')), r.currency,
          case r.status when 'paid' then 'оплачен' when 'draft' then 'готовится'
                        when 'overdue' then 'просрочен' else 'выставлен' end);
      end loop;
      return jsonb_build_object('text', coalesce(nullif(v_lines, ''), 'Счетов пока нет.'),
        'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
    end if;

    return jsonb_build_object('text', format(E'%s, здравствуйте.\nЧем помочь?', coalesce(w.title, 'Добрый день')),
      'keyboard', bot.kb(
        jsonb_build_array(bot.btn('Новое обращение', 'ask')),
        jsonb_build_array(bot.btn('Мои обращения', 'my')),
        jsonb_build_array(bot.btn('Мой абонемент', 'plan'), bot.btn('Счета', 'invoices'))));
  end if;

  -- ── Владелец ──────────────────────────────────────────────────────────────

  if v_action like 'reply:%' then
    v_id := split_part(v_action, ':', 2)::bigint;
    insert into bot.session (chat_id, tenant_id, state, payload)
    values (p_chat_id, w.tenant_id, 'reply', jsonb_build_object('ticket', v_id))
    on conflict (chat_id) do update set state = 'reply',
      payload = jsonb_build_object('ticket', v_id), updated_at = now();
    return jsonb_build_object('text', format(
      'Пишите ответ по обращению %s. Он уйдёт клиенту как сообщение и закроет обещание по реакции.',
      'OS-' || lpad(v_id::text, 5, '0')));
  end if;

  if v_action like 'reply!%' then
    v_id := (v_payload->>'ticket')::bigint;
    v_text := split_part(v_action, '!', 2);
    insert into crm.ticket_message (tenant_id, ticket_id, author, body)
    values (w.tenant_id, v_id, 'me', v_text);
    -- Статус двигается только с 'new': дальше по нему ходит человек в
    -- панели, и бот не должен перепрыгивать через оценку и согласование.
    update crm.ticket set status = case when status = 'new' then 'in_work' else status end
     where id = v_id and tenant_id = w.tenant_id;
    delete from bot.session where chat_id = p_chat_id;
    return jsonb_build_object('text', format('Ответ записан по %s. Обещание по реакции закрыто.',
      'OS-' || lpad(v_id::text, 5, '0')),
      'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
  end if;

  if v_action like 'close:%' and v_action <> 'close:month' then
    v_id := split_part(v_action, ':', 2)::bigint;
    update crm.ticket set status = 'done' where id = v_id and tenant_id = w.tenant_id;
    return jsonb_build_object('text', format('Обращение %s закрыто.',
      'OS-' || lpad(v_id::text, 5, '0')),
      'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
  end if;

  if v_action like 'ticket:%' then
    v_id := split_part(v_action, ':', 2)::bigint;
    select t.id, t.subject, t.body, t.status, t.react_by, t.first_reply_at,
           coalesce(c.title, 'без компании') as company
      into r
      from crm.ticket t left join crm.company c on c.id = t.company_id
     where t.id = v_id and t.tenant_id = w.tenant_id;
    if r.id is null then
      return jsonb_build_object('text', 'Такого обращения нет.');
    end if;
    return jsonb_build_object('text', format(
      E'%s — %s\nКлиент: %s\nСостояние: %s\nОтвет обещан до: %s\n\n%s',
      'OS-' || lpad(r.id::text, 5, '0'), r.subject, r.company, r.status,
      coalesce(to_char(r.react_by at time zone 'Asia/Almaty', 'DD.MM HH24:MI'), '—'),
      left(r.body, 500)),
      'keyboard', bot.kb(
        jsonb_build_array(bot.btn('Ответить', 'reply:' || r.id)),
        jsonb_build_array(bot.btn('Закрыть обращение', 'close:' || r.id)),
        jsonb_build_array(bot.btn('Меню', 'menu'))));
  end if;

  if v_action in ('tickets', 'overdue') then
    for r in
      select t.id, t.subject, t.status, t.react_by, t.first_reply_at,
             coalesce(c.title, '—') as company
        from crm.ticket t left join crm.company c on c.id = t.company_id
       where t.tenant_id = w.tenant_id
         and t.status not in ('done','cancelled')
         and (v_action = 'tickets'
              or (t.react_by < now() and t.first_reply_at is null)
              or (t.resolve_by < now() and t.closed_at is null))
       order by t.react_by nulls last limit 10
    loop
      v_lines := v_lines || format(E'%s %s — %s (%s)\n',
        case when r.react_by < now() and r.first_reply_at is null then '🔴' else '•' end,
        'OS-' || lpad(r.id::text, 5, '0'), r.subject, r.company);
    end loop;
    return jsonb_build_object('text',
      coalesce(nullif(v_lines, ''),
        case when v_action = 'overdue' then 'Просроченных обещаний нет.' else 'Открытых обращений нет.' end)
      || E'\n\nОткрыть: пришлите номер, например 12',
      'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
  end if;

  if v_action = 'money' then
    select coalesce(expenses, 0) e, coalesce(hours_billable, 0) hb, coalesce(cost_per_hour, 0) cph
      into r from app.v_rate_health where month = date_trunc('month', current_date)::date;
    select count(*) filter (where status <> 'paid'),
           coalesce(sum(amount) filter (where status <> 'paid'), 0)
      into v_n, v_sum from crm.doc where kind = 'invoice' and tenant_id = w.tenant_id;
    return jsonb_build_object('text', format(
      E'Текущий месяц\nРасходы: %s ₸\nПродано часов: %s\nСебестоимость часа: %s ₸\n\nНе оплачено: %s счетов на %s ₸',
      trim(to_char(coalesce(r.e, 0), 'FM999 999 990')), coalesce(r.hb, 0),
      trim(to_char(coalesce(r.cph, 0), 'FM999 999 990')),
      v_n, trim(to_char(coalesce(v_sum, 0), 'FM999 999 990'))),
      'keyboard', bot.kb(
        jsonb_build_array(bot.btn('Закрытие месяца', 'close:month')),
        jsonb_build_array(bot.btn('Меню', 'menu'))));
  end if;

  if v_action = 'close:month' then
    select * into r from app.month_close();
    return jsonb_build_object('text', format(
      E'Закрытие месяца (%s)\n%s черновиков учёта\n%s ₸ расходов внесено\n%s ч продано, %s ч не выставлено\nСчетов по абонементам осталось: %s\n\n%s',
      to_char(r.month, 'MM.YYYY'), r.acc_drafts,
      trim(to_char(r.expenses_amount, 'FM999 999 990')), r.hours_billable, r.hours_unbilled,
      r.subs_pending,
      case when r.ready then 'Всё закрыто.' else 'Есть незакрытое — список выше.' end),
      'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
  end if;

  if v_action = 'health' then
    select * into r from app.v_system_health;
    select to_jsonb(h) into v_hyg from app.v_db_hygiene h;
    return jsonb_build_object('text', format(
      E'Состояние\nОчередь: %s ждут, мёртвых за неделю %s\nОшибок за неделю: %s\nПодтверждений ждут: %s\nРаннер: %s\nГигиена базы: %s',
      coalesce(r.oldest_wait_min, 0), r.jobs_dead_week, r.errors_week, r.approvals_pending,
      coalesce(to_char(r.runner_last_seen at time zone 'Asia/Almaty', 'DD.MM HH24:MI'), 'не запускался'),
      case when (v_hyg->>'hash_ok')::boolean
             and (v_hyg->>'tables_without_rls')::int = 0
             and (v_hyg->>'partitions_open')::int = 0
           then 'в порядке' else 'ЕСТЬ ЗАМЕЧАНИЯ' end),
      'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
  end if;

  if v_action = 'time' then
    select coalesce(sum(minutes), 0) m,
           coalesce(sum(minutes) filter (where billable), 0) b
      into r
      from crm.time_entry
     where tenant_id = w.tenant_id and started_at >= date_trunc('month', now());
    return jsonb_build_object('text', format(
      E'Месяц: %s ч отработано, из них продано %s ч.\nЗагрузка: %s%%',
      round(r.m / 60.0, 1), round(r.b / 60.0, 1),
      case when r.m = 0 then 0 else round(100.0 * r.b / r.m) end),
      'keyboard', bot.kb(jsonb_build_array(bot.btn('Меню', 'menu'))));
  end if;

  -- Номер обращения прямо текстом — самый частый способ открыть карточку.
  if v_action ~ '^free!\s*\d+\s*$' then
    return bot.render(p_chat_id, 'ticket:' || regexp_replace(v_action, '\D', '', 'g'));
  end if;

  select count(*) into v_n from app.v_sla_breach;
  return jsonb_build_object('text', format(
    E'%s, здравствуйте.%s',
    coalesce(w.title, 'Владелец'),
    case when v_n > 0 then format(E'\n\n🔴 Просрочено обещаний: %s', v_n) else '' end),
    'keyboard', bot.kb(
      jsonb_build_array(bot.btn('Обращения', 'tickets'), bot.btn('Просрочка', 'overdue')),
      jsonb_build_array(bot.btn('Деньги', 'money'), bot.btn('Время', 'time')),
      jsonb_build_array(bot.btn('Закрытие месяца', 'close:month')),
      jsonb_build_array(bot.btn('Состояние системы', 'health'))));
end $$;

comment on function bot.render(bigint, text) is
  'Ответ бота на любое сообщение: текст и кнопки. Вся логика и права — здесь, сценарий только передаёт.';

revoke all on function bot.render(bigint, text) from public;
revoke all on function bot.link(bigint, text) from public;
grant execute on function bot.render(bigint, text) to jarvis_worker;
grant execute on function bot.whoami(bigint) to jarvis_worker;

-- ── Выдача кода из панели ───────────────────────────────────────────────────

create or replace function public.bot_invite(p_contact uuid default null, p_person uuid default null)
returns text
language plpgsql security definer set search_path = bot, core, crm, public, pg_temp
as $$
declare v_tenant uuid := core.my_tenant(); v_code text;
begin
  if v_tenant is null or core.my_person() is null then
    raise exception 'код выдаёт человек';
  end if;
  if num_nonnulls(p_contact, p_person) <> 1 then
    raise exception 'нужен либо контакт клиента, либо человек';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into bot.invite (code, tenant_id, person_id, contact_id)
  values (v_code, v_tenant, p_person, p_contact);
  return v_code;
end $$;

comment on function public.bot_invite(uuid, uuid) is
  'Одноразовый код привязки чата Telegram. Живёт неделю, срабатывает один раз.';

revoke all on function public.bot_invite(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.bot_invite(uuid, uuid) to authenticated';
  end if;
end $$;
