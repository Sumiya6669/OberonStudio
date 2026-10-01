-- 050. Воронка продаж: сделки и касания ИИ-продажника.
--
-- Заявка (crm.ticket) — это обращение, а сделка — путь одного лида до денег:
-- новая → квалифицирована → демо → КП → переговоры → выиграна / проиграна.
-- Сделку ведёт ИИ-продажник (Products for AI Tinker / ИИ-продажник): отвечает
-- лиду, собирает карточку квалификации, подбирает продукты из каталога сайта
-- и передаёт владельцу. КП, скидки, договор и счёт — только человек.
--
-- Персональные данные лидов (имя, контакты, переписка) — только в базе в РК
-- (закон о ПД, ст. 12 п. 2). Переписка хранится у продажника; здесь — карточка
-- и касания, чтобы считать воронку, источники и время первого ответа.
--
-- ДО ПРИМЕНЕНИЯ: прогнать на копии базы (хостинг в РК, после 10.10.2026).
-- На живой базе Supabase эта миграция не применялась.

insert into core.agent_kind (code, title, max_parallel)
values ('sales', 'ИИ-продажник', 2)
on conflict (code) do nothing;

-- Права — как в плане: отвечать по каталогу сам (с проверкой цифр в коде),
-- КП и догоны — только предлагать; догон по шаблону переходит в автомат
-- после 20 одобрений подряд (core.autonomy_stat).
insert into core.action_type
  (code, title, target_system, has_side_effect, min_confidence, autonomy_threshold)
values
  ('sales.reply',    'Ответ лиду по каталогу',          'chat', true, 0.600, 999999),
  ('sales.proposal', 'Коммерческое предложение лиду',   'chat', true, 0.900, 999999),
  ('sales.followup', 'Догон лида по шаблону',           'chat', true, 0.800, 20)
on conflict (code) do update set title = excluded.title, autonomy_threshold = excluded.autonomy_threshold;

insert into core."grant" (tenant_id, agent_kind, action_type, mode, granted_by, note)
select t.id, 'sales', a.code, a.mode, p.id, a.note
  from core.tenant t
  join core.person p on p.tenant_id = t.id
  join core.person_role r on r.person_id = p.id and r.role_code = 'owner'
  cross join (values
    ('sales.reply',    'auto',    'Сам, но сумма или процент не из каталога клиенту не уходят — передача владельцу.'),
    ('sales.proposal', 'propose', 'Только предлагать. КП, цену и скидку решает владелец.'),
    ('sales.followup', 'propose', 'Предлагать; после 20 одобрений подряд без правок — сам.')
  ) as a(code, mode, note)
 where p.is_active
on conflict do nothing;

-- ── Сделка ───────────────────────────────────────────────────────────────────

create table crm.deal (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references core.tenant(id),
  key          text not null,                         -- канал:чат у продажника (tg:123, site:<сессия>)
  channel      text not null check (channel in ('site','tg','wa','meta','email','manual')),
  stage        text not null default 'new' check (stage in
                 ('new','qualified','demo','proposal','negotiation','won','lost')),
  name         text not null default '',
  company_id   uuid references crm.company(id),        -- заводится при выигрыше
  ticket_id    bigint references crm.ticket(id),
  card         jsonb not null default '{}'::jsonb,     -- 1С, базы, НДС, кто пишет, боль, срочность, БИН, контакт
  products     text[] not null default '{}',           -- id продуктов каталога сайта
  amount       numeric(14,2) not null default 0,       -- оценка по каталогу, ₸ (не цена для клиента)
  source       jsonb not null default '{}'::jsonb,     -- utm_*, referrer, page, start
  next_step    text not null default '',
  next_date    text not null default '',
  lost_reason  text check (lost_reason in ('price','no_1c','no_need','competitor','silence','later','other')),
  score        smallint not null default 0 check (score between 0 and 100),   -- только очередь (закон о ПД ст. 19-1)
  consent_at   timestamptz,
  opted_out    boolean not null default false,          -- «не пишите»: больше не писать никогда
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, key),
  check (stage <> 'lost' or lost_reason is not null)
);

create index deal_stage_idx on crm.deal (tenant_id, stage, updated_at desc);

-- ── Касания ──────────────────────────────────────────────────────────────────
-- Без текста: только кто, когда, в каком канале и что это было. По ним — время
-- первого ответа, догоны (2, 5, 10 дней тишины) и отписки.

create table crm.touch (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references core.tenant(id),
  deal_id   bigint not null references crm.deal(id) on delete cascade,
  channel   text not null,
  direction text not null check (direction in ('in','out')),
  kind      text not null default 'message' check (kind in
              ('message','consent','consent_request','before_consent','opt_out','owner','followup')),
  at        timestamptz not null default now()
);

create index touch_deal_idx on crm.touch (deal_id, at);

create or replace function crm.deal_gu() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- после «не пишите» сделку обратно не открыть: согласие отозвано
  if old.opted_out and not new.opted_out then
    raise exception 'сделка %: лид отписался, писать ему нельзя', old.id;
  end if;
  return new;
end $$;
create trigger deal_gu before update on crm.deal for each row execute function crm.deal_gu();

-- ── Витрины ──────────────────────────────────────────────────────────────────

create or replace view app.v_deal_funnel with (security_invoker = true) as
select d.id, d.tenant_id, d.key, d.channel, d.stage, d.name, d.card, d.products, d.amount, d.source,
       coalesce(d.source->>'utm_source', d.source->>'start', d.channel) as source_label,
       d.next_step, d.next_date, d.lost_reason, d.score, d.opted_out, d.created_at, d.updated_at,
       (select min(t.at) from crm.touch t where t.deal_id = d.id and t.direction = 'in') as first_in,
       (select min(t.at) from crm.touch t where t.deal_id = d.id and t.direction = 'out') as first_out,
       (select max(t.at) from crm.touch t where t.deal_id = d.id) as last_touch
  from crm.deal d;

-- Права: crm.* у владельца и агентов закрываются генератором политик 008/021
-- (tenant_id = core.my_tenant()); повторяем его для новых таблиц явно.
grant select, insert, update, delete on crm.deal, crm.touch to jarvis_worker;
grant usage, select on all sequences in schema crm to jarvis_worker;
grant select on app.v_deal_funnel to jarvis_worker;
do $$
declare t text; rl text; roles text[] := array['jarvis_worker','authenticated'];
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on crm.deal, crm.touch to authenticated';
    execute 'grant usage, select on all sequences in schema crm to authenticated';
    execute 'grant select on app.v_deal_funnel to authenticated';
  end if;
  foreach t in array array['deal','touch'] loop
    execute format('alter table crm.%I enable row level security', t);
    execute format('alter table crm.%I force row level security', t);
    foreach rl in array roles loop
      if exists (select 1 from pg_roles where rolname = rl) then
        execute format('drop policy if exists %I on crm.%I', t || '_' || rl, t);
        execute format('create policy %I on crm.%I for all to %I using (tenant_id = core.my_tenant()) '
                       'with check (tenant_id = core.my_tenant())', t || '_' || rl, t, rl);
      end if;
    end loop;
  end loop;
end $$;

comment on table crm.deal is
  'Сделка ИИ-продажника: этап, карточка квалификации, продукты каталога, источник. КП и цены — человек.';
