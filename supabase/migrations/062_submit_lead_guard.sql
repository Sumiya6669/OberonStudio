-- 062. submit_lead: прямой вызов мимо формы больше не обходит согласие и антиспам.
--
-- Дыра (аудит 07.10.2026): public.submit_lead открыта роли anon — так её зовёт /api/lead публичным
-- ключом. Но тот же ключ лежит в браузерном коде сайта, и любой мог вызвать функцию напрямую
-- (POST /rest/v1/rpc/submit_lead): без согласия на обработку ПД (его проверял только /api/lead),
-- с текстом до 8000 знаков, с чужим tenant, с поддельным received_at и tg_chat_id, и упираясь лишь
-- в общий предел 60 заявок в час — который заодно выжигал предел настоящей формы.
--
-- Выбранный вариант — проверки в самой функции, EXECUTE у anon остаётся. Почему не «закрыть anon и
-- звать только с ключом service_role»: тогда форма ломается в ту же секунду, как миграция применена
-- раньше, чем в Vercel заведён SUPABASE_SERVICE_ROLE_KEY и выложен новый /api/lead. Здесь порядок не
-- важен: старый /api/lead (anon) работает, новый (service_role, если ключ задан) — тоже.
--
-- Кто зовёт — по роли из JWT запроса PostgREST (request.jwt.claims):
--   anon / authenticated («публичный вызов»: старый /api/lead или кто угодно из интернета):
--     * без согласия (payload.consent = true) — отказ;
--     * клиент — всегда 'oberon', канал — всегда 'site', tg_chat_id игнорируется, received_at = now();
--     * длины: имя 120, контакт 200, почта 200, компания 200, текст 4000, тема 300;
--     * пределы: на один контакт 5 в час и 20 в сутки; на все публичные вызовы вместе 30 в час
--       (отдельный счётчик — прямой спам не выжигает больше половины общего предела 'lead:site').
--   service_role (новый /api/lead с SUPABASE_SERVICE_ROLE_KEY — доверенный сервер, согласие проверил он):
--     * те же длины и предел на контакт; плюс предел на хэш IP из payload.ip_hash (10 в час, 30 в сутки);
--     * tenant / channel / tg_chat_id / received_at — как передал сервер.
--   без JWT (прямое подключение: раннер jarvis_worker, бот bot.render) — как раньше, без новых проверок:
--     бот заводит заявку из Telegram без формы согласия, и это его отдельный сценарий.
-- Общий предел 'lead:<канал>' 60 в час (core.rate_take) — как был, для всех.
--
-- Счётчики — core.site_rate_check (миграция 061; применить её раньше этой).
-- Функция — копия версии из 055 с этими добавками; всё прочее (дедупликация, расписка, задание
-- регистратору, колонки form/consent_*) без изменений. Повторный запуск безопасен.

