-- 015. Содержимое сайта в базе.
--
-- Замысел: страницы, блоки и справочники (услуги, кейсы, отзывы, вопросы,
-- стек, продукты) правятся из панели, а не коммитом. Публичный сайт читает
-- ОДНОЙ функцией и, если в базе ничего не опубликовано, показывает то же
-- статическое содержимое, что и сегодня. Пустая страница вместо текста —
-- худший исход правки содержимого, и здесь он невозможен по построению.
--
-- Два решения, которые стоит объяснить.
--
-- 1. Справочники — одна таблица cms.item с колонкой collection, а не шесть
--    похожих таблиц. Состав полей каждого справочника описан данными в
--    cms.collection, и интерфейс рисуется по этому описанию. Добавить
--    справочник — это insert, а не миграция и не новый экран. Тому, кто пишет
--    в 1С, эта развилка знакома: справочник описывается метаданными.
--
-- 2. Языки лежат в одном jsonb: {"ru": {...}, "kz": {...}, "en": {...}}.
--    Не переведённое поле отдаётся по-русски, а не пустой строкой: непереведённый
--    заголовок должен выглядеть как непереведённый, а не как отсутствующий.

create schema if not exists cms;
grant usage on schema cms to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema cms to authenticated';
  end if;
end $$;

-- ── Настройки сайта ──────────────────────────────────────────────────────────

create table cms.settings (
  tenant_id  uuid primary key references core.tenant(id),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Страницы и блоки ─────────────────────────────────────────────────────────

create table cms.page (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references core.tenant(id),
  slug         text not null,
  -- Ключ в словаре t.nav. Пока страница не переведена в базе, меню продолжает
  -- брать подпись из словаря — иначе первый же черновик обнулил бы навигацию.
  nav_key      text,
  icon         text,
  text         jsonb not null default '{}'::jsonb,
  in_nav       boolean not null default true,
  in_footer    boolean not null default true,
  status       text not null default 'draft'
               check (status in ('draft','published','hidden')),
  sort         int not null default 0,
  published_at timestamptz,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (tenant_id, slug),
  unique (tenant_id, id)
);

create table cms.block (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references core.tenant(id),
  page_id    uuid not null,
  type       text not null check (type in
               ('hero','text','features','cta','quote','gallery',
                'services','works','reviews','faq','stack','products','html')),
  text       jsonb not null default '{}'::jsonb,
  props      jsonb not null default '{}'::jsonb,
  status     text not null default 'draft'
             check (status in ('draft','published','hidden')),
  sort       int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, page_id) references cms.page(tenant_id, id) on delete cascade
);

create index block_page_idx on cms.block (page_id, sort);

-- ── Справочники, описанные данными ───────────────────────────────────────────

create table cms.collection (
  tenant_id uuid not null references core.tenant(id),
  code      text not null,
  title     text not null,
  title_one text not null,
  -- [{key, label, type, required, loc}]
  -- type: text | textarea | markdown | number | boolean | tags | image | color | url
  -- loc = true — значение хранится в text (по языкам), false — в props (общее).
  fields    jsonb not null default '[]'::jsonb,
  has_slug  boolean not null default true,
  sort      int not null default 0,
  primary key (tenant_id, code)
);

create table cms.item (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references core.tenant(id),
  collection   text not null,
  slug         text,
  text         jsonb not null default '{}'::jsonb,
  props        jsonb not null default '{}'::jsonb,
  status       text not null default 'draft'
               check (status in ('draft','published','hidden')),
  sort         int not null default 0,
  published_at timestamptz,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  foreign key (tenant_id, collection) references cms.collection(tenant_id, code),
  unique (tenant_id, collection, slug)
);

create index item_collection_idx on cms.item (tenant_id, collection, sort);

-- ── Картинки и файлы ─────────────────────────────────────────────────────────

create table cms.media (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references core.tenant(id),
  bucket     text not null default 'site',
  path       text not null,
  title      text,
  mime       text,
  bytes      int,
  width      int,
  height     int,
  created_at timestamptz not null default now(),
  unique (tenant_id, bucket, path)
);

-- ── История правок ───────────────────────────────────────────────────────────
-- Только дописывается. CMS без истории — это способ однажды потерять абзац
-- и не узнать, каким он был.

