-- 067. Свой учёт посещений сайта — без Яндекс Метрики, без cookie и без данных посетителя.
--
-- Зачем: Метрика у нас грузится только после согласия на cookie, а с 08.10.2026 у Яндекса ещё и
-- сбои дата-центров. Владельцу нужно видеть поток независимо от Метрики: сколько заходов по дням,
-- откуда пришли (поисковики, мессенджеры, соцсети, 2ГИС, другие сайты, напрямую, метки
-- utm_source), какие страницы смотрят и на какие входят из поиска. Слов поиска здесь нет и не
-- будет: их знают только поисковики.
--
-- (Номер 067, а не 066: 066_answer_snt_srok.sql уже занят разбором /1c.)
--
-- Что здесь:
--   * cms.site_visits — только счётчики-агрегаты. Строка = (день по времени Астаны, вид, путь,
--     источник, уточнение) → число. Вид: 'view' — просмотр страницы (источник и уточнение пустые),
--     'entry' — вход на сайт (первая страница вкладки) с источником. Уточнение: для источника
--     'site' — домен другого сайта (без пути и параметров, не длиннее трёх последних частей),
--     для 'utm' — значение utm_source; у остальных пусто.
--     ЧЕГО НЕТ И НЕ БУДЕТ: IP и его хэшей, user-agent, номера посетителя или сессии, cookie,
--     полного адреса перехода, query-параметров страницы, времени отдельного визита. Связать
--     два просмотра одного человека по этой таблице нельзя.
--   * public.site_visit_hit(p_path, p_entry, p_source, p_detail) — «засчитать». Зовёт браузер
--     посетителя публичным ключом (anon) — src/lib/site/siteVisits.js. Ответ true/false
--     (засчитано или нет). Неверный формат и предел частоты — просто false, без ошибки.
--   * public.site_visits_report(p_days) — сводка за последние N дней (1–366) одним jsonb: по дням,
--     источники, домены, метки, топ страниц, страницы входа из поиска. ТОЛЬКО для вошедших в
--     панель: authenticated + активный человек (core.my_person) с ролью панели (core.my_roles —
--     owner / approver / operator / viewer), как экраны «Маркетинга» и «Находок» (064). anon
--     её не видит (нет EXECUTE), а вошедший без роли получает ошибку прав.
--
-- Формат (то же проверяет клиент, src/lib/site/visitSource.js):
--   * путь — латиница в нижнем регистре, цифры, одиночные дефисы, сегменты через «/», до 100
--     знаков, без ?query и #hash (так устроены все адреса сайта); /admin… не принимается. Чужой
--     формат — не пишем вовсе;
--   * источник — один из 11 кодов ниже; домен и метка проверяются по формату, мусор — пустая
--     строка («другой сайт, адрес не показан» / «метка нестандартная»).
--
-- Защита от накрутки — в самой функции, через core.site_rate_check (061), как в 062 и 065:
--   * на сайт целиком: 600 в минуту и 12 000 в час; входов: 150 в минуту и 3000 в час;
--   * на один путь: 60 в минуту и 1000 в час;
--   * новая строка (новое сочетание за день): 400 в час; новый путь (которого в таблице не было
--     никогда): 30 в час; новый домен или метка: 30 в час;
--   * не больше 3000 строк за один день и 200 000 строк всего — иначе бот завалил бы таблицу
--     выдуманными путями. Строки старше 400 дней удаляются по ходу работы.
-- Предела «на посетителя» нет намеренно: для него нужен IP или его хэш, а их мы не храним. Цена —
-- бот может выбрать предел и в этот час часть настоящих посещений не засчитается.
--
-- День — по времени Астаны: UTC+5 явным сдвигом. Не через 'Asia/Almaty': Казахстан перешёл на
-- единое UTC+5 с 01.03.2024, и на базе со старой tzdata зона дала бы +6.
--
-- Права: на таблицу у anon/authenticated прав нет вовсе, RLS включён без политик. Пишет и читает
-- только две функции выше (security definer, search_path пустой, все имена — со схемой).
--
-- Порядок: 038 (core.my_roles), 061 (core.site_rate_check) должны быть применены раньше.
-- Повторный запуск безопасен: create if not exists / create or replace, права выдаются заново.

-- ── 1. Таблица ──────────────────────────────────────────────────────────────

