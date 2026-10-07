-- 064. Кандидаты: компании и открытые запросы, которые нашёл ИИ-поиск клиентов.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ ПРИМЕНЯТЬ ПОСЛЕ 056_retention.sql (нужна core.purge_expired) И ТОЛЬКО    │
-- │ НА БАЗЕ В РК / ЕЁ КОПИИ. На живой базе не применялась.                   │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Откуда. Products for AI Tinker / ИИ-поиск клиентов (пакет prospects): из
-- разрешённых источников (публичные Telegram-каналы с заказами, ссылки,
-- найденные владельцем) — сигнал, ссылка, подходящий продукт и черновик
-- первого сообщения. Агент НИЧЕГО не отправляет: пишет и откликается человек.
--
-- Чего здесь нет намеренно: людей. ФИО, личные телефоны и e-mail, ники
-- вырезаются агентом до записи (prospects/privacy.py); ниже — страховка базы:
-- в сигнале и черновике телефон или e-mail не записываются вовсе. Контакт —
-- только общий контакт компании, опубликованный ею самой (сайт, info@).
--
-- Кто что может:
--   раннер (jarvis_worker) — читать ключи и ДОБАВЛЯТЬ новых; менять и удалять
--     не может: статус и заметку владельца повторный сбор не трогает;
--   сотрудник в панели (authenticated) — читать и менять статус и заметку,
--     только с ролью owner или operator; удалить (по запросу компании) —
--     только владелец; добавить кандидата из панели нельзя;
--   задание prospects.collect (кнопка «Найти новых») — как любое задание
--     панели, через core.job.
--
-- Срок хранения: запись без ответа (новый, написал, не подходит) удаляется
-- через 6 месяцев после последнего изменения статуса — блок дописывается в
-- core.purge_expired (056). Ответившие и клиенты — не трогаются.
--
-- Повторный запуск безопасен: if not exists / on conflict / drop policy if exists,
-- блок в purge_expired вставляется один раз.

-- ── 1. Агент и задание ─────────────────────────────────────────────────────

insert into core.agent_kind (code, title, max_parallel)
values ('prospects', 'Поиск клиентов', 1)
on conflict (code) do nothing;

insert into core.job_type (code, agent_kind, title, requires_payload, lease_sec, est_cost_usd)
values ('prospects.collect', 'prospects', 'Найти новых кандидатов', false, 1800, 0.05)
on conflict (code) do update set agent_kind = excluded.agent_kind,
                                 title = excluded.title,
                                 lease_sec = excluded.lease_sec;

-- ── 2. Таблица ─────────────────────────────────────────────────────────────

create table if not exists crm.prospect (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references core.tenant(id),
  dedupe_key  text not null,                           -- bin:<БИН> | name:<название> | url:<ссылка>
  source      text not null,                           -- код источника (prospects/sources.py, REGISTRY)
  kind        text not null check (kind in ('company', 'request')),
  company     text not null default '',                -- название компании; ИП и ФИО не пишутся
  bin         text check (bin ~ '^[0-9]{4}[456][0-9]{7}$'),   -- БИН (5-я цифра 4–6), не ИИН
  industry    text not null default '',
  city        text not null default '',
  contact     text not null default '',                -- общий контакт компании (сайт, info@), не человека
  signal      text not null,                           -- текст сигнала без людей
  url         text not null check (url ~ '^https?://'),
  found_on    date not null,
  products    text[] not null default '{}',            -- id продуктов каталога сайта
  reasons     text[] not null default '{}',
  score       smallint not null default 0 check (score between 0 and 100),   -- только порядок просмотра
  draft       text not null default '',                -- черновик первого сообщения; отправляет человек
  draft_by    text not null default 'template' check (draft_by in ('template', 'claude')),
  status      text not null default 'new'
              check (status in ('new', 'contacted', 'replied', 'rejected', 'client')),
  note        text not null default '',                -- заметка владельца
  status_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, dedupe_key),
  -- страховка: телефон и e-mail в сигнал и черновик не попадают
  constraint prospect_no_email check (signal !~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
                                      and draft !~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'),
  constraint prospect_no_phone check (signal !~ '(^|[^0-9+])\+?[78][ ()-]*[0-9]{3}[ ()-]*[0-9]{3}[ -]*[0-9]{2}[ -]*[0-9]{2}([^0-9]|$)'
                                      and draft !~ '(^|[^0-9+])\+?[78][ ()-]*[0-9]{3}[ ()-]*[0-9]{3}[ -]*[0-9]{2}[ -]*[0-9]{2}([^0-9]|$)'),
  constraint prospect_contact_generic check (
    contact = '' or contact ~* '^https?://'
    or contact ~* '^(info|office|sales|hello|contact|contacts|mail|buh|admin|support|zakaz|order|orders|reception|secretary|priem|kense|kantselyariya)@')
);

create index if not exists prospect_list_idx on crm.prospect (tenant_id, status, score desc, created_at desc);

comment on table crm.prospect is
  'Кандидаты ИИ-поиска клиентов: компания или открытый запрос, сигнал, продукт, черновик. Людей нет. '
  'Агент ничего не отправляет. Без ответа — удаляется через 6 месяцев (core.purge_expired).';

