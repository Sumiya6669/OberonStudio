-- 014. Управленческий учёт: деньги и прибыль.
--
-- Это НЕ налоговый учёт. Здесь нет форм 100/200/300, нет ЭСФ, нет НСФО и нет
-- намёка на них: такой учёт делается в 1С, а не в этой панели. Здесь отвечают
-- на четыре вопроса, на которые 1С без настройки не отвечает:
--   сколько у меня денег, кто сколько должен, сколько стоит мой час,
--   зарабатываю я или проедаю.
--
-- Двойная запись внутри есть, и это не украшение. Без неё «прибыль» —
-- это мнение: доход посчитали по счетам, расход по выпискам, сошлось случайно.
-- Равенство дебета и кредита проверяет база при проведении, а не интерфейс.
--
-- Главное правило раздела: проведённый документ неизменяем. Ошибка правится
-- сторнирующим документом, у которого своя дата и свой автор. Учёт, который
-- можно переписать задним числом, не является учётом.

create schema if not exists acc;
grant usage on schema acc to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema acc to authenticated';
  end if;
end $$;

-- ── План счетов ──────────────────────────────────────────────────────────────
-- Коды взяты близкими к типовым казахстанским, чтобы человек, работающий в 1С,
-- узнавал их с первого взгляда. Но это управленческий план: он короткий и в нём
-- нет ничего, что нужно только налоговой.

create table acc.account (
  tenant_id   uuid not null references core.tenant(id),
  code        text not null,
  title       text not null,
  kind        text not null check (kind in
                ('asset','liability','equity','income','expense')),
  parent_code text,
  -- Группа существует для читаемости отчёта. Проводки на группу не ложатся:
  -- иначе сальдо группы перестаёт быть суммой её счетов.
  is_group    boolean not null default false,
  -- Денежный счёт: входит в отчёт о движении денег.
  is_cash     boolean not null default false,
  is_active   boolean not null default true,
  sort        int not null default 0,
  note        text,
  primary key (tenant_id, code),
  foreign key (tenant_id, parent_code) references acc.account(tenant_id, code)
);

-- ── Документы учёта ──────────────────────────────────────────────────────────

create table acc.entry (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references core.tenant(id),
  kind       text not null check (kind in
               ('invoice',     -- выставлен счёт клиенту: доход и дебиторка
                'payment_in',  -- пришли деньги: гасится дебиторка
                'payment_out', -- заплатили поставщику
                'expense',     -- расход
                'payroll',     -- оплата труда
                'tax',         -- налоги и сборы
                'transfer',    -- перевод между своими счетами
                'owner',       -- вложение или изъятие владельца
                'opening',     -- ввод остатков
                'reversal',    -- сторно другого документа
                'adjustment')),
  entry_date date not null default current_date,
  memo       text not null,
  company_id uuid references crm.company(id),
  doc_id     bigint references crm.doc(id),
  payment_id bigint references crm.payment(id),
  currency   text not null default 'KZT',
  status     text not null default 'draft'
             check (status in ('draft','posted','void')),
  source     text not null default 'manual'
             check (source in ('manual','auto','agent')),
  reverses   bigint references acc.entry(id),
  posted_at  timestamptz,
  posted_by  uuid references core.person(id),
  created_at timestamptz not null default now(),
  -- Нужен для ссылки из проводки: проводка не может принадлежать документу
  -- другого клиента.
  unique (tenant_id, id)
);

create index entry_date_idx   on acc.entry (tenant_id, entry_date desc);
create index entry_status_idx on acc.entry (tenant_id, status);
create index entry_company_idx on acc.entry (tenant_id, company_id, entry_date desc);

-- Один документ на источник. Триггер, сработавший второй раз, не создаёт
-- второй черновик по тому же счёту или той же оплате.
create unique index entry_doc_idx on acc.entry (tenant_id, kind, doc_id)
  where doc_id is not null and status <> 'void';
create unique index entry_payment_idx on acc.entry (tenant_id, payment_id)
  where payment_id is not null and status <> 'void';
-- Сторно бывает только одно: иначе один и тот же документ отменяется дважды.
create unique index entry_reverses_idx on acc.entry (reverses)
  where reverses is not null;

