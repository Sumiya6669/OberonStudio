-- 019. Публикация в CMS доходит до сайта.
--
-- Разрыв, который это закрывает. Страницы сайта собираются заранее — иначе
-- роботы моделей видят пустой div. Но собираются они на СБОРКЕ. Значит
-- правка, сделанная в панели, лежит в базе и не видна на сайте до
-- следующего деплоя. Человек нажал «Опубликовать», в панели написано
-- «опубликовано», на сайте — старый текст. Это худший вид поломки:
-- система говорит неправду и не считает это ошибкой.
--
-- Как закрывается. У Vercel есть адрес, обращение к которому запускает
-- пересборку. Сам адрес — секрет: кто его знает, тот может жечь чужие
-- минуты сборки. Поэтому он лежит в переменных окружения Vercel, а не в
-- базе и не в браузере; функция сайта /api/rebuild берёт его оттуда.
--
-- База отвечает за то, что она и должна решать: КОМУ можно и КАК ЧАСТО.
-- Здесь это правило, а не проверка в интерфейсе.

create table if not exists cms.rebuild (
  id          bigserial primary key,
  tenant_id   uuid not null references core.tenant(id) on delete cascade,
  person_id   uuid references core.person(id),
  reason      text not null default 'publish',
  requested_at timestamptz not null default now(),
  -- Итог обращения к Vercel записывает функция сайта: база не ходит наружу.
  outcome     text,
  note        text
);

create index if not exists rebuild_recent_idx
  on cms.rebuild (tenant_id, requested_at desc);

comment on table cms.rebuild is
  'След каждой просьбы пересобрать сайт: кто, когда, почему и чем кончилось.';

-- Права выдаются отдельно: разрешения из 015 раздавались «на все таблицы
-- схемы» в тот момент, и новую таблицу они не покрывают. Забыть это —
-- значит получить «permission denied» вместо строк, при живом RLS.
grant select, insert, update on cms.rebuild to jarvis_worker;
grant usage, select on sequence cms.rebuild_id_seq to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update on cms.rebuild to authenticated';
    execute 'grant usage, select on sequence cms.rebuild_id_seq to authenticated';
  end if;
end $$;

alter table cms.rebuild enable row level security;
alter table cms.rebuild force row level security;
do $$
declare rl text;
begin
  foreach rl in array array['authenticated','jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('drop policy if exists %I on cms.rebuild', 'rebuild_' || rl);
      execute format(
        'create policy %I on cms.rebuild for all to %I using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())',
        'rebuild_' || rl, rl);
    end if;
  end loop;
end $$;

-- ── Кому и как часто ────────────────────────────────────────────────────────
--
-- Предел в 6 сборок в час — не про деньги, а про смысл: сборка занимает
-- около минуты, и седьмая за час означает, что человек правит текст с
-- открытым сайтом и ждёт. Ему полезнее узнать это сразу, чем поставить в
-- очередь шесть сборок подряд.
--
-- Отказ — обычный ответ, а не ошибка: возвращаем причину, чтобы панель
-- сказала «ещё рано, последняя сборка была N минут назад», а не «сбой».

create or replace function public.rebuild_take(p_reason text default 'publish')
returns jsonb
language plpgsql security definer set search_path = cms, core, public
as $$
declare
  v_tenant uuid := core.my_tenant();
  v_person uuid := core.my_person();
  v_last   timestamptz;
  v_id     bigint;
begin
  if v_tenant is null or v_person is null then
    -- Пересборку просит человек. Агент этого делать не может: у него нет
    -- причин трогать публичный сайт, а право «жечь сборки» на всякий
    -- случай не выдаётся.
    return jsonb_build_object('allowed', false, 'reason', 'нужен вход человека');
  end if;

  select max(requested_at) into v_last
    from cms.rebuild where tenant_id = v_tenant and outcome is distinct from 'failed';

  if not core.rate_take(v_tenant, 'site:rebuild', 'hour', 6) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'сборок за этот час уже шесть — подождите',
      'last_at', v_last);
  end if;

  insert into cms.rebuild (tenant_id, person_id, reason)
  values (v_tenant, v_person, coalesce(nullif(trim(p_reason), ''), 'publish'))
  returning id into v_id;

  return jsonb_build_object('allowed', true, 'id', v_id, 'last_at', v_last);
end $$;

revoke all on function public.rebuild_take(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.rebuild_take(text) to authenticated';
  end if;
end $$;

comment on function public.rebuild_take(text) is
  'Разрешает пересборку сайта человеку и не чаще шести раз в час; пишет след.';

-- Итог сборки дописывает функция сайта тем же входом человека.
create or replace function public.rebuild_done(p_id bigint, p_outcome text, p_note text default null)
returns void
language plpgsql security definer set search_path = cms, core, public
as $$
begin
  if core.my_tenant() is null or core.my_person() is null then
    raise exception 'нужен вход человека';
  end if;
  update cms.rebuild
     set outcome = left(coalesce(p_outcome, 'unknown'), 40),
         note    = left(p_note, 500)
   where id = p_id and tenant_id = core.my_tenant();
end $$;

revoke all on function public.rebuild_done(bigint, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.rebuild_done(bigint, text, text) to authenticated';
  end if;
end $$;

-- ── Что показывать в панели ─────────────────────────────────────────────────
--
-- Главное здесь не «когда собирали», а «есть ли неопубликованное на сайте».
-- Правка, сделанная после последней сборки, лежит в базе и на сайте её нет;
-- панель обязана об этом сказать сама, не дожидаясь вопроса.

drop view if exists app.v_site_freshness cascade;
create view app.v_site_freshness with (security_invoker = true) as
with last_build as (
  select tenant_id, max(requested_at) as built_at
    from cms.rebuild
   where outcome is distinct from 'failed'
   group by tenant_id
),
last_edit as (
  select tenant_id, max(updated_at) as edited_at from (
    select tenant_id, updated_at from cms.page   where status = 'published'
    union all
    select tenant_id, updated_at from cms.item   where status = 'published'
    union all
    select tenant_id, updated_at from cms.settings
  ) s group by tenant_id
)
select t.id as tenant_id,
       b.built_at,
       e.edited_at,
       (e.edited_at is not null and (b.built_at is null or e.edited_at > b.built_at)) as stale,
       greatest(0, extract(epoch from (now() - coalesce(b.built_at, e.edited_at)))/60)::int as minutes_since_build
  from core.tenant t
  left join last_build b on b.tenant_id = t.id
  left join last_edit  e on e.tenant_id = t.id
 where t.id = core.my_tenant();

grant select on app.v_site_freshness to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on app.v_site_freshness to authenticated';
  end if;
end $$;

comment on view app.v_site_freshness is
  'Есть ли опубликованные правки, которых ещё нет на собранном сайте.';
