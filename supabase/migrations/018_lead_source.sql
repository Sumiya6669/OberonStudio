-- 018. Откуда пришла заявка.
--
-- Страница входа и так приезжала в форме — но складывалась в ТЕКСТ первого
-- сообщения. Прочитать её глазами можно, посчитать нельзя. А без счёта
-- продвижение остаётся верой: через три месяца никто не скажет, какая
-- страница привела клиентов, а какая просто существовала.
--
-- Поэтому источник переезжает в колонки заявки, и появляется витрина
-- «сколько заявок с какой страницы и сколько из них стали деньгами».

alter table crm.ticket
  add column if not exists landing_page text,
  add column if not exists referrer     text,
  add column if not exists utm          jsonb not null default '{}'::jsonb;

create index if not exists ticket_landing_idx
  on crm.ticket (tenant_id, landing_page, created_at desc);

comment on column crm.ticket.landing_page is
  'Страница ВХОДА на сайт. Не та, где нажали кнопку: важно, что привело, а не где решились.';
comment on column crm.ticket.referrer is
  'Откуда посетитель пришёл на сайт, если браузер сообщил.';
comment on column crm.ticket.utm is
  'Метки кампании: utm_source, utm_medium, utm_campaign, utm_content, utm_term.';

-- ── Приём заявки: те же правила плюс источник ────────────────────────────────
-- Функция переписывается целиком, а не «дополняется»: половина её тела —
-- это правила (предел частоты, защита от двойной отправки, опознание
-- клиента), и держать их в двух версиях нельзя.

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

  -- Метки кампании берём только известные и только строками. Складывать
  -- в базу произвольный объект из браузера — значит однажды получить туда
  -- килобайт мусора.
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

  select id into v_ticket from crm.ticket
   where tenant_id = v_tenant and dedupe_key = v_dedupe;
  if v_ticket is not null then
    return v_ticket;
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
  returning id into v_ticket;

  insert into crm.ticket_message (tenant_id, ticket_id, author, body)
  values (v_tenant, v_ticket, 'client',
          format(E'%s\n\nИмя: %s\nТелефон: %s\nEmail: %s\nКомпания: %s\nСтраница: %s',
                 v_body, v_name, coalesce(v_phone,'—'), coalesce(v_email,'—'),
                 coalesce(payload->>'company','—'), coalesce(v_form, v_page, '—')));

  -- Задание Регистратору: разбор делает раннер (миграция 017).
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

-- ── Витрина: откуда приходят заявки и что из них выходит ────────────────────
--
-- Про деньги отдельно. Один счёт может закрывать несколько заявок, поэтому
-- сумма делится между ними поровну. В обычном случае «один счёт — одна
-- заявка» это точная цифра; в остальных — оценка, и лучше честная оценка,
-- чем задвоенная сумма, которая выглядит как факт.

drop view if exists app.v_lead_source cascade;
create view app.v_lead_source with (security_invoker = true) as
with money as (
  select t.id as ticket_id,
         coalesce(sum(d.amount / nullif(array_length(d.ticket_ids, 1), 0)), 0) as invoiced,
         coalesce(sum(
           case when d.status = 'paid' then d.amount / nullif(array_length(d.ticket_ids, 1), 0)
                else 0 end), 0) as paid
    from crm.ticket t
    left join crm.doc d
           on d.tenant_id = t.tenant_id
          and d.kind = 'invoice'
          and d.status <> 'cancelled'
          and t.id = any (d.ticket_ids)
   group by t.id
),
hours as (
  select te.ticket_id, sum(te.minutes) / 60.0 as hours
    from crm.time_entry te group by te.ticket_id
)
select t.tenant_id,
       coalesce(nullif(t.landing_page, ''), '(страница не передана)') as page,
       t.channel,
       coalesce(
         nullif(t.utm->>'utm_source', ''),
         case
           when t.referrer is null or t.referrer = '' then '(прямой заход)'
           else split_part(regexp_replace(t.referrer, '^https?://(www\.)?', ''), '/', 1)
         end) as source,
       nullif(t.utm->>'utm_campaign', '') as campaign,
       date_trunc('month', t.created_at)::date as month,
       count(*)                                                  as leads,
       count(*) filter (where t.company_id is not null)          as recognised,
       count(*) filter (where t.status in ('approved','in_work','done')) as taken,
       count(*) filter (where t.status = 'done')                 as done,
       count(*) filter (where t.status = 'cancelled')            as cancelled,
       round(coalesce(sum(h.hours), 0)::numeric, 1)              as hours,
       round(coalesce(sum(m.invoiced), 0)::numeric, 2)           as invoiced,
       round(coalesce(sum(m.paid), 0)::numeric, 2)               as paid,
       min(t.created_at)                                         as first_at,
       max(t.created_at)                                         as last_at
  from crm.ticket t
  left join money m on m.ticket_id = t.id
  left join hours h on h.ticket_id = t.id
 group by t.tenant_id, 1, 2, 3, 4, 5, 6;

grant select on app.v_lead_source to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on app.v_lead_source to authenticated';
  end if;
end $$;

comment on view app.v_lead_source is
  'Заявки по странице входа и источнику: сколько пришло, сколько взято в работу, сколько выставлено и оплачено.';
