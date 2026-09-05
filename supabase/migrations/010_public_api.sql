-- 010. Публичный приём заявок. Ключ service_role не используется нигде:
-- форма попадает в базу через одну функцию с ограниченными правами.

-- Опознание клиента по домену почты, телефону или чату — ПРАВИЛО, а не модель.
-- Три точных сопоставления подряд; ни одно не сработало — заявка без компании,
-- и это честнее, чем догадка.
create or replace function crm.resolve_company(
  p_tenant uuid, p_email text, p_phone text, p_tg bigint default null
) returns uuid
language sql stable security definer set search_path = crm, public
as $$
  select coalesce(
    (select c.id from crm.company c
      where c.tenant_id = p_tenant
        and p_email is not null and position('@' in p_email) > 0
        and c.domains && array[lower(split_part(p_email, '@', 2))]
      limit 1),
    (select c.id from crm.company c
      where c.tenant_id = p_tenant and p_phone is not null
        and c.phones && array[regexp_replace(p_phone, '[^0-9]', '', 'g')]
      limit 1),
    (select ct.company_id from crm.contact ct
      where ct.tenant_id = p_tenant and p_tg is not null and ct.tg_chat_id = p_tg
      limit 1)
  );
$$;

-- Приём заявки: форма сайта, письмо, сообщение боту.
-- Возвращает id заявки; при повторной отправке той же формы — id прежней.
create or replace function public.submit_lead(payload jsonb)
returns bigint
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

  v_body := left(coalesce(nullif(trim(payload->>'message'), ''), '(без текста)'), 8000);
  v_subject := left(coalesce(
      nullif(trim(payload->>'subject'), ''),
      nullif(trim(payload->>'service'), ''),
      'Заявка с сайта: ' || v_name), 300);

  -- Защита от двойной отправки формы: тот же контакт и тот же текст за час.
  v_dedupe := encode(digest(
      coalesce(v_email,'') || '|' || coalesce(v_phone,'') || '|' ||
      left(v_body, 200) || '|' || to_char(now(), 'YYYY-MM-DD-HH24'), 'sha256'), 'hex');

  select id into v_ticket from crm.ticket
   where tenant_id = v_tenant and dedupe_key = v_dedupe;
  if v_ticket is not null then
    return v_ticket;
  end if;

  v_company := crm.resolve_company(v_tenant, v_email, v_phone,
                                   nullif(payload->>'tg_chat_id','')::bigint);

  insert into crm.ticket (tenant_id, company_id, channel, external_ref, subject, body,
                          priority, status, dedupe_key, received_at)
  values (v_tenant, v_company, v_channel, coalesce(v_email, v_phone), v_subject, v_body,
          case when v_company is null then 6 else 5 end,
          'new', v_dedupe, coalesce((payload->>'received_at')::timestamptz, now()))
  returning id into v_ticket;

  insert into crm.ticket_message (tenant_id, ticket_id, author, body)
  values (v_tenant, v_ticket, 'client',
          format(E'%s\n\nИмя: %s\nТелефон: %s\nEmail: %s\nКомпания: %s\nСтраница: %s',
                 v_body, v_name, coalesce(v_phone,'—'), coalesce(v_email,'—'),
                 coalesce(payload->>'company','—'), coalesce(payload->>'page','—')));

  -- Задание Регистратору: классифицировать и уточнить привязку.
  insert into core.job (tenant_id, job_type, agent_kind, priority, payload, dedupe_key)
  values (v_tenant, 'registrar.intake', 'registrar', 4,
          jsonb_build_object('ticket_id', v_ticket), 'ticket:' || v_ticket);

  return v_ticket;
end $$;

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
