-- 025. Расписка за заявку.
--
-- Сайт обещает ответ в течение часа. С точки зрения человека, отправившего
-- форму, это обещание ничем не подтверждено: он видит «спасибо» и уходит
-- в неизвестность. Половина повторных обращений и звонков «вы получили?» —
-- ровно об этом.
--
-- Расписка закрывает разрыв: номер, по которому можно спросить, и время,
-- до которого обещан ответ. Время не выдумывается в вёрстке — оно берётся
-- из того же поля, по которому панель считает просрочку (миграция 021).
-- Значит на сайте и в панели написано одно и то же, и разойтись они
-- не могут.
--
-- Возвращаемый тип меняется с bigint на jsonb, поэтому функция
-- пересоздаётся, а не заменяется: PostgreSQL не даёт сменить тип
-- результата у существующей функции.

drop function if exists public.submit_lead(jsonb);

create function public.submit_lead(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = crm, core, public
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
  -- Страница ВХОДА, а не страница отправки формы. Если её не прислали
  -- (старый клиент, письмо, бот) — берём ту, что есть.
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

  -- Предел частоты: форма не должна становиться каналом спама.
  if not core.rate_take(v_tenant, 'lead:' || v_channel, 'hour', 60) then
    raise exception 'слишком много обращений, попробуйте позже';
  end if;

  -- Метки кампании берём только известные и только строками.
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
  v_dedupe := encode(digest(
      coalesce(v_email,'') || '|' || coalesce(v_phone,'') || '|' ||
      left(v_body, 200) || '|' || to_char(now(), 'YYYY-MM-DD-HH24'), 'sha256'), 'hex');

  -- Повторная отправка получает ТУ ЖЕ расписку, а не новую заявку и не
  -- ошибку: человек нажал кнопку дважды, и с его точки зрения это одно
  -- обращение. Новый номер здесь означал бы, что мы потеряли первый.
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

  -- Задание Регистратору: разбор делает раннер (миграция 017).
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