create table cms.revision (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references core.tenant(id),
  entity    text not null check (entity in ('page','block','item','settings')),
  row_id    uuid not null,
  snapshot  jsonb not null,
  at        timestamptz not null default now(),
  by_person uuid references core.person(id),
  op        text not null check (op in ('update','delete'))
);

create index revision_row_idx on cms.revision (tenant_id, entity, row_id, at desc);

create or replace function cms.g_revision() returns trigger
language plpgsql security definer set search_path = cms, core, public
as $$
declare v_entity text; v_id uuid;
begin
  v_entity := case tg_table_name
                when 'page' then 'page' when 'block' then 'block'
                when 'item' then 'item' else 'settings' end;
  v_id := case v_entity when 'settings' then old.tenant_id else old.id end;

  insert into cms.revision (tenant_id, entity, row_id, snapshot, by_person, op)
  values (old.tenant_id, v_entity, v_id, to_jsonb(old), core.my_person(),
          case tg_op when 'DELETE' then 'delete' else 'update' end);

  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

create trigger page_revision     before update or delete on cms.page     for each row execute function cms.g_revision();
create trigger block_revision    before update or delete on cms.block    for each row execute function cms.g_revision();
create trigger item_revision     before update or delete on cms.item     for each row execute function cms.g_revision();
create trigger settings_revision before update or delete on cms.settings for each row execute function cms.g_revision();

-- ── З-И. Опубликованное не бывает пустым ─────────────────────────────────────
-- Обязательные поля проверяются по описанию справочника, и только на русском:
-- он основной, остальные языки откатываются на него.

create or replace function cms.g_publish_complete() returns trigger
language plpgsql set search_path = cms, public
as $$
declare v_missing text; v_fields jsonb;
begin
  if new.status <> 'published' then
    new.published_at := null;
    return new;
  end if;

  if tg_table_name = 'item' then
    select c.fields into v_fields from cms.collection c
     where c.tenant_id = new.tenant_id and c.code = new.collection;

    select string_agg(f->>'label', ', ') into v_missing
      from jsonb_array_elements(coalesce(v_fields, '[]'::jsonb)) f
     where (f->>'required')::boolean
       and coalesce(nullif(trim(
             case when (f->>'loc')::boolean
                  then new.text->'ru'->>(f->>'key')
                  else new.props->>(f->>'key') end), ''), '') = '';

    if v_missing is not null then
      raise exception 'нельзя опубликовать: не заполнено по-русски — %', v_missing;
    end if;

    if (select has_slug from cms.collection
         where tenant_id = new.tenant_id and code = new.collection)
       and coalesce(nullif(trim(new.slug), ''), '') = '' then
      raise exception 'нельзя опубликовать без короткого имени (slug)';
    end if;

  elsif tg_table_name = 'page' then
    if coalesce(nullif(trim(new.text->'ru'->>'title'), ''), '') = '' then
      raise exception 'нельзя опубликовать страницу без заголовка по-русски';
    end if;
  end if;

  new.published_at := coalesce(new.published_at, now());
  return new;
end $$;

create trigger page_gi before insert or update on cms.page
  for each row execute function cms.g_publish_complete();
create trigger item_gi before insert or update on cms.item
  for each row execute function cms.g_publish_complete();

-- ── Заготовка для клиента ────────────────────────────────────────────────────
-- Справочники и страницы создаются черновиками. Пока ничего не опубликовано,
-- сайт показывает то же, что сейчас: «в базе пусто» и «сайт сломался» —
-- разные вещи, и здесь они не путаются.

