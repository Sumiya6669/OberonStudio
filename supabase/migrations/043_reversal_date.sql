-- 043. Сторно встаёт в тот месяц, который исправляет.
--
-- Что нашли учениями. Расход 45 000 от 31 августа сторнировали 14 сентября.
-- Сторно вставало сегодняшним числом, и получалось:
--
--   август:   расходы 65 000 — включая отменённые 45 000
--   сентябрь: расходы −45 000 — расход, которого не было
--
-- Оба месяца врут, и ни один из них не выглядит подозрительно. Это та же
-- болезнь, что и в 042: у события две даты — когда оно случилось и когда мы
-- про него узнали, — а хранилась одна.
--
-- Что делаем. Дата сторно = дата исправляемого документа: месяц показывает
-- то, что в нём на самом деле было. А «когда заметили» никуда не пропадает —
-- это posted_at и created_at сторно, они по-прежнему сегодняшние.
--
-- Оговорка. Здесь управленческий учёт, а не сданная отчётность: закрытых
-- намертво периодов в системе нет, месяц можно пересчитать. Если когда-нибудь
-- появится запрет менять закрытый месяц, сторно в такой месяц должно будет
-- отказываться — но отказываться вслух, а не тихо уезжать в текущий.

create or replace function acc.entry_reverse(p_entry bigint, p_reason text)
returns bigint
language plpgsql security invoker set search_path = acc, core, public
as $$
declare v_src acc.entry; v_new bigint; v_person uuid;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'у сторно должна быть причина';
  end if;

  select * into v_src from acc.entry where id = p_entry;
  if v_src.id is null then
    raise exception 'документ % не найден', p_entry;
  end if;
  if v_src.status <> 'posted' then
    raise exception 'сторнируется только проведённый документ; документ % — %',
      p_entry, v_src.status;
  end if;

  v_person := core.my_person();
  if v_person is null then
    raise exception 'сторно делает вошедший человек, а не агент';
  end if;

  insert into acc.entry (tenant_id, kind, entry_date, memo, company_id,
                         currency, status, source, reverses)
  values (v_src.tenant_id, 'reversal', v_src.entry_date,
          format('Сторно документа №%s от %s: %s',
                 p_entry, to_char(v_src.entry_date, 'DD.MM.YYYY'), trim(p_reason)),
          v_src.company_id, v_src.currency, 'draft', 'manual', p_entry)
  returning id into v_new;

  insert into acc.posting (tenant_id, entry_id, account_code, side, amount,
                           company_id, ticket_id, note)
  select p.tenant_id, v_new, p.account_code,
         case p.side when 'dr' then 'cr' else 'dr' end,
         p.amount, p.company_id, p.ticket_id, p.note
    from acc.posting p where p.entry_id = p_entry;

  update acc.entry set status = 'posted', posted_at = now(), posted_by = v_person
   where id = v_new;

  return v_new;
end $$;

comment on function acc.entry_reverse(bigint, text) is
  'Сторно проведённого документа зеркальным документом той же даты. Исходный остаётся неизменным, «когда заметили» видно по posted_at.';