create or replace function public.submit_lead(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = crm, core, public, pg_temp
as $$
declare
  v_claims  jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role    text;
  v_public  boolean;
  v_server  boolean;
  v_tenant  uuid;
  v_email   text := nullif(trim(payload->>'email'), '');
  v_phone   text := nullif(trim(payload->>'phone'), '');
  v_name    text := nullif(trim(payload->>'name'), '');
  v_company_text text := nullif(trim(payload->>'company'), '');
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
  v_tg      text := nullif(payload->>'tg_chat_id', '');
  v_received timestamptz;
  v_ip      text := lower(nullif(trim(payload->>'ip_hash'), ''));
  v_contact text;
  v_checks  jsonb;
  v_gate    jsonb;
begin
  -- Кто зовёт. Нет JWT, но сессия PostgREST (authenticator) — считаем публичным: осторожнее.
  v_role := coalesce(v_claims->>'role', nullif(current_setting('request.jwt.claim.role', true), ''), '');
  v_server := v_role = 'service_role';
  v_public := v_role in ('anon', 'authenticated')
              or (v_role = '' and session_user = 'authenticator');

  if v_public then
    if not v_consent then
      raise exception 'нужно согласие на обработку персональных данных';
    end if;
    v_channel := 'site';
    v_tg := null;
    v_received := now();
    select id into v_tenant from core.tenant where code = 'oberon';
  else
    v_received := coalesce((payload->>'received_at')::timestamptz, now());
    select id into v_tenant from core.tenant
     where code = coalesce(nullif(payload->>'tenant',''), 'oberon');
  end if;

  if v_tenant is null then
    raise exception 'клиент не найден';
  end if;

  if v_public or v_server then
    v_name  := left(v_name, 120);
    v_phone := left(v_phone, 200);
    v_email := left(v_email, 200);
    v_company_text := left(v_company_text, 200);
  end if;

  if v_name is null or (v_phone is null and v_email is null) then
    raise exception 'нужны имя и хотя бы один контакт';
  end if;

  if v_channel not in ('site','email','telegram','phone','manual') then
    v_channel := 'site';
  end if;

  -- Пределы для вызовов снаружи: на контакт, на адрес (только от сервера) и на все публичные вместе.
  if v_public or v_server then
    v_contact := 'lead:c:' || left(core.sha256_hex(
        'lead-contact|' || coalesce(lower(v_email), '') || '|' ||
        coalesce(nullif(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), ''), lower(coalesce(v_phone, '')))),
      32);
    v_checks := jsonb_build_array(
      jsonb_build_object('bucket', v_contact, 'kind', 'hour', 'limit', 5),
      jsonb_build_object('bucket', v_contact, 'kind', 'day',  'limit', 20));

    if v_public then
      v_checks := v_checks || jsonb_build_array(
        jsonb_build_object('bucket', 'lead:public:all', 'kind', 'hour', 'limit', 30));
    elsif v_ip ~ '^[0-9a-f]{64}$' then
      v_checks := v_checks || jsonb_build_array(
        jsonb_build_object('bucket', 'lead:ip:' || left(v_ip, 32), 'kind', 'hour', 'limit', 10),
        jsonb_build_object('bucket', 'lead:ip:' || left(v_ip, 32), 'kind', 'day',  'limit', 30));
    end if;

    v_gate := core.site_rate_check(v_checks);
    if not coalesce((v_gate->>'allowed')::boolean, false) then
      raise exception 'слишком много обращений, попробуйте позже';
    end if;
  end if;

  if not core.rate_take(v_tenant, 'lead:' || v_channel, 'hour', 60) then
    raise exception 'слишком много обращений, попробуйте позже';
  end if;

  select coalesce(jsonb_object_agg(key, left(value, 200)), '{}'::jsonb)
    into v_utm
    from jsonb_each_text(coalesce(payload->'utm', '{}'::jsonb))
   where key in ('utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','yclid')
     and nullif(trim(value), '') is not null;

  v_body := left(coalesce(nullif(trim(payload->>'message'), ''), '(без текста)'),
                 case when v_public or v_server then 4000 else 8000 end);
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

  v_company := crm.resolve_company(v_tenant, v_email, v_phone, v_tg::bigint);

  insert into crm.ticket (tenant_id, company_id, channel, external_ref, subject, body,
                          priority, status, dedupe_key, received_at,
                          landing_page, referrer, utm, form, consent_at, consent_version)
  values (v_tenant, v_company, v_channel, coalesce(v_email, v_phone), v_subject, v_body,
          case when v_company is null then 6 else 5 end,
          'new', v_dedupe, v_received,
          v_page, v_ref, coalesce(v_utm, '{}'::jsonb), v_source,
          case when v_consent then now() end, case when v_consent then v_cver end)
  returning id, react_by into v_ticket, v_react;

  insert into crm.ticket_message (tenant_id, ticket_id, author, body)
  values (v_tenant, v_ticket, 'client',
          format(E'%s\n\nИмя: %s\nТелефон: %s\nEmail: %s\nКомпания: %s\nСтраница: %s',
                 v_body, v_name, coalesce(v_phone,'—'), coalesce(v_email,'—'),
                 coalesce(v_company_text,'—'), coalesce(v_form, v_page, '—')));

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
  'Приём заявки. Возвращает расписку: номер обращения и время, до которого обещан ответ. '
  'Публичный вызов (anon) — только с согласием на ПД и в пределах частоты (062).';

-- Права — как в 055 (форма через anon продолжает работать) плюс явно service_role для нового /api/lead.
revoke all on function public.submit_lead(jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.submit_lead(jsonb) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.submit_lead(jsonb) to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.submit_lead(jsonb) to service_role';
  end if;
end $$;
grant execute on function public.submit_lead(jsonb) to jarvis_worker;

-- ── Шаг 2, ПОТОМ и вручную (не часть этой миграции) ─────────────────────────────────────────────
-- Когда в Vercel заведён SUPABASE_SERVICE_ROLE_KEY, выложен новый /api/lead и пробная заявка с сайта
-- прошла, прямой вызов из интернета можно закрыть совсем. Заранее НЕ выполнять — форма перестанет
-- принимать заявки:
--   revoke execute on function public.submit_lead(jsonb) from anon, authenticated;
--
-- Проверка после применения (ожидается ошибка «нужно согласие…»; rollback — чтобы ничего не осталось),
-- из SQL Editor одним запуском:
--   begin;
--   select set_config('request.jwt.claims', '{"role":"anon"}', true);
--   set local role anon;
--   select public.submit_lead('{"name":"т","phone":"1"}'::jsonb);
--   rollback;