create or replace function cms.seed(p_tenant uuid) returns int
language plpgsql security definer set search_path = cms, public
as $$
declare cnt int;
begin
  insert into cms.settings (tenant_id, data)
  values (p_tenant, jsonb_build_object(
    'telegram', '@DeveloperAI0',
    'telegram_url', 'https://t.me/DeveloperAI0',
    'whatsapp', '+7 776 550 96 86',
    'whatsapp_url', 'https://wa.me/77765509686',
    'email', 'hello@oberon.studio'))
  on conflict (tenant_id) do nothing;

  insert into cms.collection (tenant_id, code, title, title_one, has_slug, sort, fields) values
    -- Имена полей совпадают с тем, что уже ждут страницы сайта: title/desc/
    -- features у услуги, text/role/company у отзыва и так далее. Совпадение
    -- намеренное — иначе при переходе на базу пришлось бы переписывать вёрстку.
    (p_tenant, 'service', 'Услуги', 'Услуга', true, 10, '[
      {"key":"title","label":"Название","type":"text","required":true,"loc":true},
      {"key":"desc","label":"Описание","type":"textarea","required":true,"loc":true},
      {"key":"features","label":"Что входит","type":"tags","required":false,"loc":true},
      {"key":"body","label":"Подробно","type":"markdown","required":false,"loc":true},
      {"key":"tag","label":"Метка (FLAGSHIP, PREMIUM, POPULAR)","type":"text","required":false,"loc":false},
      {"key":"icon","label":"Значок (эмодзи)","type":"text","required":false,"loc":false},
      {"key":"price_from","label":"Цена от, тенге","type":"number","required":false,"loc":false}
    ]'::jsonb),
    (p_tenant, 'work', 'Кейсы', 'Кейс', true, 20, '[
      {"key":"title","label":"Название проекта","type":"text","required":true,"loc":true},
      {"key":"desc","label":"О проекте","type":"textarea","required":true,"loc":true},
      {"key":"result","label":"Результат","type":"textarea","required":true,"loc":true},
      {"key":"industry","label":"Отрасль","type":"text","required":false,"loc":false},
      {"key":"tech","label":"Технологии","type":"tags","required":false,"loc":false},
      {"key":"image","label":"Картинка","type":"image","required":false,"loc":false},
      {"key":"year","label":"Год","type":"number","required":false,"loc":false}
    ]'::jsonb),
    (p_tenant, 'review', 'Отзывы', 'Отзыв', false, 30, '[
      {"key":"text","label":"Текст отзыва","type":"textarea","required":true,"loc":true},
      {"key":"role","label":"Должность автора","type":"text","required":false,"loc":true},
      {"key":"company","label":"Компания и город","type":"text","required":false,"loc":true},
      {"key":"author","label":"Имя автора","type":"text","required":false,"loc":false},
      {"key":"rating","label":"Оценка 1-5","type":"number","required":false,"loc":false}
    ]'::jsonb),
    (p_tenant, 'faq', 'Вопросы и ответы', 'Вопрос', false, 40, '[
      {"key":"q","label":"Вопрос","type":"text","required":true,"loc":true},
      {"key":"a","label":"Ответ","type":"markdown","required":true,"loc":true},
      {"key":"topic","label":"Раздел","type":"text","required":false,"loc":false}
    ]'::jsonb),
    -- Одна запись — одна ГРУППА технологий, а не одна технология: именно так
    -- устроен блок на странице, и совпадение формы избавляет от прослойки,
    -- которая склеивала бы группы из отдельных строк и однажды склеила не так.
    (p_tenant, 'stack', 'Стек', 'Группа технологий', false, 50, '[
      {"key":"title","label":"Название группы","type":"text","required":true,"loc":true},
      {"key":"items","label":"Технологии","type":"tags","required":true,"loc":true},
      {"key":"note","label":"Пояснение","type":"text","required":false,"loc":true},
      {"key":"icon","label":"Значок (эмодзи)","type":"text","required":false,"loc":false},
      {"key":"color","label":"Цвет группы","type":"color","required":false,"loc":false}
    ]'::jsonb),
    (p_tenant, 'product', 'Готовые решения', 'Решение', true, 60, '[
      {"key":"name","label":"Название","type":"text","required":true,"loc":true},
      {"key":"tagline","label":"Одной строкой","type":"text","required":true,"loc":true},
      {"key":"description","label":"Описание","type":"textarea","required":true,"loc":true},
      {"key":"features","label":"Что входит","type":"tags","required":false,"loc":true},
      {"key":"icon","label":"Значок (эмодзи)","type":"text","required":false,"loc":false},
      {"key":"color","label":"Цвет","type":"color","required":false,"loc":false},
      {"key":"categories","label":"Категории","type":"tags","required":false,"loc":false},
      {"key":"price","label":"Цена, тенге","type":"number","required":false,"loc":false},
      {"key":"subscription","label":"Подписка, тенге в месяц","type":"number","required":false,"loc":false},
      {"key":"popular","label":"Показывать как популярное","type":"boolean","required":false,"loc":false}
    ]'::jsonb)
  on conflict (tenant_id, code) do nothing;

  insert into cms.page (tenant_id, slug, nav_key, icon, sort, in_nav, in_footer) values
    (p_tenant, '/',         'home',     'Home',         10, true,  true),
    (p_tenant, '/services', 'services', 'Sparkles',     20, true,  true),
    (p_tenant, '/projects', 'works',    'FolderKanban', 30, true,  true),
    (p_tenant, '/products', 'products', 'Package',      40, true,  true),
    (p_tenant, '/process',  'process',  'Workflow',     50, true,  true),
    (p_tenant, '/stack',    'stack',    'Layers',       60, true,  true),
    (p_tenant, '/reviews',  'reviews',  'Star',         70, true,  true),
    (p_tenant, '/faq',      'faq',      'HelpCircle',   80, true,  true),
    (p_tenant, '/contact',  'contact',  'Mail',         90, true,  true)
  on conflict (tenant_id, slug) do nothing;

  select count(*)::int into cnt from cms.page where tenant_id = p_tenant;
  return cnt;
