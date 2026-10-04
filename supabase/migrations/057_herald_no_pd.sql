-- 057. Вестник: уведомления о заявках в Telegram — без персональных данных.
--
-- ПРИМЕНЯТЬ ПОСЛЕ ПЕРЕЕЗДА БАЗЫ В РК (вместе с 056 и переключателем DATA_IN_RK = true).
--
-- Зачем: Telegram — сервис за пределами Казахстана. До сих пор Вестник (036) слал туда тему заявки
-- («Заявка с сайта: <имя>») и до 600 знаков текста, а на ответ клиента — до 900 знаков. Это трансграничная
-- передача ПД, которую Политика после переезда больше не описывает. Теперь в Telegram уходят только номер,
-- канал, срок ответа и ссылка в админку; кто написал и что — смотрим в админке (сервер в РК).
--
-- Меняются только тексты двух функций-триггеров из 036; триггеры, очередь и доставка остаются как были.
-- Повторный запуск безопасен.

create or replace function crm.g_ticket_herald() returns trigger
language plpgsql security definer set search_path = crm, core, pg_temp
as $$
declare v_txt text; v_ref text := 'OS-' || lpad(new.id::text, 5, '0');
begin
  v_txt := format(
    E'🔔 <b>Новая заявка %s</b>\nКанал: %s%s\nОтветить до: %s\n\nОткрыть: /admin/tickets/%s',
    v_ref,
    new.channel,
    coalesce(' · форма ' || core.tg_escape(nullif(new.form, '')), ''),
    to_char(coalesce(new.react_by, new.created_at + interval '4 hours')
              at time zone 'Asia/Almaty', 'DD.MM HH24:MI'),
    new.id);

  perform core.herald_notify(new.tenant_id, v_txt, 'ticket:' || new.id);
  return null;
end $$;

create or replace function crm.g_ticket_message_herald() returns trigger
language plpgsql security definer set search_path = crm, core, pg_temp
as $$
declare v_txt text;
begin
  if new.author is distinct from 'client' then
    return null;
  end if;

  -- Первое сообщение приходит вместе с заявкой — о ней уже сообщено выше.
  if not exists (select 1 from crm.ticket_message m
                  where m.ticket_id = new.ticket_id and m.id < new.id) then
    return null;
  end if;

  v_txt := format(
    E'💬 <b>Ответ клиента по %s</b>\n\nОткрыть: /admin/tickets/%s',
    'OS-' || lpad(new.ticket_id::text, 5, '0'),
    new.ticket_id);

  perform core.herald_notify(new.tenant_id, v_txt, 'msg:' || new.id);
  return null;
end $$;

comment on function crm.g_ticket_herald() is
  'Вестник: новая заявка → Telegram. С 057 — без ПД: номер, канал, форма, срок, ссылка в админку.';
comment on function crm.g_ticket_message_herald() is
  'Вестник: ответ клиента → Telegram. С 057 — без текста: номер и ссылка в админку.';