-- Статус меняет человек: время смены статуса — от него считается срок хранения.
create or replace function crm.prospect_gu() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_at := now();
  end if;
  return new;
end $$;

drop trigger if exists prospect_gu on crm.prospect;
create trigger prospect_gu before update on crm.prospect for each row execute function crm.prospect_gu();

-- ── 3. Права и RLS ─────────────────────────────────────────────────────────

revoke all on crm.prospect from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on crm.prospect from anon;
  end if;
end $$;
do $$
declare pol text;
begin
  alter table crm.prospect enable row level security;
  alter table crm.prospect force row level security;

  -- 012 выдаёт новым таблицам crm всё (alter default privileges) — сначала забираем, потом даём нужное
  if exists (select 1 from pg_roles where rolname = 'jarvis_worker') then
    revoke all on crm.prospect from jarvis_worker;
    grant select, insert on crm.prospect to jarvis_worker;
    grant usage, select on sequence crm.prospect_id_seq to jarvis_worker;
    foreach pol in array array['prospect_worker_sel', 'prospect_worker_ins'] loop
      execute format('drop policy if exists %I on crm.prospect', pol);
    end loop;
    create policy prospect_worker_sel on crm.prospect for select to jarvis_worker
      using (tenant_id = core.my_tenant());
    create policy prospect_worker_ins on crm.prospect for insert to jarvis_worker
      with check (tenant_id = core.my_tenant() and status = 'new' and note = '');
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    -- менять из панели можно только статус и заметку
    revoke all on crm.prospect from authenticated;
    grant select, delete on crm.prospect to authenticated;
    grant update (status, note) on crm.prospect to authenticated;
    foreach pol in array array['prospect_staff_sel', 'prospect_staff_upd', 'prospect_owner_del'] loop
      execute format('drop policy if exists %I on crm.prospect', pol);
    end loop;
    create policy prospect_staff_sel on crm.prospect for select to authenticated
      using (tenant_id = core.my_tenant() and core.my_roles() && array['owner', 'operator']);
    create policy prospect_staff_upd on crm.prospect for update to authenticated
      using (tenant_id = core.my_tenant() and core.my_roles() && array['owner', 'operator'])
      with check (tenant_id = core.my_tenant() and core.my_roles() && array['owner', 'operator']);
    create policy prospect_owner_del on crm.prospect for delete to authenticated
      using (tenant_id = core.my_tenant() and core.is_owner());
  end if;
end $$;

-- ── 4. Срок хранения: блок в core.purge_expired (056) ──────────────────────
--
-- Функцию не переписываем целиком: правим собственное определение (как 038 —
-- проверку владельца). Блок встаёт перед «if p_dry_run», то есть считается и
-- откатывается в пробном прогоне тем же кодом, что и в боевом. Срок — свой,
-- 6 месяцев, независимо от p_months (там 12 и больше — для заявок).

do $$
declare
  fn   constant text := 'core.purge_expired(boolean,integer,text)';
  src  text;
  out  text;
  blk  constant text := $blk$
    -- ── Кандидаты ИИ-поиска клиентов (064): без ответа — 6 месяцев ───────
    delete from crm.prospect x
     where (v_tenant is null or x.tenant_id = v_tenant)
       and x.status in ('new', 'contacted', 'rejected')
       and greatest(x.created_at, x.status_at) < now() - interval '6 months';
    get diagnostics n1 = row_count;

    v_out := v_out || jsonb_build_object(
      'crm.prospect', jsonb_build_object('deleted', n1, 'months', 6));

    if p_dry_run then$blk$;
begin
  begin
    src := pg_get_functiondef(fn::regprocedure);
  exception when undefined_function or undefined_object then
    raise exception 'нет core.purge_expired: сначала примените 056_retention.sql — без неё срок хранения кандидатов не исполняется';
  end;

  if src like '%crm.prospect%' then
    raise notice 'core.purge_expired уже чистит кандидатов';
    return;
  end if;

  out := regexp_replace(src, '\n\s*if p_dry_run then', E'\n' || blk, '');
  if out = src then
    raise exception 'в core.purge_expired не нашлось места для блока кандидатов';
  end if;
  execute out;
  raise notice 'core.purge_expired: добавлено удаление кандидатов без ответа через 6 месяцев';
end $$;

-- Права на функцию после create or replace не меняются (их выставила 056),
-- но повторим отзыв: удаление по кнопке из панели здесь быть не должно.
revoke all on function core.purge_expired(boolean, int, text) from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated', 'jarvis_worker'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('revoke all on function core.purge_expired(boolean, int, text) from %I', rl);
    end if;
  end loop;
end $$;

-- ── 5. Проверка ────────────────────────────────────────────────────────────
-- Пробный прогон (ничего не меняет): ошибка в имени колонки упадёт здесь.

do $$
declare v jsonb;
begin
  v := core.purge_expired(true);
  if not (v ? 'crm.prospect') then
    raise exception 'core.purge_expired не вернула сводку по crm.prospect: %', v;
  end if;
  raise notice 'Пробный прогон срока хранения (кандидаты): %', v->'crm.prospect';
  if not exists (select 1 from core.job_type where code = 'prospects.collect') then
    raise exception 'задание prospects.collect не зарегистрировано';
  end if;
end $$;
