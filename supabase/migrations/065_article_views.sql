-- 065. Счётчик просмотров «Статей экспертов» (/stati/<slug>).
--
-- Зачем: владелец хочет видеть, сколько раз прочитали статью, — на самой статье, в карточках списка
-- /stati и в панели (Маркетинг → Просмотры статей).
--
-- Что здесь:
--   * cms.article_views — одна строка на статью: slug, views, updated_at. Больше ничего: ни IP, ни
--     хэшей IP, ни времени отдельных просмотров, ни браузера — персональных данных таблица не держит.
--   * public.article_view_hit(p_slug) — «засчитать просмотр». Зовёт браузер посетителя публичным
--     ключом (anon), один раз за сессию вкладки (src/lib/site/articleViews.js). Возвращает число
--     просмотров после засчёта; если засчитать нельзя (неверный slug, предел частоты) — текущее число
--     или null. Ошибок не бросает: посетителю счётчик не важнее статьи.
--   * public.article_views_get(p_slugs) — чтение: по списку slug (страница статьи, карточки) или
--     без списка — все статьи с просмотрами (панель). Тоже для anon.
--
-- Защита от накрутки. Клиент считает раз за сессию, но ключ anon лежит в коде сайта, и функцию можно
-- звать напрямую. Поэтому пределы — в самой функции, через core.site_rate_check (061), как в 062:
--   * на одну статью: 20 в минуту и 300 в час;
--   * на все статьи вместе: 120 в минуту и 3000 в час;
--   * новая строка (slug, которого в таблице ещё нет): 30 в час, и не больше 1000 строк всего —
--     иначе бот завалил бы таблицу выдуманными slug.
-- Сверх предела просмотр просто не засчитывается (ответ — прежнее число). Предела «на посетителя»
-- нет намеренно: для него нужен IP или его хэш, а хранить их здесь не хотим. Цена — бот может
-- выбрать предел статьи, и в этот час часть настоящих просмотров не засчитается; накрутить он
-- сможет не больше 300 в час на статью.
-- slug проверяется по формату: латиница в нижнем регистре, цифры и одиночные дефисы, до 100 знаков
-- (так устроены адреса статей, см. src/lib/content/articles.js). Список статей живёт в файлах
-- репозитория, а не в базе, поэтому «только известные slug» база проверить не может — выдуманные
-- slug в списке не показываются: сайт и панель сверяют их со статьями из сборки.
--
-- Права: на таблицу у anon/authenticated прав нет вовсе, RLS включён без политик. Пишут и читают
-- только две функции выше (security definer, search_path пустой, все имена — со схемой).
--
-- Порядок: 061 (core.site_rate_check) должна быть применена раньше. Повторный запуск безопасен:
-- create if not exists / create or replace, права выдаются заново.

-- ── 1. Таблица ──────────────────────────────────────────────────────────────

