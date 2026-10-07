-- 061. Счётчики частоты для публичных функций сайта (/api/chat, /api/lead).
--
-- Зачем (аудит 07.10.2026): /api/chat открыт всему интернету и на каждый вызов тратит деньги на модель;
-- предела частоты у него не было. Функциям Vercel нужен общий для всех экземпляров счётчик — память
-- экземпляра не годится: их много и они живут минуты.
--
-- Что здесь:
--   * core.site_rate — окна «минута/час/сутки» по произвольному ключу (bucket). Ключи — вида
--     'chat:ip:<HMAC IP с солью>' или 'chat:all'; сам IP сюда не попадает никогда. Строки старше
--     трёх суток вычищаются по ходу работы — хранить их дольше незачем.
--   * core.site_rate_check(p_checks) — проверка нескольких пределов разом: либо все проходят и все
--     счётчики растут, либо не растёт ни один. Зовут её только другие функции базы (submit_lead, 062).
--   * public.site_rate_take(p_checks) — обёртка для PostgREST. EXECUTE — ТОЛЬКО service_role:
--     ключ service_role есть лишь у функций Vercel. anon и вошедшие её не видят — иначе любой мог бы
--     выжечь чужой предел или сбросить свой.
--
-- core.rate_take (005) не подошла: она привязана к клиенту (tenant), считает только час/сутки и одну
-- проверку за вызов, а 060 закрыла её от всех, кроме раннера.
--
-- Повторный запуск безопасен: create if not exists / create or replace, права выдаются заново.

create table if not exists core.site_rate (
  bucket       text        not null check (length(bucket) between 1 and 120),
  window_kind  text        not null check (window_kind in ('minute', 'hour', 'day')),
  window_start timestamptz not null,
  used         int         not null default 0,
  primary key (bucket, window_kind, window_start)
);

comment on table core.site_rate is
  'Счётчики частоты публичных функций сайта (061). Ключи — хэши, не IP. Старше 3 суток удаляются.';

create index if not exists site_rate_window_idx on core.site_rate (window_start);

-- Таблица служебная: читать и писать её может только владелец функций ниже. RLS без политик =
-- для anon/authenticated строк нет даже при случайно выданных правах. FORCE не ставим намеренно:
-- владелец таблицы — он же владелец функций — должен её видеть, даже если сам RLS не обходит.
alter table core.site_rate enable row level security;
revoke all on table core.site_rate from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated', 'jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('revoke all on table core.site_rate from %I', rl);
    end if;
  end loop;
end $$;

-- p_checks: [{"bucket": "chat:all", "kind": "day", "limit": 400}, …] — от 1 до 10 проверок.
-- Ответ: {"allowed": true} или {"allowed": false, "bucket": …, "kind": …, "retry_after": секунд}.
create or replace function core.site_rate_check(p_checks jsonb)
returns jsonb
language plpgsql security definer set search_path = core, pg_temp
as $$
declare
  c        jsonb;
  v_bucket text;
  v_kind   text;
  v_limit  int;
  v_start  timestamptz;
  v_used   int;
begin
  if p_checks is null or jsonb_typeof(p_checks) <> 'array'
     or jsonb_array_length(p_checks) not between 1 and 10 then
    raise exception 'site_rate: ожидается массив из 1–10 проверок';
  end if;

  -- Уборка по ходу работы: примерно каждый пятидесятый вызов.
  if random() < 0.02 then
    delete from core.site_rate where window_start < now() - interval '3 days';
  end if;

  -- Проход 1: заводим окна и проверяем, не трогая счётчики. Строки берутся с блокировкой, поэтому
  -- два одновременных запроса не проскочат предел вдвоём.
  for c in select value from jsonb_array_elements(p_checks) loop
    v_bucket := left(nullif(trim(c->>'bucket'), ''), 120);
    v_kind   := c->>'kind';
    v_limit  := (c->>'limit')::int;
    if v_bucket is null or v_kind is null or v_kind not in ('minute', 'hour', 'day')
       or v_limit is null or v_limit < 0 then
      raise exception 'site_rate: неверная проверка %', c;
    end if;

    v_start := date_trunc(v_kind, now());
    insert into core.site_rate (bucket, window_kind, window_start)
         values (v_bucket, v_kind, v_start)
    on conflict do nothing;

    select used into v_used from core.site_rate
     where bucket = v_bucket and window_kind = v_kind and window_start = v_start
       for update;

    if v_used + 1 > v_limit then
      return jsonb_build_object(
        'allowed', false, 'bucket', v_bucket, 'kind', v_kind,
        'retry_after', greatest(1, ceil(extract(epoch from
          (v_start + ('1 ' || v_kind)::interval - now())))::int));
    end if;
  end loop;

  -- Проход 2: все пределы пройдены — списываем по единице с каждого.
  for c in select value from jsonb_array_elements(p_checks) loop
    v_bucket := left(nullif(trim(c->>'bucket'), ''), 120);
    v_kind   := c->>'kind';
    update core.site_rate set used = used + 1
     where bucket = v_bucket and window_kind = v_kind
       and window_start = date_trunc(v_kind, now());
  end loop;

  return jsonb_build_object('allowed', true);
end $$;

comment on function core.site_rate_check(jsonb) is
  'Пределы частоты сайта (061): все проверки проходят — счётчики растут, иначе не растёт ни один.';

create or replace function public.site_rate_take(p_checks jsonb)
returns jsonb
language sql security definer set search_path = core, pg_temp
as $$
  select core.site_rate_check(p_checks);
$$;

comment on function public.site_rate_take(jsonb) is
  'Пределы частоты для функций Vercel (/api/chat). Только service_role (061).';

-- Права. В схеме public Supabase по умолчанию выдаёт EXECUTE роли anon и authenticated на каждую
-- новую функцию, а Postgres — роли PUBLIC. Отзываем всё явно и выдаём одной service_role.
revoke all on function core.site_rate_check(jsonb) from public;
revoke all on function public.site_rate_take(jsonb) from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated', 'jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('revoke all on function core.site_rate_check(jsonb) from %I', rl);
      execute format('revoke all on function public.site_rate_take(jsonb) from %I', rl);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.site_rate_take(jsonb) to service_role';
  end if;
end $$;

-- Проверка после применения (ожидается: anon=false, authenticated=false, service_role=true):
-- select r as роль, has_function_privilege(r, 'public.site_rate_take(jsonb)', 'execute') as можно
--   from unnest(array['anon','authenticated','service_role']) r;
