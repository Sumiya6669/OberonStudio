-- 048. Пометка к цене в карточке продукта.
--
-- Цена продукта, который ещё никто не внедрял, отличается от будущей, и
-- сказать об этом надо на самой карточке, а не в переписке: иначе она
-- читается как обычный прайс, и разговор про «почему теперь дороже»
-- случится позже и хуже.
--
-- Поле необязательное и не локализуется: это короткая строка под ценой,
-- а не текст. Пустое значение — карточка просто не рисует строку.
--
-- Карточек продуктов в cms.item сейчас нет: каталог живёт в коде
-- (src/lib/content/site.js), и сайт берёт его оттуда, пока коллекция
-- пуста. Эта миграция готовит форму в панели на тот случай, когда
-- продукт заведут через неё, — и ничего не публикует сама.

update cms.collection
   set fields = fields || jsonb_build_array(jsonb_build_object(
         'key', 'note',
         'label', 'Пометка к цене',
         'type', 'text',
         'required', false,
         'loc', false))
 where code = 'product'
   and not exists (
     select 1 from jsonb_array_elements(fields) f where f->>'key' = 'note'
   );

do $$
declare n int;
begin
  select count(*) into n
    from cms.collection c, jsonb_array_elements(c.fields) f
   where c.code = 'product' and f->>'key' = 'note';
  if n = 0 then
    raise warning 'поле «Пометка к цене» не добавлено: коллекции product нет';
  else
    raise notice 'Поле «Пометка к цене» есть в % клиентах', n;
  end if;
end $$;
