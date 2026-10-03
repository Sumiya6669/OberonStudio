-- 053. Первый настоящий отзыв: Федерация Таеквондо Темиртау, разработка CRM.
--
-- Рекомендация пришла владельцу напрямую 03.10.2026; текст — слово в слово, как написал автор. Оценку автор не
-- ставил, поэтому её нет (карточка без оценки, а не «5/5» за автора).
--
-- Тот же путь, что у отзыва с формы (052): запись в карантине cms.review_inbox со статусом approved — там же
-- пометка о контакте (сам номер автора — у владельца, в репозиторий его не кладём) — и обычная запись справочника cms.item (review) для сайта.
-- Применять ПОСЛЕ 052 и только когда автор согласился на публикацию имени и названия федерации.
-- Повторный запуск ничего не дублирует (dedupe_key).

do $$
declare
  v_tenant uuid;
  v_item   uuid;
begin
  select id into v_tenant from core.tenant where code = 'oberon';
  if v_tenant is null then return; end if;

  if exists (select 1 from cms.review_inbox
              where tenant_id = v_tenant and dedupe_key = 'manual:taekwondo-temirtau-2026-10') then
    raise notice 'отзыв уже внесён';
    return;
  end if;

  insert into cms.item (tenant_id, collection, text, props, status, published_at)
  values (
    v_tenant, 'review',
    jsonb_build_object('ru', jsonb_build_object(
      'text',    'Сделано всё что запрашивали, в срок, отвечает всегда, помогает и поддерживает',
      'role',    '',
      'company', 'Федерация Таеквондо Темиртау · Темиртау')),
    jsonb_build_object(
      'author',  'Марина Анатольевна',
      'product', 'crm-turnkey'),
    'published', now())
  returning id into v_item;

  insert into cms.review_inbox (
      tenant_id, product_code, author_name, company, city, body, contact, consent,
      page, status, decided_at, decision_note, item_id, dedupe_key)
  values (
      v_tenant, 'crm-turnkey', 'Марина Анатольевна', 'Федерация Таеквондо Темиртау', 'Темиртау',
      'Сделано всё что запрашивали, в срок, отвечает всегда, помогает и поддерживает',
      'у владельца (телефон автора в репозиторий не кладём)', true,
      'передан владельцу напрямую', 'approved', now(),
      'Рекомендация о разработчике, получена владельцем 03.10.2026; заказ — разработка CRM.',
      v_item, 'manual:taekwondo-temirtau-2026-10');
end $$;