create table if not exists cms.site_visits (
  day     date   not null,
  kind    text   not null check (kind in ('view', 'entry')),
  path    text   not null
          check (length(path) between 1 and 100
                 and path ~ '^/([a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*)?$'),
  source  text   not null default '',
  detail  text   not null default '' check (length(detail) <= 100),
  hits    bigint not null default 0 check (hits >= 0),
  primary key (day, kind, path, source, detail),
  constraint site_visits_source_check check (
    (kind = 'view' and source = '' and detail = '')
    or (kind = 'entry' and source in ('direct', 'google', 'yandex', 'bing', 'telegram', 'whatsapp',
                                      'instagram', 'facebook', '2gis', 'site', 'utm')
        and (detail = '' or source in ('site', 'utm'))))
);

comment on table cms.site_visits is
  'Посещения сайта (067): счётчики по дню, пути и источнику. Без IP, user-agent, cookie и номеров посетителей.';

-- «Был ли такой путь / домен когда-нибудь» — для пределов на новое.
create index if not exists site_visits_path_idx   on cms.site_visits (path);
create index if not exists site_visits_detail_idx on cms.site_visits (source, detail) where detail <> '';

alter table cms.site_visits enable row level security;
revoke all on table cms.site_visits from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('revoke all on table cms.site_visits from %I', rl);
    end if;
  end loop;
end $$;

-- ── 2. Засчитать посещение ──────────────────────────────────────────────────

create or replace function public.site_visit_hit(
  p_path   text,
  p_entry  boolean default false,
  p_source text    default null,
  p_detail text    default null)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_path       text    := lower(trim(coalesce(p_path, '')));
  v_entry      boolean := coalesce(p_entry, false);
  v_source     text    := '';
  v_detail     text    := '';
  v_day        date    := ((now() at time zone 'UTC') + interval '5 hours')::date;
  v_new_row    boolean := false;
  v_checks     jsonb;
  v_gate       jsonb;
begin
  -- Путь: только формат адресов сайта, без панели.
  if length(v_path) not between 1 and 100
     or v_path !~ '^/([a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*)?$'
     or v_path = '/admin' or v_path like '/admin/%' then
    return false;
  end if;

  -- Источник: только у входа. Неизвестный код — не пишем; мусор в уточнении — пустая строка.
  if v_entry then
    v_source := lower(trim(coalesce(p_source, '')));
    v_detail := lower(trim(coalesce(p_detail, '')));
    if v_source not in ('direct', 'google', 'yandex', 'bing', 'telegram', 'whatsapp',
                        'instagram', 'facebook', '2gis', 'site', 'utm') then
      return false;
    end if;
    if v_source = 'site' then
      if length(v_detail) > 100
         or v_detail !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
         or v_detail !~ '[a-z][a-z0-9-]*$' then
        v_detail := '';
      end if;
    elsif v_source = 'utm' then
      if v_detail !~ '^[a-z0-9][a-z0-9._-]{0,39}$' then
        v_detail := '';
      end if;
    else
      v_detail := '';
    end if;
  end if;

  v_checks := jsonb_build_array(
    jsonb_build_object('bucket', 'sv:all',          'kind', 'minute', 'limit', 600),
    jsonb_build_object('bucket', 'sv:all',          'kind', 'hour',   'limit', 12000),
    jsonb_build_object('bucket', 'sv:p:' || v_path, 'kind', 'minute', 'limit', 60),
    jsonb_build_object('bucket', 'sv:p:' || v_path, 'kind', 'hour',   'limit', 1000));
  if v_entry then
    v_checks := v_checks || jsonb_build_array(
      jsonb_build_object('bucket', 'sv:entry', 'kind', 'minute', 'limit', 150),
      jsonb_build_object('bucket', 'sv:entry', 'kind', 'hour',   'limit', 3000));
  end if;

  -- Новые строки: свой предел и потолок числа строк.
  v_new_row := not exists (
      select 1 from cms.site_visits t
       where t.day = v_day and t.kind = 'view' and t.path = v_path and t.source = '' and t.detail = '')
    or (v_entry and not exists (
      select 1 from cms.site_visits t
       where t.day = v_day and t.kind = 'entry' and t.path = v_path
         and t.source = v_source and t.detail = v_detail));

  if v_new_row then
    if (select count(*) from cms.site_visits t where t.day = v_day) >= 3000
       or (select count(*) from cms.site_visits) >= 200000 then
      return false;
    end if;
    v_checks := v_checks || jsonb_build_array(
      jsonb_build_object('bucket', 'sv:row', 'kind', 'hour', 'limit', 400));
    if not exists (select 1 from cms.site_visits t where t.path = v_path) then
      v_checks := v_checks || jsonb_build_array(
        jsonb_build_object('bucket', 'sv:new-path', 'kind', 'hour', 'limit', 30));
    end if;
    if v_detail <> '' and not exists (
         select 1 from cms.site_visits t where t.source = v_source and t.detail = v_detail) then
      v_checks := v_checks || jsonb_build_array(
        jsonb_build_object('bucket', 'sv:new-detail', 'kind', 'hour', 'limit', 30));
    end if;
  end if;

  v_gate := core.site_rate_check(v_checks);
  if not coalesce((v_gate->>'allowed')::boolean, false) then
    return false;
  end if;

  -- Уборка по ходу работы: примерно каждый сотый вызов.
  if random() < 0.01 then
    delete from cms.site_visits t where t.day < v_day - 400;
  end if;

  insert into cms.site_visits as t (day, kind, path, source, detail, hits)
       values (v_day, 'view', v_path, '', '', 1)
  on conflict (day, kind, path, source, detail) do update set hits = t.hits + 1;

  if v_entry then
    insert into cms.site_visits as t (day, kind, path, source, detail, hits)
         values (v_day, 'entry', v_path, v_source, v_detail, 1)
    on conflict (day, kind, path, source, detail) do update set hits = t.hits + 1;
  end if;

  return true;