create table acc.posting (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references core.tenant(id),
  entry_id     bigint not null,
  account_code text not null,
  side         text not null check (side in ('dr','cr')),
  amount       numeric(14,2) not null check (amount > 0),
  -- Аналитика. Без company_id нельзя ответить «сколько заработано на клиенте»,
  -- а это главный вопрос раздела.
  company_id   uuid references crm.company(id),
  ticket_id    bigint references crm.ticket(id),
  note         text,
  foreign key (tenant_id, entry_id)     references acc.entry(tenant_id, id) on delete cascade,
  foreign key (tenant_id, account_code) references acc.account(tenant_id, code)
);

create index posting_entry_idx   on acc.posting (entry_id);
create index posting_account_idx on acc.posting (tenant_id, account_code);

-- ── Нумерация документов ─────────────────────────────────────────────────────
-- Отдельной таблицей, а не max(number)+1: при двух одновременных счетах
-- max даёт один и тот же номер обоим.

create table acc.numbering (
  tenant_id uuid not null references core.tenant(id),
  kind      text not null,
  year      int  not null,
  last_no   int  not null default 0,
  primary key (tenant_id, kind, year)
);

create or replace function acc.next_number(p_tenant uuid, p_kind text)
returns text
language plpgsql security definer set search_path = acc, public
as $$
declare v_year int := extract(year from current_date)::int; v_no int;
begin
  insert into acc.numbering (tenant_id, kind, year, last_no)
  values (p_tenant, p_kind, v_year, 1)
  on conflict (tenant_id, kind, year)
    do update set last_no = acc.numbering.last_no + 1
  returning last_no into v_no;

  return format('%s-%s-%s',
    case p_kind when 'invoice' then 'СЧ' when 'act' then 'АКТ'
                when 'contract' then 'ДОГ' else upper(left(p_kind, 3)) end,
    v_year, lpad(v_no::text, 4, '0'));
end $$;

-- ── Типовой план счетов ──────────────────────────────────────────────────────
-- Заводится каждому клиенту при создании, а не разово этой миграцией:
-- второй клиент без плана счетов не смог бы провести ни одного документа.

create or replace function acc.seed_chart(p_tenant uuid) returns int
language plpgsql security definer set search_path = acc, public
as $$
declare cnt int;
begin
  insert into acc.account (tenant_id, code, title, kind, parent_code, is_group, is_cash, sort)
  values
    (p_tenant, '1000', 'Активы',                     'asset',     null,   true,  false, 100),
    (p_tenant, '1010', 'Касса',                      'asset',     '1000', false, true,  110),
    (p_tenant, '1030', 'Банковский счёт',             'asset',     '1000', false, true,  120),
    (p_tenant, '1210', 'Расчёты с клиентами',         'asset',     '1000', false, false, 130),
    (p_tenant, '1620', 'Оплаченное вперёд',           'asset',     '1000', false, false, 140),

    (p_tenant, '3000', 'Обязательства',              'liability', null,   true,  false, 200),
    (p_tenant, '3150', 'Налоги к уплате',            'liability', '3000', false, false, 210),
    (p_tenant, '3310', 'Расчёты с поставщиками',      'liability', '3000', false, false, 220),
    (p_tenant, '3350', 'Расчёты по оплате труда',     'liability', '3000', false, false, 230),

    (p_tenant, '5000', 'Капитал',                    'equity',    null,   true,  false, 300),
    (p_tenant, '5010', 'Вложения владельца',          'equity',    '5000', false, false, 310),
    (p_tenant, '5510', 'Изъятия владельца',           'equity',    '5000', false, false, 320),
    (p_tenant, '5610', 'Прибыль прошлых периодов',    'equity',    '5000', false, false, 330),

    (p_tenant, '6000', 'Доходы',                     'income',    null,   true,  false, 400),
    (p_tenant, '6010', 'Услуги 1С',                  'income',    '6000', false, false, 410),
    (p_tenant, '6020', 'Разработка и внедрение',      'income',    '6000', false, false, 420),
    (p_tenant, '6030', 'Сопровождение по подписке',   'income',    '6000', false, false, 430),
    (p_tenant, '6280', 'Прочие доходы',              'income',    '6000', false, false, 440),

    (p_tenant, '7000', 'Расходы',                    'expense',   null,   true,  false, 500),
    (p_tenant, '7110', 'Подписки и сервисы',         'expense',   '7000', false, false, 510),
    (p_tenant, '7120', 'Оплата труда',               'expense',   '7000', false, false, 520),
    (p_tenant, '7130', 'Налоги и сборы',             'expense',   '7000', false, false, 530),
    (p_tenant, '7140', 'Связь и интернет',           'expense',   '7000', false, false, 540),
    (p_tenant, '7150', 'Оборудование и ПО',          'expense',   '7000', false, false, 550),
    (p_tenant, '7160', 'Реклама и привлечение',      'expense',   '7000', false, false, 560),
    (p_tenant, '7170', 'Банковские услуги',          'expense',   '7000', false, false, 570),
    (p_tenant, '7180', 'Обучение и сертификация',    'expense',   '7000', false, false, 580),
    (p_tenant, '7210', 'Прочие расходы',             'expense',   '7000', false, false, 590)
  on conflict (tenant_id, code) do nothing;

  select count(*)::int into cnt from acc.account where tenant_id = p_tenant;
  return cnt;