end $$;

create or replace function cms.g_seed() returns trigger
language plpgsql security definer set search_path = cms, public
as $$
begin
  perform cms.seed(new.id);
  return new;
end $$;

drop trigger if exists tenant_seed_cms on core.tenant;
create trigger tenant_seed_cms after insert on core.tenant
  for each row execute function cms.g_seed();

do $$
declare t record;
begin
  for t in select id from core.tenant loop
    perform cms.seed(t.id);
  end loop;
end $$;

-- ── Публичное чтение ─────────────────────────────────────────────────────────
-- Единственная дверь для сайта. Таблицы cms роли anon недоступны совсем:
-- анонимный посетитель получает только опубликованное и только через функцию.

-- Откат на русский делается ЗДЕСЬ, а не в браузере: правило про язык одно,
-- и повторять его в каждом компоненте сайта — значит однажды забыть.
-- Пустая строка в переводе не перебивает русский: «перевели пробелом» —
-- это не перевод.
create or replace function cms.loc(p_text jsonb, p_locale text) returns jsonb
language sql immutable set search_path = cms, public
as $$
  select coalesce(p_text->'ru', '{}'::jsonb)
      || coalesce((
           select jsonb_object_agg(e.k, e.v)
             from jsonb_each(coalesce(p_text->p_locale, '{}'::jsonb)) as e(k, v)
            where e.v is not null
              and jsonb_typeof(e.v) <> 'null'
              and not (jsonb_typeof(e.v) = 'string' and trim(e.v #>> '{}') = '')
         ), '{}'::jsonb);
$$;

create or replace function public.site_content(
  p_locale text default 'ru', p_tenant text default 'oberon'
) returns jsonb
language plpgsql stable security definer set search_path = cms, core, public
as $$
declare v_tenant uuid; v_loc text; v_out jsonb;
begin
  v_loc := case when p_locale in ('ru','kz','en') then p_locale else 'ru' end;

  select id into v_tenant from core.tenant
   where code = coalesce(nullif(p_tenant, ''), 'oberon') and status <> 'retired';
  if v_tenant is null then
    return jsonb_build_object('locale', v_loc, 'pages', '[]'::jsonb,
                              'collections', '{}'::jsonb, 'settings', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'locale', v_loc,
    'updated_at', greatest(
      coalesce((select max(updated_at) from cms.page where tenant_id = v_tenant), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from cms.item where tenant_id = v_tenant), 'epoch'::timestamptz),
      coalesce((select max(updated_at) from cms.block where tenant_id = v_tenant), 'epoch'::timestamptz)),
    'settings', coalesce((select data from cms.settings where tenant_id = v_tenant), '{}'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', p.slug, 'nav_key', p.nav_key, 'icon', p.icon,
               'in_nav', p.in_nav, 'in_footer', p.in_footer, 'sort', p.sort,
               'text', cms.loc(p.text, v_loc),
               'blocks', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'type', b.type, 'sort', b.sort, 'props', b.props,
                          'text', cms.loc(b.text, v_loc))
                        order by b.sort, b.created_at)
                   from cms.block b
                  where b.page_id = p.id and b.status = 'published'), '[]'::jsonb))
             order by p.sort, p.slug)
        from cms.page p
       where p.tenant_id = v_tenant and p.status = 'published'), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_object_agg(c.code, coalesce(c.items, '[]'::jsonb))
        from (
          select col.code,
                 (select jsonb_agg(jsonb_build_object(
                           'slug', i.slug, 'sort', i.sort,
                           'text', cms.loc(i.text, v_loc),
                           'props', i.props)
                         order by i.sort, i.created_at)
                    from cms.item i
                   where i.tenant_id = v_tenant and i.collection = col.code
                     and i.status = 'published') as items
            from cms.collection col
           where col.tenant_id = v_tenant) c), '{}'::jsonb)
  ) into v_out;

  return v_out;