end $$;

comment on function public.site_visit_hit(text, boolean, text, text) is
  'Засчитать просмотр страницы (и вход с источником): формат и пределы частоты (067). Для anon.';

-- ── 3. Сводка для панели ────────────────────────────────────────────────────

create or replace function public.site_visits_report(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_days int  := least(greatest(coalesce(p_days, 30), 1), 366);
  v_to   date := ((now() at time zone 'UTC') + interval '5 hours')::date;
  v_from date;
begin
  if core.my_person() is null
     or not (core.my_roles() && array['owner', 'approver', 'operator', 'viewer']::text[]) then
    raise exception 'посещения сайта видны только в панели'
      using errcode = '42501', hint = 'Нужен вход в панель с ролью.';
  end if;
  v_from := v_to - (v_days - 1);

  return jsonb_build_object(
    'from', v_from,
    'to',   v_to,
    'totals', (
      select jsonb_build_object(
               'entries', coalesce(sum(t.hits) filter (where t.kind = 'entry'), 0),
               'views',   coalesce(sum(t.hits) filter (where t.kind = 'view'), 0))
        from cms.site_visits t
       where t.day between v_from and v_to),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'entries', d.entries, 'views', d.views)
                       order by d.day)
        from (select t.day,
                     coalesce(sum(t.hits) filter (where t.kind = 'entry'), 0) as entries,
                     coalesce(sum(t.hits) filter (where t.kind = 'view'), 0)  as views
                from cms.site_visits t
               where t.day between v_from and v_to
               group by t.day) d), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', s.source, 'entries', s.entries)
                       order by s.entries desc, s.source)
        from (select t.source, sum(t.hits) as entries
                from cms.site_visits t
               where t.kind = 'entry' and t.day between v_from and v_to
               group by t.source) s), '[]'::jsonb),
    'domains', coalesce((
      select jsonb_agg(jsonb_build_object('detail', s.detail, 'entries', s.entries)
                       order by s.entries desc, s.detail)
        from (select t.detail, sum(t.hits) as entries
                from cms.site_visits t
               where t.kind = 'entry' and t.source = 'site' and t.day between v_from and v_to
               group by t.detail
               order by 2 desc, 1
               limit 50) s), '[]'::jsonb),
    'utm', coalesce((
      select jsonb_agg(jsonb_build_object('detail', s.detail, 'entries', s.entries)
                       order by s.entries desc, s.detail)
        from (select t.detail, sum(t.hits) as entries
                from cms.site_visits t
               where t.kind = 'entry' and t.source = 'utm' and t.day between v_from and v_to
               group by t.detail
               order by 2 desc, 1
               limit 50) s), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', s.path, 'views', s.views, 'entries', s.entries)
                       order by s.views desc, s.path)
        from (select t.path,
                     coalesce(sum(t.hits) filter (where t.kind = 'view'), 0)  as views,
                     coalesce(sum(t.hits) filter (where t.kind = 'entry'), 0) as entries
                from cms.site_visits t
               where t.day between v_from and v_to
               group by t.path
               order by 2 desc, 1
               limit 100) s), '[]'::jsonb),
    'search', coalesce((
      select jsonb_agg(jsonb_build_object('path', s.path, 'google', s.google, 'yandex', s.yandex,
                                          'bing', s.bing, 'total', s.total)
                       order by s.total desc, s.path)
        from (select t.path,
                     coalesce(sum(t.hits) filter (where t.source = 'google'), 0) as google,
                     coalesce(sum(t.hits) filter (where t.source = 'yandex'), 0) as yandex,
                     coalesce(sum(t.hits) filter (where t.source = 'bing'), 0)   as bing,
                     sum(t.hits) as total
                from cms.site_visits t
               where t.kind = 'entry' and t.source in ('google', 'yandex', 'bing')
                 and t.day between v_from and v_to
               group by t.path
               order by 5 desc, 1
               limit 50) s), '[]'::jsonb));
