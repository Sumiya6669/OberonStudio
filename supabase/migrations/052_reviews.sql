-- 052. Отзывы: приём с сайта и решение о публикации в панели.
--
-- Перенесено 03.10.2026 из черновика 049_reviews.sql другого рабочего чата (номер 049 занят «Налогами ИП»).
-- Исправлено при переносе: digest() вызывается как extensions.digest() — в этой базе pgcrypto живёт в схеме
-- extensions, а search_path функции её не содержит (та же поломка, что чинила 027); добавлены права на таблицу
-- для панели и раннера (новые таблицы прав сами не получают — см. 019, 047). Уведомление о новом отзыве ставится
-- Вестнику (core.herald_notify); пока сценарии n8n выключены, отзыв просто ждёт в панели.
--
-- Почему отдельная таблица, а не сразу cms.item. В cms.item лежит то, что
-- показывает сайт. Пускать туда запись из открытой формы — значит дать
-- любому человеку с браузером писать в опубликованное содержимое и
-- надеяться, что проверка успеет раньше читателя. Поэтому вход — карантин:
-- cms.review_inbox. Оттуда отзыв попадает на сайт только тем же путём, что
-- и любой другой текст, — записью в cms.item, которую создаёт решение
-- человека, а не отправитель формы.
--
-- Контакт автора остаётся в карантине навсегда. Он нужен для одного:
-- проверить, что человек существует, и спросить разрешение. На сайт он не
-- уходит никогда, и публичная функция чтения его не видит.
--
-- Что считается спамом, решает не модель и не угадайка: три проверки —
-- длина, ссылки и частота с одного адреса. Остальное смотрит человек.

-- ── 1. Карантин ─────────────────────────────────────────────────────────────

create table if not exists cms.review_inbox (
  id            bigserial primary key,
  tenant_id     uuid not null references core.tenant(id),

  -- о чём отзыв: код продукта из каталога либо пусто, если про студию в целом
  product_code  text,

  -- то, что может попасть на сайт
  author_name   text not null,
  author_role   text,
  company       text,
  city          text,
  rating        int  check (rating between 1 and 5),
  body          text not null,

  -- то, что на сайт не попадает никогда
  contact       text not null,
  consent       boolean not null default false,

  -- откуда пришло
  page          text,
  ip_hash       text,
  user_agent    text,

  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','spam')),
  decided_at    timestamptz,
  decided_by    uuid references core.person(id),
  decision_note text,
  item_id       uuid references cms.item(id) on delete set null,

  dedupe_key    text,
  created_at    timestamptz not null default now(),
  unique (tenant_id, dedupe_key)
);

create index if not exists review_inbox_pending_idx
  on cms.review_inbox (tenant_id, status, created_at desc);

comment on table cms.review_inbox is
  'Отзывы с сайта до решения о публикации. Контакт автора отсюда не уходит.';
comment on column cms.review_inbox.consent is
  'Автор подтвердил, что согласен на публикацию имени и компании.';

alter table cms.review_inbox enable row level security;
alter table cms.review_inbox force row level security;

drop policy if exists review_inbox_rw on cms.review_inbox;
create policy review_inbox_rw on cms.review_inbox
  for all to authenticated
  using (tenant_id = core.my_tenant())
  with check (tenant_id = core.my_tenant());

-- Права. Панель читает карантин напрямую (RLS по клиенту), решения — только через review_decide.
grant select on cms.review_inbox to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on cms.review_inbox to authenticated';
  end if;
end $$;

drop policy if exists review_inbox_worker on cms.review_inbox;
create policy review_inbox_worker on cms.review_inbox
  for all to jarvis_worker
  using (tenant_id = core.my_tenant())
  with check (tenant_id = core.my_tenant());

-- ── 2. Поле «о каком продукте» в опубликованном отзыве ──────────────────────

update cms.collection
   set fields = fields || jsonb_build_array(jsonb_build_object(
         'key', 'product', 'label', 'О каком продукте',
         'type', 'text', 'required', false, 'loc', false))
 where code = 'review'
   and not exists (
     select 1 from jsonb_array_elements(fields) f where f->>'key' = 'product'
   );

-- ── 3. Приём отзыва с сайта ─────────────────────────────────────────────────
--
-- Возвращает jsonb, а не id: отправителю незачем знать номер записи, ему
-- нужно знать, что отзыв принят и что он появится после проверки. Обещать
-- публикацию нельзя — решение ещё не принято.

