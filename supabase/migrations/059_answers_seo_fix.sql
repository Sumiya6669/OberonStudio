-- 059. Разборы /1c из 020 и 024: SEO-заголовок и описание переезжают внутрь text.ru.
--
-- В 020 и 024 seo_title и seo_desc записаны на верхнем уровне text, рядом с ru. Сайт читает
-- текст через cms.loc(text, язык), а она берёт только text.ru и перевод — верхний уровень
-- отбрасывает. Поэтому у 14 первых разборов title и description страницы собирались
-- из запасных полей, а не из написанных. Проверено 05.10.2026 чтением базы: у всех 14
-- поля лежат сверху, в ru их нет. В 058 поля уже внутри ru.
--
-- Значение из ru не перетирается, если оно там уже есть. Повторный запуск ничего не меняет.

update cms.item i
   set text = jsonb_set(
         i.text - 'seo_title' - 'seo_desc',
         '{ru}',
         jsonb_strip_nulls(jsonb_build_object(
           'seo_title', i.text->'seo_title',
           'seo_desc',  i.text->'seo_desc'))
         || coalesce(i.text->'ru', '{}'::jsonb))
 where i.collection = 'answer'
   and (i.text ? 'seo_title' or i.text ? 'seo_desc');