end $$;

revoke all on function public.site_content(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.site_content(text, text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.site_content(text, text) to authenticated';
  end if;
end $$;
grant execute on function public.site_content(text, text) to jarvis_worker;

-- ── Витрины для редактора ────────────────────────────────────────────────────

drop view if exists app.v_cms_page cascade;
create view app.v_cms_page with (security_invoker = true) as
select p.id, p.tenant_id, p.slug, p.nav_key, p.icon, p.text, p.in_nav, p.in_footer,
       p.status, p.sort, p.published_at, p.updated_at,
       coalesce(p.text->'ru'->>'title', p.slug) as title_ru,
       (select count(*) from cms.block b where b.page_id = p.id) as blocks_total,
       (select count(*) from cms.block b where b.page_id = p.id and b.status = 'published')
         as blocks_published,
       -- Какие языки заполнены: непереведённая страница должна быть видна как
       -- непереведённая, а не выглядеть готовой.
       (select coalesce(array_agg(k order by k), '{}')
          from jsonb_object_keys(p.text) k
         where coalesce(nullif(trim(p.text->k->>'title'), ''), '') <> '') as locales
  from cms.page p;

drop view if exists app.v_cms_item cascade;
create view app.v_cms_item with (security_invoker = true) as
select i.id, i.tenant_id, i.collection, c.title_one, i.slug, i.text, i.props,
       i.status, i.sort, i.published_at, i.updated_at, i.created_at,
       coalesce(i.text->'ru'->>'title', i.text->'ru'->>'name',
                i.text->'ru'->>'q', left(i.text->'ru'->>'text', 80),
                i.slug, '(без названия)') as label_ru,
       (select coalesce(array_agg(k order by k), '{}')
          from jsonb_object_keys(i.text) k
         where i.text->k <> '{}'::jsonb) as locales,
       (select count(*) from cms.revision r
         where r.entity = 'item' and r.row_id = i.id) as revisions
  from cms.item i
  join cms.collection c on c.tenant_id = i.tenant_id and c.code = i.collection;

-- ── Права ────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on all tables in schema cms to jarvis_worker;
grant usage, select on all sequences in schema cms to jarvis_worker;
grant execute on all functions in schema cms to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on all tables in schema cms to authenticated';
    execute 'grant usage, select on all sequences in schema cms to authenticated';
    execute 'grant execute on all functions in schema cms to authenticated';
    execute 'grant select on all tables in schema app to authenticated';
  end if;
end $$;
grant select on all tables in schema app to jarvis_worker;

-- История правок только дописывается.
revoke update, delete, truncate on cms.revision from jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke update, delete, truncate on cms.revision from authenticated';
  end if;
end $$;

do $$
declare r record; roles text[] := array['jarvis_worker','authenticated'];
        rl text; pol text;
begin
  for r in
    select c.relnamespace::regnamespace::text as sch, c.relname as tbl
      from pg_class c
     where c.relkind in ('r','p')
       and c.relnamespace::regnamespace::text = 'cms'
       and not exists (select 1 from pg_inherits i where i.inhrelid = c.oid)
       and exists (select 1 from pg_attribute a
                    where a.attrelid = c.oid and a.attname = 'tenant_id'
                      and a.attnum > 0 and not a.attisdropped)
     order by 1, 2
  loop
    execute format('alter table %I.%I enable row level security', r.sch, r.tbl);
    execute format('alter table %I.%I force row level security', r.sch, r.tbl);
    foreach rl in array roles loop
      if exists (select 1 from pg_roles where rolname = rl) then
        pol := format('%s_%s', r.tbl, rl);
        execute format('drop policy if exists %I on %I.%I', pol, r.sch, r.tbl);
        execute format(
          'create policy %I on %I.%I for all to %I using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())',
          pol, r.sch, r.tbl, rl);
      end if;
    end loop;
  end loop;
end $$;

comment on schema cms is
  'Содержимое публичного сайта: страницы, блоки, справочники, история правок.';
comment on function public.site_content(text, text) is
  'Всё опубликованное содержимое сайта для одного языка. Единственная дверь для анонимного посетителя.';