end $$;

create or replace function acc.g_seed_chart() returns trigger
language plpgsql security definer set search_path = acc, public
as $$
begin
  perform acc.seed_chart(new.id);
  return new;
end $$;

drop trigger if exists tenant_seed_chart on core.tenant;
create trigger tenant_seed_chart after insert on core.tenant
  for each row execute function acc.g_seed_chart();

-- Существующим клиентам план счетов нужен прямо сейчас.
do $$
declare t record;
begin
  for t in select id from core.tenant loop
    perform acc.seed_chart(t.id);
  end loop;
end $$;

-- ── З-Ж. Проводится только сбалансированный документ ─────────────────────────

create or replace function acc.g_entry_balanced() returns trigger
language plpgsql as $$
declare v_n int; v_dr numeric(14,2); v_cr numeric(14,2); v_bad text;
begin
  if new.status <> 'posted' or old.status = 'posted' then
    return new;
  end if;

  select count(*),
         coalesce(sum(amount) filter (where side = 'dr'), 0),
         coalesce(sum(amount) filter (where side = 'cr'), 0)
    into v_n, v_dr, v_cr
    from acc.posting where entry_id = new.id;

  if v_n < 2 then
    raise exception 'документ % не проводится: проводок %, нужно не меньше двух',
      new.id, v_n;
  end if;

  if v_dr <> v_cr then
    raise exception 'документ % не сбалансирован: дебет %, кредит %, разница %',
      new.id, v_dr, v_cr, v_dr - v_cr;
  end if;

  select string_agg(p.account_code, ', ') into v_bad
    from acc.posting p
    join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
   where p.entry_id = new.id and (a.is_group or not a.is_active);
  if v_bad is not null then
    raise exception 'документ % ссылается на группу или закрытый счёт: %',
      new.id, v_bad;
  end if;

  new.posted_at := coalesce(new.posted_at, now());
  return new;
end $$;

-- ── З-З. Проведённый документ неизменяем ─────────────────────────────────────
-- Сторно, а не правка. Иначе прошлый отчёт о прибыли в любой момент
-- становится другим, и никто не может сказать, каким он был.

create or replace function acc.g_entry_frozen() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'проведённый документ % не удаляется: сделайте сторно', old.id;
    end if;
    return old;
  end if;

  if old.status = 'posted' then
    raise exception 'проведённый документ % не меняется: сделайте сторно', old.id;
  end if;

  if old.status = 'void' then
    raise exception 'отменённый документ % не меняется', old.id;
  end if;

  return new;
end $$;

create trigger entry_gzh before update on acc.entry
  for each row execute function acc.g_entry_balanced();

create trigger entry_gz before update or delete on acc.entry
  for each row execute function acc.g_entry_frozen();

-- Проводки живут только у черновика.
create or replace function acc.g_posting_frozen() returns trigger
language plpgsql as $$
declare v_entry bigint; v_status text;
begin
  v_entry := case tg_op when 'DELETE' then old.entry_id else new.entry_id end;
  select status into v_status from acc.entry where id = v_entry;
  if v_status is null then
    raise exception 'документ % не найден', v_entry;
  end if;
  if v_status <> 'draft' then
    raise exception 'проводки документа % не меняются: документ %', v_entry,
      case v_status when 'posted' then 'проведён' else 'отменён' end;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger posting_frozen before insert or update or delete on acc.posting
  for each row execute function acc.g_posting_frozen();

-- ── Кто это делает ───────────────────────────────────────────────────────────
-- Парная к core.my_tenant(). Обязательно security definer: роль агента не имеет
-- доступа к схеме auth, и без этой обёртки вместо честного отказа «документы
-- проводит человек» агент получал бы permission denied for schema auth —
-- сообщение, по которому причину не поймёт никто.

