-- 055. Заявки: форма, согласие на обработку ПД и метки клика fbclid/yclid — в колонки, а не в текст.
--
-- Зачем:
--   * форма (contact_form / demo_modal / ai_consultant) нужна экрану «Маркетинг» → «Откуда заявки»; до сих пор
--     она была только в служебной строке текста заявки;
--   * согласие на обработку ПД (Закон о ПД, ст. 8, 25) — время и версия текста согласия рядом с заявкой;
--     строка в тексте заявки остаётся как дубль для аварийного сообщения в Telegram;
--   * fbclid и yclid — сайт их снимает (campaign.js), но submit_lead отбрасывал всё, кроме utm_*; без них
--     нельзя вернуть конверсию в Meta/Директ без контактов клиента.
-- Функция — копия версии из 027 с этими тремя добавками; новые поля необязательны, старый /api/lead работает.
-- Повторный запуск безопасен.

alter table crm.ticket add column if not exists form            text;
alter table crm.ticket add column if not exists consent_at      timestamptz;
alter table crm.ticket add column if not exists consent_version text;

comment on column crm.ticket.form is 'Форма сайта, из которой пришла заявка (contact_form, demo_modal, ai_consultant…)';
comment on column crm.ticket.consent_at is 'Когда посетитель дал согласие на обработку ПД (время приёма заявки)';
comment on column crm.ticket.consent_version is 'Версия текста согласия на /privacy, которую видел посетитель';

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
  v_source  text := left(nullif(trim(payload->>'source'), ''), 60);
  v_consent boolean := coalesce(payload->>'consent', '') = 'true';
  v_cver    text := left(nullif(trim(payload->>'consent_version'), ''), 40);
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
   where key in ('utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','yclid')
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
                          landing_page, referrer, utm, form, consent_at, consent_version)
  values (v_tenant, v_company, v_channel, coalesce(v_email, v_phone), v_subject, v_body,
          case when v_company is null then 6 else 5 end,
          'new', v_dedupe, coalesce((payload->>'received_at')::timestamptz, now()),
          v_page, v_ref, coalesce(v_utm, '{}'::jsonb), v_source,
          case when v_consent then now() end, case when v_consent then v_cver end)
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