create table if not exists cms.article_views (
  slug       text        primary key
             check (length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  views      bigint      not null default 0 check (views >= 0),
  updated_at timestamptz not null default now()
);

comment on table cms.article_views is
  'Просмотры статей /stati/<slug> (065). Только число на статью — без IP и прочих данных посетителя.';

-- Служебная таблица: только через функции ниже. RLS без политик = для anon/authenticated строк нет
-- даже при случайно выданных правах (015 когда-то выдала authenticated всё в схеме cms).
alter table cms.article_views enable row level security;
revoke all on table cms.article_views from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('revoke all on table cms.article_views from %I', rl);
    end if;
  end loop;
end $$;

-- ── 2. Засчитать просмотр ──────────────────────────────────────────────────

create or replace function public.article_view_hit(p_slug text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_slug   text := lower(trim(coalesce(p_slug, '')));
  v_views  bigint;
  v_known  boolean;
  v_checks jsonb;
  v_gate   jsonb;
begin
  if length(v_slug) not between 1 and 100 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return null;
  end if;

  select views into v_views from cms.article_views where slug = v_slug;
  v_known := found;

  v_checks := jsonb_build_array(
    jsonb_build_object('bucket', 'av:s:' || v_slug, 'kind', 'minute', 'limit', 20),
    jsonb_build_object('bucket', 'av:s:' || v_slug, 'kind', 'hour',   'limit', 300),
    jsonb_build_object('bucket', 'av:all',          'kind', 'minute', 'limit', 120),
    jsonb_build_object('bucket', 'av:all',          'kind', 'hour',   'limit', 3000));

  if not v_known then
    if (select count(*) from cms.article_views) >= 1000 then
      return null;
    end if;
    v_checks := v_checks || jsonb_build_array(
      jsonb_build_object('bucket', 'av:new', 'kind', 'hour', 'limit', 30));
  end if;

  v_gate := core.site_rate_check(v_checks);
  if not coalesce((v_gate->>'allowed')::boolean, false) then
    return v_views;  -- предел: не засчитываем, отдаём что было (null для новой статьи)
  end if;

  insert into cms.article_views as t (slug, views, updated_at)
       values (v_slug, 1, now())
  on conflict (slug) do update
         set views = t.views + 1, updated_at = now()
  returning t.views into v_views;

  return v_views;
end $$;

comment on function public.article_view_hit(text) is
  'Засчитать просмотр статьи /stati/<slug>: формат slug и пределы частоты (065). Для anon.';

-- ── 3. Прочитать счётчики ──────────────────────────────────────────────────

-- p_slugs — до 200 slug; null — все статьи с просмотрами (до 500, самые читаемые сверху).
create or replace function public.article_views_get(p_slugs text[] default null)
returns table (slug text, views bigint, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select v.slug, v.views, v.updated_at
    from cms.article_views v
   where v.views > 0
     and (p_slugs is null or v.slug = any (p_slugs[1:200]))
   order by v.views desc, v.slug
   limit 500;
$$;

comment on function public.article_views_get(text[]) is
  'Просмотры статей: по списку slug или все (065). Для anon.';

-- ── 4. Права ────────────────────────────────────────────────────────────────

-- В схеме public Supabase сам выдаёт EXECUTE новым функциям, Postgres — роли PUBLIC. Сначала
-- забираем всё, потом выдаём явно: anon (посетители), authenticated (панель), service_role.
revoke all on function public.article_view_hit(text) from public;
revoke all on function public.article_views_get(text[]) from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('grant execute on function public.article_view_hit(text) to %I', rl);
      execute format('grant execute on function public.article_views_get(text[]) to %I', rl);
    end if;
  end loop;
end $$;

-- ── Проверка после применения ───────────────────────────────────────────────
--
-- 1) Права (ожидается: на таблицу у anon и authenticated — false; на обе функции — true):
-- select r as роль,
--        has_table_privilege(r, 'cms.article_views', 'select')                    as таблица_чтение,
--        has_table_privilege(r, 'cms.article_views', 'insert')                    as таблица_запись,
--        has_function_privilege(r, 'public.article_view_hit(text)', 'execute')     as засчитать,
--        has_function_privilege(r, 'public.article_views_get(text[])', 'execute') as прочитать
--   from unnest(array['anon','authenticated']) r;
--
-- 2) Работа от имени посетителя — одним запуском, в конце rollback, после него ничего не остаётся.
--    Ожидается: 1, затем строка (…, 1, …), затем null (чужой формат), затем ОШИБКА «permission denied»
--    на прямом чтении таблицы — так и должно быть, это последняя строка перед rollback:
-- begin;
-- select set_config('request.jwt.claims', '{"role":"anon"}', true);
-- set local role anon;
-- select public.article_view_hit('pochemu-esf-nado-vypisyvat-v-srok');
-- select * from public.article_views_get(array['pochemu-esf-nado-vypisyvat-v-srok']);
-- select public.article_view_hit('../etc/passwd');
-- select count(*) from cms.article_views;
-- rollback;