create or replace function core.my_person() returns uuid
language plpgsql stable security definer set search_path = core, public
as $$
declare v_uid uuid; v_id uuid;
begin
  begin
    v_uid := auth.uid();
  exception when others then
    return null;      -- нет схемы auth (агент, миграция) — значит человека нет
  end;
  if v_uid is null then return null; end if;

  select p.id into v_id from core.person p
   where p.auth_user_id = v_uid and p.is_active
   limit 1;
  return v_id;
end $$;

comment on function core.my_person() is
  'Человек текущего запроса или null, если запрос пришёл от агента.';

revoke all on function core.my_person() from public;
grant execute on function core.my_person() to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function core.my_person() to authenticated';
  end if;
end $$;

-- ── Проведение ───────────────────────────────────────────────────────────────
-- Отдельной функцией, потому что это действие, а не правка поля: у него есть
-- автор. Автор обязан быть человеком — агент документы не проводит.

create or replace function acc.entry_post(p_entry bigint)
returns bigint
language plpgsql security invoker set search_path = acc, core, public
as $$
declare v_person uuid;
begin
  v_person := core.my_person();

  if v_person is null then
    raise exception 'документы проводит вошедший человек, а не агент';
  end if;

  update acc.entry
     set status = 'posted', posted_at = now(), posted_by = v_person
   where id = p_entry and status = 'draft';

  if not found then
    raise exception 'документ % не найден или уже не черновик', p_entry;
  end if;

  return p_entry;
end $$;