end $$;

comment on function public.site_visits_report(int) is
  'Сводка посещений сайта за N дней (067). Только вошедшим в панель с ролью.';

-- ── 4. Права ────────────────────────────────────────────────────────────────

-- В схеме public Supabase сам выдаёт EXECUTE новым функциям, Postgres — роли PUBLIC. Сначала
-- забираем всё, потом выдаём явно: засчитать — anon и authenticated (вошедший в панель тоже
-- может открыть сайт), сводку — только authenticated; service_role — обе.
revoke all on function public.site_visit_hit(text, boolean, text, text) from public;
revoke all on function public.site_visits_report(int) from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('grant execute on function public.site_visit_hit(text, boolean, text, text) to %I', rl);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.site_visits_report(int) from anon';
  end if;
  foreach rl in array array['authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('grant execute on function public.site_visits_report(int) to %I', rl);
    end if;
  end loop;
end $$;

-- ── Проверка после применения ───────────────────────────────────────────────
--
-- 1) Права (ожидается: на таблицу у anon и authenticated — false; засчитать — true у обоих;
--    сводка — false у anon, true у authenticated):
-- select r as роль,
--        has_table_privilege(r, 'cms.site_visits', 'select')                                       as таблица_чтение,
--        has_table_privilege(r, 'cms.site_visits', 'insert')                                       as таблица_запись,
--        has_function_privilege(r, 'public.site_visit_hit(text,boolean,text,text)', 'execute')    as засчитать,
--        has_function_privilege(r, 'public.site_visits_report(int)', 'execute')                    as сводка
--   from unnest(array['anon','authenticated']) r;
--
-- 2) Работа от имени посетителя — одним запуском, в конце rollback, после него ничего не остаётся.
--    Ожидается: true (вход из Google на /faq), true (просмотр /products), false (чужой формат пути),
--    false (панель), false (неизвестный источник), затем строки (…, 'view', '/faq', …, 1),
--    (…, 'entry', '/faq', 'google', '', 1), (…, 'view', '/products', …, 1) — их видно, потому что
--    чтение идёт уже от имени владельца базы (reset role). Потом ОШИБКА «permission denied» на
--    сводке от anon — так и должно быть, это последняя строка перед rollback:
-- begin;
-- select set_config('request.jwt.claims', '{"role":"anon"}', true);
-- set local role anon;
-- select public.site_visit_hit('/faq', true, 'google', 'whatever.com');
-- select public.site_visit_hit('/products', false);
-- select public.site_visit_hit('/../etc/passwd', false);
-- select public.site_visit_hit('/admin/marketing', false);
-- select public.site_visit_hit('/faq', true, 'evil', '');
-- reset role;
-- select * from cms.site_visits where day = ((now() at time zone 'UTC') + interval '5 hours')::date
--   and path in ('/faq', '/products') order by kind, path;
-- set local role anon;
-- select public.site_visits_report(7);
-- rollback;
--
-- 3) Сводка из панели: Маркетинг → Посещения (или от имени владельца в SQL Editor она откажет —
--    в редакторе нет вошедшего человека, core.my_person() пуст; так и задумано).
