-- 007. Конфигурации 1С и отчёты агентов разработки.
-- Индекс строит скилл 1c-config-analysis; здесь хранится только паспорт:
-- где лежит, чем собран, когда, и не устарел ли.

create table dev.config_snapshot (
  id               bigint generated always as identity primary key,
  tenant_id        uuid not null references core.tenant(id),
  company_id       uuid not null references crm.company(id),
  title            text not null,             -- 'УТ 11.5 рабочая'
  src_path         text not null,             -- путь к выгрузке на машине с раннером
  db_path          text not null,             -- путь к SQLite индексу
  source_kind      text not null default 'xml' check (source_kind in ('xml','cf_unpack')),
  cfg_name         text,
  cfg_version      text,
  app_mode         text,                      -- обычное | управляемое
  -- Агрегатный отпечаток из ConfigDumpInfo.xml. По нему скилл сам понимает,
  -- что выгрузка изменилась после индексации.
  dump_fingerprint text,
  modules_loc      int,
  objects_total    int,
  objects_custom   int,                       -- вне поддержки: настоящие доработки
  has_binforms     boolean not null default false,
  indexed_at       timestamptz,
  stale            boolean not null default false,
  note             text,
  unique (company_id, title)
);

create index config_snapshot_company_idx on dev.config_snapshot (tenant_id, company_id);

create table dev.report (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references core.tenant(id),
  snapshot_id bigint not null references dev.config_snapshot(id) on delete cascade,
  ticket_id   bigint references crm.ticket(id),
  job_id      bigint references core.job(id),
  kind        text not null check (kind in
                ('audit','impact','diagnose','estimate_assist','merge')),
  title       text not null,
  body_md     text not null,
  file_path   text,
  -- Для сверки с scan_finding индекса: агент не имеет права выдумывать находки.
  findings    jsonb not null default '[]'::jsonb,
  stale_index boolean not null default false,
  cost_usd    numeric(10,5) not null default 0,
  created_at  timestamptz not null default now()
);

create index report_snapshot_idx on dev.report (tenant_id, snapshot_id, created_at desc);

-- ── З-Е. Ответ по устаревшему индексу помечается и эскалируется ──────────────
-- Молчаливый ответ по вчерашней конфигурации хуже отказа.
create or replace function dev.g_stale_index() returns trigger
language plpgsql as $$
declare v_stale boolean; v_title text;
begin
  select s.stale, s.title into v_stale, v_title
    from dev.config_snapshot s where s.id = new.snapshot_id;

  if v_stale then
    new.stale_index := true;
    if new.title not like '[ИНДЕКС УСТАРЕЛ]%' then
      new.title := '[ИНДЕКС УСТАРЕЛ] ' || new.title;
    end if;
    insert into core.escalation (tenant_id, job_id, kind, summary)
    values (new.tenant_id, new.job_id, 'stale_index',
            format('Отчёт «%s» построен по устаревшему индексу «%s»', new.title, v_title));
  end if;
  return new;
end $$;

create trigger report_ge before insert on dev.report
  for each row execute function dev.g_stale_index();