-- Сторно: зеркальный документ с той же аналитикой. Исходный остаётся как был.
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
  values (v_src.tenant_id, 'reversal', current_date,
          format('Сторно документа №%s: %s', p_entry, trim(p_reason)),
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

-- Отмена черновика. Удалять нельзя: черновик мог быть создан автоматически,
-- и после удаления триггер создал бы его заново.
create or replace function acc.entry_void(p_entry bigint, p_reason text)
returns bigint
language plpgsql security invoker set search_path = acc, core, public
as $$
begin
  update acc.entry
     set status = 'void',
         memo = memo || format(' [отменён: %s]', coalesce(nullif(trim(p_reason), ''), 'без причины'))
   where id = p_entry and status = 'draft';
  if not found then
    raise exception 'документ % не найден или не черновик', p_entry;
  end if;
  return p_entry;
end $$;

-- ── Расход одной операцией ───────────────────────────────────────────────────
-- Одним вызовом, а не двумя вставками из интерфейса: документ без проводок —
-- это мусор в журнале, который потом никто не опознает.

create or replace function acc.expense_new(p jsonb)
returns bigint
language plpgsql security invoker set search_path = acc, core, public
as $$
declare
  v_tenant  uuid := core.my_tenant();
  v_amount  numeric(14,2) := round((p->>'amount')::numeric, 2);
  v_exp     text := p->>'expense_code';
  v_pay     text := coalesce(p->>'paid_from', '1030');
  v_date    date := coalesce((p->>'entry_date')::date, current_date);
  v_memo    text := nullif(trim(p->>'memo'), '');
  v_kind    text := coalesce(nullif(p->>'kind', ''), 'expense');
  v_entry   bigint;
begin
  if v_tenant is null then raise exception 'клиент не определён'; end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'сумма расхода должна быть больше нуля';
  end if;
  if v_memo is null then raise exception 'у расхода должно быть назначение'; end if;

  if not exists (select 1 from acc.account a
                  where a.tenant_id = v_tenant and a.code = v_exp
                    and a.kind = 'expense' and not a.is_group and a.is_active) then
    raise exception 'счёт расхода % не найден или не годится для проводки', v_exp;
  end if;
  if not exists (select 1 from acc.account a
                  where a.tenant_id = v_tenant and a.code = v_pay
                    and not a.is_group and a.is_active
                    and a.kind in ('asset','liability')) then
    raise exception 'счёт оплаты % не найден или не годится для проводки', v_pay;
  end if;

  insert into acc.entry (tenant_id, kind, entry_date, memo, company_id, source)
  values (v_tenant, v_kind, v_date, v_memo,
          nullif(p->>'company_id', '')::uuid, 'manual')
  returning id into v_entry;

  insert into acc.posting (tenant_id, entry_id, account_code, side, amount, company_id)
  values (v_tenant, v_entry, v_exp, 'dr', v_amount, nullif(p->>'company_id','')::uuid),
         (v_tenant, v_entry, v_pay, 'cr', v_amount, null);

  return v_entry;
end $$;

-- ── Счёт из отработанных часов ───────────────────────────────────────────────
-- Правило живёт в базе, потому что защита от повторного выставления — это
-- одна колонка invoiced_in и триггер З-Б, а не проверка в интерфейсе.

create or replace function acc.invoice_from_time(p jsonb)
returns bigint
language plpgsql security invoker set search_path = acc, crm, core, public
as $$
declare
  v_tenant  uuid := core.my_tenant();
  v_company uuid := (p->>'company_id')::uuid;
  v_from    date := (p->>'from')::date;
  v_to      date := (p->>'to')::date;
  v_due     int  := coalesce((p->>'due_days')::int, 10);
  v_rate    numeric(10,2);
  v_minutes int;
  v_amount  numeric(14,2);
  v_doc     bigint;
  v_tickets bigint[];
begin
  if v_tenant is null then raise exception 'клиент не определён'; end if;
  if v_company is null then raise exception 'не указана компания'; end if;
  if v_from is null or v_to is null then raise exception 'не указан период'; end if;
  if v_to < v_from then raise exception 'конец периода раньше начала'; end if;

  select coalesce(c.hourly_rate, 10000) into v_rate
    from crm.company c where c.id = v_company;
  if v_rate is null then raise exception 'компания % не найдена', v_company; end if;

  select coalesce(sum(te.minutes), 0),
         coalesce(array_agg(distinct te.ticket_id), '{}')
    into v_minutes, v_tickets
    from crm.time_entry te
    join crm.ticket t on t.id = te.ticket_id
   where t.company_id = v_company
     and te.billable and te.invoiced_in is null
     and te.started_at >= v_from and te.started_at < v_to + 1;

  -- Пустой счёт не выставляется. Пустой успех — не успех.
  if v_minutes = 0 then
    raise exception 'за период с % по % нет невыставленных оплачиваемых часов',
      v_from, v_to;
  end if;

  v_amount := round(v_minutes / 60.0 * v_rate, 2);

  insert into crm.doc (tenant_id, company_id, kind, number, issued_on, due_on,
                       amount, currency, status, ticket_ids)
  values (v_tenant, v_company, 'invoice', acc.next_number(v_tenant, 'invoice'),
          current_date, current_date + v_due, v_amount, 'KZT', 'issued', v_tickets)
  returning id into v_doc;

  update crm.time_entry te
     set invoiced_in = v_doc
   where te.id in (
     select te2.id from crm.time_entry te2
      join crm.ticket t on t.id = te2.ticket_id
     where t.company_id = v_company
       and te2.billable and te2.invoiced_in is null
       and te2.started_at >= v_from and te2.started_at < v_to + 1);

  return v_doc;
end $$;

-- ── Автоматические черновики ─────────────────────────────────────────────────
-- Именно ЧЕРНОВИКИ. Решение «это доход» принимает человек кнопкой «Провести».
-- Автоматическая проводка задним числом — это как раз то, из-за чего потом
-- нельзя объяснить, откуда взялась цифра в отчёте.

create or replace function acc.g_doc_entry() returns trigger
language plpgsql security definer set search_path = acc, crm, core, public
as $$
declare v_entry bigint; v_income text;
begin
  if new.kind <> 'invoice' then return new; end if;
  if new.status not in ('issued','partly_paid','paid','overdue') then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;

  if exists (select 1 from acc.entry e
              where e.tenant_id = new.tenant_id and e.kind = 'invoice'
                and e.doc_id = new.id and e.status <> 'void') then
    return new;
  end if;

  v_income := case
    when exists (select 1 from acc.account a
                  where a.tenant_id = new.tenant_id and a.code = '6010')
    then '6010' else null end;
  if v_income is null then
    raise exception 'у клиента нет плана счетов: заведите его перед выставлением счетов';
  end if;

  insert into acc.entry (tenant_id, kind, entry_date, memo, company_id, doc_id,
                         currency, source)
  values (new.tenant_id, 'invoice', new.issued_on,
          format('Счёт %s', new.number), new.company_id, new.id,
          new.currency, 'auto')
  returning id into v_entry;

  insert into acc.posting (tenant_id, entry_id, account_code, side, amount, company_id)
  values (new.tenant_id, v_entry, '1210', 'dr', new.amount, new.company_id),
         (new.tenant_id, v_entry, v_income, 'cr', new.amount, new.company_id);

  return new;
end $$;

create trigger doc_acc_entry after insert or update on crm.doc
  for each row execute function acc.g_doc_entry();

create or replace function acc.g_payment_entry() returns trigger
language plpgsql security definer set search_path = acc, crm, core, public
as $$
declare v_entry bigint;
begin
  if exists (select 1 from acc.entry e
              where e.tenant_id = new.tenant_id and e.payment_id = new.id
                and e.status <> 'void') then
    return new;
  end if;

  insert into acc.entry (tenant_id, kind, entry_date, memo, company_id, doc_id,
                         payment_id, source)
  values (new.tenant_id, 'payment_in', new.paid_on,
          format('Оплата%s', case when new.doc_id is null then ''
                                  else ' по счёту №' || new.doc_id end),
          new.company_id, new.doc_id, new.id, 'auto')
  returning id into v_entry;

  insert into acc.posting (tenant_id, entry_id, account_code, side, amount, company_id)
  values (new.tenant_id, v_entry, '1030', 'dr', new.amount, new.company_id),
         (new.tenant_id, v_entry, '1210', 'cr', new.amount, new.company_id);

  return new;
end $$;

create trigger payment_acc_entry after insert on crm.payment
  for each row execute function acc.g_payment_entry();

-- Оплата закрывает счёт: статус считает база, а не человек глазами.
create or replace function acc.g_doc_paid() returns trigger
language plpgsql security definer set search_path = crm, public
as $$
declare v_paid numeric(14,2); v_amount numeric(14,2); v_status text;
begin
  if new.doc_id is null then return new; end if;

  select d.amount, d.status into v_amount, v_status from crm.doc d where d.id = new.doc_id;
  if v_amount is null then return new; end if;
  if v_status = 'cancelled' then return new; end if;

  select coalesce(sum(p.amount), 0) into v_paid
    from crm.payment p where p.doc_id = new.doc_id;

  update crm.doc set status = case
      when v_paid >= v_amount then 'paid'
      when v_paid > 0        then 'partly_paid'
      else status end
   where id = new.doc_id;

  return new;
end $$;

create trigger payment_doc_paid after insert on crm.payment
  for each row execute function acc.g_doc_paid();

-- ── Витрины ──────────────────────────────────────────────────────────────────
-- security_invoker: политики применяются к вошедшему, а не к владельцу вида.

drop view if exists app.v_acc_balance cascade;
create view app.v_acc_balance with (security_invoker = true) as
select a.tenant_id, a.code, a.title, a.kind, a.parent_code, a.is_group,
       a.is_cash, a.sort,
       coalesce(sum(p.amount) filter (where p.side = 'dr'), 0) as debit,
       coalesce(sum(p.amount) filter (where p.side = 'cr'), 0) as credit,
       -- Сальдо в «своей» стороне: у активов и расходов дебетовое,
       -- у остальных кредитовое. Иначе половина отчёта будет с минусом.
       case when a.kind in ('asset','expense')
            then coalesce(sum(p.amount) filter (where p.side = 'dr'), 0)
               - coalesce(sum(p.amount) filter (where p.side = 'cr'), 0)
            else coalesce(sum(p.amount) filter (where p.side = 'cr'), 0)
               - coalesce(sum(p.amount) filter (where p.side = 'dr'), 0)
       end as saldo,
       count(p.id) as postings
  from acc.account a
  left join acc.posting p on p.tenant_id = a.tenant_id and p.account_code = a.code
  left join acc.entry e on e.id = p.entry_id and e.status = 'posted'
 where p.id is null or e.id is not null
 group by a.tenant_id, a.code, a.title, a.kind, a.parent_code, a.is_group,
          a.is_cash, a.sort;

drop view if exists app.v_pnl_month cascade;
create view app.v_pnl_month with (security_invoker = true) as
select s.month, s.tenant_id, s.income, s.expenses,
       s.income - s.expenses as profit,
       round(100.0 * (s.income - s.expenses) / nullif(s.income, 0), 1) as margin_pct
  from (
    select date_trunc('month', e.entry_date)::date as month, e.tenant_id,
           coalesce(sum(case when a.kind = 'income'
                             then case when p.side = 'cr' then p.amount else -p.amount end
                        end), 0) as income,
           coalesce(sum(case when a.kind = 'expense'
                             then case when p.side = 'dr' then p.amount else -p.amount end
                        end), 0) as expenses
      from acc.entry e
      join acc.posting p on p.entry_id = e.id
      join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
     where e.status = 'posted' and a.kind in ('income','expense')
     group by 1, 2
  ) s;

drop view if exists app.v_pnl_line cascade;
create view app.v_pnl_line with (security_invoker = true) as
select date_trunc('month', e.entry_date)::date as month, e.tenant_id,
       a.kind, a.code, a.title, a.sort,
       sum(case when a.kind = 'income'
                then case when p.side = 'cr' then p.amount else -p.amount end
                else case when p.side = 'dr' then p.amount else -p.amount end
           end) as amount
  from acc.entry e
  join acc.posting p on p.entry_id = e.id
  join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
 where e.status = 'posted' and a.kind in ('income','expense')
 group by 1, 2, 3, 4, 5, 6;

drop view if exists app.v_cash_month cascade;
create view app.v_cash_month with (security_invoker = true) as
select date_trunc('month', e.entry_date)::date as month, e.tenant_id,
       coalesce(sum(p.amount) filter (where p.side = 'dr'), 0) as money_in,
       coalesce(sum(p.amount) filter (where p.side = 'cr'), 0) as money_out,
       coalesce(sum(p.amount) filter (where p.side = 'dr'), 0)
     - coalesce(sum(p.amount) filter (where p.side = 'cr'), 0) as net
  from acc.entry e
  join acc.posting p on p.entry_id = e.id
  join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
 where e.status = 'posted' and a.is_cash
 group by 1, 2;

drop view if exists app.v_ar_company cascade;
create view app.v_ar_company with (security_invoker = true) as
select c.tenant_id, c.id as company_id, c.title as company_title, c.status,
       coalesce(sum(d.amount), 0) as invoiced,
       coalesce(sum(paid.paid), 0) as paid,
       coalesce(sum(d.amount), 0) - coalesce(sum(paid.paid), 0) as debt,
       coalesce(sum(case when d.status = 'overdue'
                         then d.amount - coalesce(paid.paid, 0) else 0 end), 0) as overdue,
       max(d.issued_on) as last_invoice_on
  from crm.company c
  left join crm.doc d on d.company_id = c.id and d.kind = 'invoice'
                     and d.status <> 'cancelled'
  left join lateral (
        select coalesce(sum(p.amount), 0) as paid
          from crm.payment p where p.doc_id = d.id) paid on true
 group by c.tenant_id, c.id, c.title, c.status;

drop view if exists app.v_hour_cost_month cascade;
create view app.v_hour_cost_month with (security_invoker = true) as
select coalesce(x.month, h.month) as month,
       coalesce(x.tenant_id, h.tenant_id) as tenant_id,
       coalesce(x.expenses, 0) as expenses,
       coalesce(h.hours_billable, 0) as hours_billable,
       coalesce(h.hours_total, 0) as hours_total,
       round(coalesce(x.expenses, 0) / nullif(h.hours_billable, 0), 0) as cost_per_hour
  from (
    select date_trunc('month', e.entry_date)::date as month, e.tenant_id,
           sum(case when p.side = 'dr' then p.amount else -p.amount end) as expenses
      from acc.entry e
      join acc.posting p on p.entry_id = e.id
      join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
     where e.status = 'posted' and a.kind = 'expense'
     group by 1, 2
  ) x
  full join (
    select date_trunc('month', te.started_at)::date as month, te.tenant_id,
           sum(te.minutes) filter (where te.billable) / 60.0 as hours_billable,
           sum(te.minutes) / 60.0 as hours_total
      from crm.time_entry te group by 1, 2
  ) h on h.month = x.month and h.tenant_id = x.tenant_id;

drop view if exists app.v_client_profit cascade;
create view app.v_client_profit with (security_invoker = true) as
select c.tenant_id, c.id as company_id, c.title as company_title,
       coalesce(c.hourly_rate, 10000) as hourly_rate,
       coalesce(rev.income, 0) as income,
       coalesce(hrs.hours, 0) as hours,
       coalesce(hrs.hours_billable, 0) as hours_billable,
       -- Себестоимость часа берётся общая по месяцу и раскладывается на часы
       -- клиента. Точнее не получится: аренда и подписки не делятся по клиентам.
       coalesce(hrs.cost, 0) as cost,
       coalesce(rev.income, 0) - coalesce(hrs.cost, 0) as profit,
       round(100.0 * (coalesce(rev.income, 0) - coalesce(hrs.cost, 0))
             / nullif(rev.income, 0), 1) as margin_pct
  from crm.company c
  left join lateral (
    select sum(case when p.side = 'cr' then p.amount else -p.amount end) as income
      from acc.posting p
      join acc.entry e on e.id = p.entry_id and e.status = 'posted'
      join acc.account a on a.tenant_id = p.tenant_id and a.code = p.account_code
     where a.kind = 'income' and p.company_id = c.id) rev on true
  left join lateral (
    select sum(te.minutes) / 60.0 as hours,
           sum(te.minutes) filter (where te.billable) / 60.0 as hours_billable,
           sum(te.minutes / 60.0 * coalesce(hc.cost_per_hour, 0)) as cost
      from crm.time_entry te
      join crm.ticket t on t.id = te.ticket_id
      left join app.v_hour_cost_month hc
             on hc.tenant_id = te.tenant_id
            and hc.month = date_trunc('month', te.started_at)::date
     where t.company_id = c.id) hrs on true;

drop view if exists app.v_unbilled cascade;
create view app.v_unbilled with (security_invoker = true) as
select c.tenant_id, c.id as company_id, c.title as company_title,
       coalesce(c.hourly_rate, 10000) as hourly_rate,
       sum(te.minutes) / 60.0 as hours,
       round(sum(te.minutes) / 60.0 * coalesce(c.hourly_rate, 10000), 2) as amount,
       min(te.started_at) as oldest_at,
       count(distinct te.ticket_id) as tickets
  from crm.time_entry te
  join crm.ticket t on t.id = te.ticket_id
  join crm.company c on c.id = t.company_id
 where te.billable and te.invoiced_in is null
 group by c.tenant_id, c.id, c.title, c.hourly_rate;

drop view if exists app.v_entry_list cascade;
create view app.v_entry_list with (security_invoker = true) as
select e.id, e.tenant_id, e.kind, e.entry_date, e.memo, e.status, e.source,
       e.currency, e.company_id, c.title as company_title,
       e.doc_id, d.number as doc_number, e.payment_id, e.reverses,
       e.posted_at, e.posted_by, pr.full_name as posted_by_name, e.created_at,
       coalesce((select sum(p.amount) from acc.posting p
                  where p.entry_id = e.id and p.side = 'dr'), 0) as debit,
       coalesce((select sum(p.amount) from acc.posting p
                  where p.entry_id = e.id and p.side = 'cr'), 0) as credit,
       (select count(*) from acc.posting p where p.entry_id = e.id) as postings,
       exists (select 1 from acc.entry r where r.reverses = e.id) as is_reversed
  from acc.entry e
  left join crm.company c on c.id = e.company_id
  left join crm.doc d on d.id = e.doc_id
  left join core.person pr on pr.id = e.posted_by;

drop view if exists app.v_doc_list cascade;
create view app.v_doc_list with (security_invoker = true) as
select d.id, d.tenant_id, d.kind, d.number, d.issued_on, d.due_on, d.amount,
       d.currency, d.status, d.file_path, d.ticket_ids, d.created_at,
       d.company_id, c.title as company_title,
       coalesce((select sum(p.amount) from crm.payment p where p.doc_id = d.id), 0) as paid,
       d.amount - coalesce((select sum(p.amount) from crm.payment p
                             where p.doc_id = d.id), 0) as rest,
       (d.due_on is not null and d.due_on < current_date
        and d.status in ('issued','partly_paid','overdue')) as is_late,
       (select count(*) from acc.entry e
         where e.doc_id = d.id and e.kind = 'invoice' and e.status = 'posted') as posted_entries
  from crm.doc d
  left join crm.company c on c.id = d.company_id;

-- ── Права ────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on all tables in schema acc to jarvis_worker;
grant usage, select on all sequences in schema acc to jarvis_worker;
grant execute on all functions in schema acc to jarvis_worker;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on all tables in schema acc to authenticated';
    execute 'grant usage, select on all sequences in schema acc to authenticated';
    execute 'grant execute on all functions in schema acc to authenticated';
    execute 'grant select on all tables in schema app to authenticated';
  end if;
end $$;
grant select on all tables in schema app to jarvis_worker;

-- Политики: своя строка видна, чужая нет. Тем же генератором, что в 008.
do $$
declare r record; roles text[] := array['jarvis_worker','authenticated'];
        rl text; pol text;
begin
  for r in
    select c.relnamespace::regnamespace::text as sch, c.relname as tbl
      from pg_class c
     where c.relkind in ('r','p')
       and c.relnamespace::regnamespace::text = 'acc'
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

comment on schema acc is
  'Управленческий учёт: деньги, дебиторка, себестоимость часа, прибыль. Не налоговый.';
comment on function acc.entry_post(bigint) is
  'Проведение документа. Только вошедшим человеком; проверяет равенство дебета и кредита.';
comment on function acc.entry_reverse(bigint, text) is
  'Сторно проведённого документа зеркальным документом. Исходный остаётся неизменным.';