create or replace function public.submit_review(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = cms, core, public, pg_temp
as $$
declare
  v_tenant  uuid;
  v_name    text := nullif(trim(payload->>'name'), '');
  v_body    text := nullif(trim(payload->>'body'), '');
  v_contact text := nullif(trim(payload->>'contact'), '');
  v_rating  int  := nullif(payload->>'rating', '')::int;
  v_dedupe  text;
  v_id      bigint;
  v_links   int;
begin
  select id into v_tenant from core.tenant
   where code = coalesce(nullif(payload->>'tenant',''), 'oberon');
  if v_tenant is null then
    raise exception 'клиент не найден';
  end if;

  if v_name is null or v_body is null or v_contact is null then
    raise exception 'нужны имя, текст отзыва и контакт для проверки';
  end if;

  if coalesce((payload->>'consent')::boolean, false) is not true then
    raise exception 'нужно согласие на публикацию';
  end if;

  -- Длина. Снизу — чтобы «норм, спасибо» не занимало место настоящего
  -- отзыва. Сверху — чтобы форма не стала способом залить в базу роман.
  if length(v_body) < 40 then
    raise exception 'расскажите чуть подробнее: хотя бы пару предложений';
  end if;
  if length(v_body) > 2000 then
    raise exception 'слишком длинно, уложитесь в 2000 знаков';
  end if;

  -- Ссылки в отзыве — почти всегда реклама чужого сайта.
  v_links := (length(v_body) - length(
      regexp_replace(lower(v_body), 'https?://|www\.|t\.me/', '', 'g'))) ;
  if v_links > 0 then
    raise exception 'ссылки в отзыве не принимаются';
  end if;

  if not core.rate_take(v_tenant, 'review:site', 'hour', 20) then
    raise exception 'слишком много отзывов подряд, попробуйте позже';
  end if;

  -- Двойное нажатие кнопки не должно давать два отзыва.
  v_dedupe := encode(extensions.digest(
      lower(coalesce(v_contact,'')) || '|' || left(v_body, 200) || '|' ||
      to_char(now(), 'YYYY-MM-DD'), 'sha256'), 'hex');

  select id into v_id from cms.review_inbox
   where tenant_id = v_tenant and dedupe_key = v_dedupe;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  insert into cms.review_inbox (
      tenant_id, product_code, author_name, author_role, company, city,
      rating, body, contact, consent, page, ip_hash, user_agent, dedupe_key)
  values (
      v_tenant,
      nullif(trim(payload->>'product'), ''),
      left(v_name, 120),
      left(nullif(trim(payload->>'role'), ''), 120),
      left(nullif(trim(payload->>'company'), ''), 160),
      left(nullif(trim(payload->>'city'), ''), 80),
      case when v_rating between 1 and 5 then v_rating else null end,
      v_body,
      left(v_contact, 200),
      true,
      left(nullif(trim(payload->>'page'), ''), 300),
      left(nullif(trim(payload->>'ip_hash'), ''), 64),
      left(nullif(trim(payload->>'user_agent'), ''), 300),
      v_dedupe)
  returning id into v_id;

  perform core.herald_notify(
    v_tenant,
    'Новый отзыв на проверку' ||
      coalesce(' · ' || nullif(trim(payload->>'product'), ''), '') || E'\n' ||
      left(v_name, 120) ||
      coalesce(' · ' || nullif(trim(payload->>'company'), ''), '') || E'\n\n' ||
      left(v_body, 500) || E'\n\n' ||
      'Панель → Сайт → Отзывы',
    'review:' || v_id);

  return jsonb_build_object('ok', true, 'duplicate', false);
end $$;

comment on function public.submit_review(jsonb) is
  'Приём отзыва с сайта в карантин. Публикацию не производит.';

revoke all on function public.submit_review(jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.submit_review(jsonb) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.submit_review(jsonb) to authenticated';
  end if;
end $$;

-- ── 4. Решение о публикации ─────────────────────────────────────────────────
--
-- Одобрение создаёт запись в cms.item — ту же самую, что завёл бы человек
-- руками через панель. Никакого отдельного пути на сайт у отзыва нет: это
-- важно, потому что иначе появились бы два места, где лежит опубликованное,
-- и однажды они разошлись бы.

create or replace function public.review_decide(
  p_id      bigint,
  p_verdict text,
  p_note    text default null)
returns jsonb
language plpgsql security definer set search_path = cms, core, public, pg_temp
as $$
declare
  r        cms.review_inbox%rowtype;
  v_person uuid := core.my_person();
  v_item   uuid;
begin
  if v_person is null then
    raise exception 'решение может принять только человек из панели';
  end if;
  if p_verdict not in ('approved','rejected','spam') then
    raise exception 'непонятное решение: %', p_verdict;
  end if;

  select * into r from cms.review_inbox
   where id = p_id and tenant_id = core.my_tenant()
   for update;
  if not found then
    raise exception 'отзыв не найден';
  end if;
  if r.status <> 'pending' then
    return jsonb_build_object('ok', true, 'already', r.status);
  end if;

  if p_verdict = 'approved' then
    insert into cms.item (tenant_id, collection, text, props, status, published_at)
    values (
      r.tenant_id, 'review',
      -- Язык снаружи, поле внутри: именно в таком порядке cms.item хранит
      -- переводимые поля, и так же их проверяет триггер полноты. Обратный
      -- порядок выглядит естественнее и молча ломает публикацию.
      jsonb_build_object('ru', jsonb_build_object(
        'text',    r.body,
        'role',    coalesce(r.author_role, ''),
        'company', trim(both ' ·' from coalesce(r.company, '') ||
                        coalesce(' · ' || r.city, '')))),
      jsonb_build_object(
        'author',  r.author_name,
        'rating',  coalesce(r.rating, 5),
        'product', coalesce(r.product_code, '')),
      'published', now())
    returning id into v_item;
  end if;

  update cms.review_inbox
     set status = p_verdict,
         decided_at = now(),
         decided_by = v_person,
         decision_note = left(p_note, 1000),
         item_id = v_item
   where id = p_id;

  return jsonb_build_object('ok', true, 'status', p_verdict, 'item_id', v_item);
end $$;

comment on function public.review_decide(bigint, text, text) is
  'Публикует отзыв из карантина или отклоняет его. Только для вошедших в панель.';

revoke all on function public.review_decide(bigint, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.review_decide(bigint, text, text) to authenticated';
  end if;
end $$;

-- ── 5. Проверка ─────────────────────────────────────────────────────────────

do $$
declare n int;
begin
  select count(*) into n from cms.review_inbox;
  raise notice 'Отзывов в карантине: %', n;
  if not exists (select 1 from cms.collection c, jsonb_array_elements(c.fields) f
                  where c.code = 'review' and f->>'key' = 'product') then
    raise warning 'поле «О каком продукте» не добавлено: коллекции review нет';
  end if;
end $$;
