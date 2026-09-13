-- 037. Когда это написали и когда правили в последний раз.
--
-- Сайт отдаёт содержимое одним вызовом site_content, и в нём у записи есть
-- текст и признаки, но нет ни одной даты. Из-за этого:
--
--   * в разметке страниц нет datePublished и dateModified. Свежесть — один из
--     немногих признаков, по которым и поиск, и модель решают, брать ли ответ
--     с этой страницы или с чужой. Разбор без даты читается как «неизвестно
--     когда», а это хуже, чем «в прошлом месяце»;
--
--   * в карте сайта у всех адресов один и тот же lastmod — наибольшая дата по
--     всему содержимому. Поправили одну цену — и карта заявляет, что изменились
--     все сорок страниц. Обходчик такое замечает и перестаёт верить lastmod
--     вообще, то есть поле работает против себя.
--
-- Обе беды от одного: даты есть в cms.item и cms.page, но наружу не выходят.
-- Выпускаем. Тело функции повторено целиком — заменить в ней одну строку
-- нельзя, а переписывать по частям опаснее, чем переписать полностью.

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
               'published_at', p.published_at, 'updated_at', p.updated_at,
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
                           -- Опубликовали — это дата появления. Если запись
                           -- создали и опубликовали позже, честнее вторая.
                           'published_at', coalesce(i.published_at, i.created_at),
                           'updated_at', i.updated_at,
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

-- Проверка: даты действительно выходят наружу.
do $$
declare v jsonb; v_items jsonb;
begin
  v := public.site_content('ru');
  select jsonb_agg(it) into v_items
    from jsonb_each(coalesce(v->'collections', '{}'::jsonb)) as e(code, arr),
         jsonb_array_elements(e.arr) as it;

  if v_items is null then
    raise notice 'справочники пусты — проверять нечего';
  elsif exists (select 1 from jsonb_array_elements(v_items) x
                 where not (x ? 'updated_at')) then
    raise exception 'в записи нет даты правки';
  else
    raise notice 'записей с датами: %', jsonb_array_length(v_items);
  end if;
end $$;
