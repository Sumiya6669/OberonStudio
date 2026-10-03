-- 054. Отзыв: ветеринарная аптека и клиника, интернет-магазин.
--
-- Отзыв пришёл владельцу напрямую 03.10.2026; текст — слово в слово, как написал автор. Оценку автор не ставил,
-- поэтому её нет. Автор просил свой телефон не публиковать — в репозиторий его не кладём.
--
-- Тот же путь, что у 053: запись в карантине cms.review_inbox со статусом approved и обычная запись справочника
-- cms.item (review) для сайта. Применять ПОСЛЕ 052. Повторный запуск ничего не дублирует (dedupe_key).

do $$
declare
  v_tenant uuid;
  v_item   uuid;
  v_text   text := 'Разработал нам сайт интернет магазин за 5 месяцев, с простой загрузкой товаров, админкой, отчетами и интеграцией с мойсклад. Загрузил товары, помог с сайтом объяснив всё, рекомендую!!!';
begin
  select id into v_tenant from core.tenant where code = 'oberon';
  if v_tenant is null then return; end if;

  if exists (select 1 from cms.review_inbox
              where tenant_id = v_tenant and dedupe_key = 'manual:vetapteka-2026-10') then
    raise notice 'отзыв уже внесён';
    return;
  end if;

  insert into cms.item (tenant_id, collection, text, props, status, published_at)
  values (
    v_tenant, 'review',
    jsonb_build_object('ru', jsonb_build_object(
      'text',    v_text,
      'role',    '',
      'company', 'Ветеринарная аптека и клиника')),
    jsonb_build_object(
      'author',  'Яша',
      'product', 'web-shop'),
    'published', now())
  returning id into v_item;

  insert into cms.review_inbox (
      tenant_id, product_code, author_name, company, city, body, contact, consent,
      page, status, decided_at, decision_note, item_id, dedupe_key)
  values (
      v_tenant, 'web-shop', 'Яша', 'Ветеринарная аптека и клиника', null,
      v_text,
      'у владельца (автор просил телефон не публиковать)', true,
      'передан владельцу напрямую', 'approved', now(),
      'Отзыв получен владельцем 03.10.2026; заказ — интернет-магазин с интеграцией МойСклад.',
      v_item, 'manual:vetapteka-2026-10');
end $$;
