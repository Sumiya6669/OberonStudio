-- 066. Разбор /1c virtualnyy-sklad-i-snt: срок подтверждения входящей СНТ.
--
-- В 058 первая причина говорит только про десять календарных дней. Пункт 17 Правил оформления
-- СНТ (приказ и.о. Министра финансов РК от 31.10.2025 № 657, V2500037317) сверен 15.10.2026 на
-- adilet.zan.kz (API documents/by-ngr, актуальная редакция): десять календарных дней с даты
-- регистрации СНТ в ИС ЭСФ, «за исключением поставки (перевозки) товара посредством любого вида
-- транспорта» — тогда не позднее двадцати рабочих дней. То же деление — в п. 19.
-- Причина про п. 30 (исправленная СНТ — не позднее трёх рабочих дней после отклонения) верна и
-- не меняется.
--
-- Меняется только эта запись и только эта строка массива ru.causes, если в ней ещё старый
-- текст: правку из админки миграция не перетрёт, повторный запуск ничего не меняет.
-- Переводы (kz, en) на 15.10.2026 в репозитории не найдены; если в базе у записи есть свои
-- causes на другом языке, миграция только сообщает об этом (notice) — их правят вручную.
-- После применения — пересобрать сайт: страницы /1c собираются заранее.

do $$
declare
  v_tenant uuid;
  v_old    text := 'получатель не подтвердил входящую СНТ: на подтверждение или отклонение есть десять календарных дней с даты её регистрации в ИС ЭСФ (п. 17 Правил оформления СНТ, приказ Минфина РК № 657)';
  v_new    text := 'получатель не подтвердил входящую СНТ: на подтверждение или отклонение есть десять календарных дней с даты её регистрации в ИС ЭСФ, а при поставке (перевозке) товара любым видом транспорта — не больше двадцати рабочих дней (п. 17 Правил оформления СНТ, приказ Минфина РК № 657)';
  v_rows   int;
  v_lang   text;
begin
  select id into v_tenant from core.tenant where code = 'oberon';
  if v_tenant is null then return; end if;

  update cms.item i
     set text = jsonb_set(i.text, '{ru,causes}', (
           select jsonb_agg(case when a.e = to_jsonb(v_old) then to_jsonb(v_new) else a.e end order by a.n)
             from jsonb_array_elements(i.text->'ru'->'causes') with ordinality as a(e, n))),
         updated_at = now()
   where i.tenant_id = v_tenant
     and i.collection = 'answer'
     and i.slug = 'virtualnyy-sklad-i-snt'
     and jsonb_typeof(i.text->'ru'->'causes') = 'array'
     and i.text->'ru'->'causes' @> jsonb_build_array(v_old);
  get diagnostics v_rows = row_count;
  raise notice '066: разбор virtualnyy-sklad-i-snt, исправлено записей: %', v_rows;

  for v_lang in
    select k from cms.item i, jsonb_object_keys(i.text) as k
     where i.tenant_id = v_tenant and i.collection = 'answer' and i.slug = 'virtualnyy-sklad-i-snt'
       and k <> 'ru' and jsonb_typeof(i.text->k->'causes') = 'array'
  loop
    raise notice '066: у разбора есть causes на языке % — срок по п. 17 поправить вручную', v_lang;
  end loop;
end $$;
