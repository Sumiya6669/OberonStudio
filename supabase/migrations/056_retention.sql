-- 056. Срок хранения: через 12 месяцев данные удаляются или обезличиваются сами.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ ПРИМЕНЯТЬ ТОЛЬКО ПОСЛЕ ПЕРЕЕЗДА НА БАЗУ В РК (план — 10.10.2026).        │
-- │ На облачной базе Supabase не применять. Порядок: копия базы → миграция → │
-- │ select core.purge_expired();  (пробный прогон, ничего не меняет) →       │
-- │ сверить сводку глазами → только потом ночной запуск с false.             │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Зачем. Политика (/privacy, разделы 3–4) и текст согласия обещают: заявки,
-- переписка и служебные данные хранятся 12 месяцев с последнего обращения,
-- потом удаляются или обезличиваются (Закон о ПД, ст. 12 п. 2 ч. 2, ст. 18).
-- До этой миграции в базе не было ничего, что это делает. Обещание, которое
-- держится на памяти владельца, не держится: через год о нём не вспомнит никто.
--
-- Что удаляется, что обезличивается и что не трогается — по таблицам:
--
--   crm.deal          сделка не выиграна и молчит 12 месяцев — удаляется (касания
--                     уходят каскадом). Выигранная — это клиент, не трогаем.
--                     Отписавшийся («не пишите») — НЕ удаляется, а обезличивается:
--                     имя, карточка, источник стираются, остаётся только ключ чата
--                     и отметка opted_out. Иначе при следующем сообщении продажник
--                     заведёт новую сделку и напишет тому, кто просил не писать.
--   crm.ticket        закрытая или забытая заявка (new, triaged, estimated, done,
--                     cancelled), последнее движение по которой старше 12 месяцев:
--                       * без следа в деньгах и работе — удаляется целиком вместе
--                         с перепиской и оценками (каскад из 006);
--                       * если на неё есть часы (crm.time_entry), проводки
--                         (acc.posting), счёт/акт/договор (crm.doc.ticket_ids),
--                         живая сделка (crm.deal), отчёт агента (dev.report) или
--                         компания — действующий клиент (active, support), — заявка
--                         остаётся: первичные документы и их основания хранятся
--                         5 лет (НК РК), а внешние ключи не дают удалить строку.
--                         У такой заявки стираются только контакты: адрес/телефон
--                         в external_ref, имя в теме «Заявка с сайта: …», хеш
--                         контакта в dedupe_key, метки клика fbclid/yclid, строки
--                         «Имя / Телефон / Email / Компания» в сообщениях клиента.
--                     Заявки в работе (approved, in_work) не трогаются ни при каком
--                     сроке: их сначала закрывает человек.
--   crm.doc, crm.payment, acc.*, tax.*, crm.time_entry — НЕ трогаются никогда.
--   core.job          задания Вестника (herald.notify) завершённые 12 месяцев назад:
--                     текст уведомления — копия темы и текста заявки — заменяется
--                     пометкой. Само задание остаётся: на него ссылается журнал.
--   core.approval     решённые предложения старше 12 месяцев: текст ответа клиенту
--                     в proposal / edit_delta заменяется пометкой; счётчики
--                     автономии (core.autonomy_stat) от этого не меняются.
--   cms.review_inbox  отклонённый, спам или снятый с сайта отзыв — удаляется;
--                     ожидающий и опубликованный — остаётся, но контакт автора,
--                     хеш адреса, браузер и хеш повтора стираются (Политика: «пока
--                     отзыв опубликован; контакт — 12 месяцев»).
--   bot.session       состояние диалога бота, не менявшееся 12 месяцев, — удаляется.
--   bot.invite        использованный или истёкший код приглашения старше 12 месяцев.
--   core.rate_bucket  окна пределов частоты (час, сутки) старше 30 дней: после
--                     окна они ничего не ограничивают, а в scope бывает хеш адреса.
--   cms.rebuild       след пересборок сайта старше 12 месяцев.
--
-- Что НЕ входит и почему:
--   core.action_log — журнал только дописывается (004, запрет базы), и в params
--     по замыслу лежит только безопасное; удалять из него — ломать сам журнал.
--   crm.company, crm.contact — это клиенты и их представители: срок по договору
--     и законодательству о бухучёте, решает человек, а не ночной таймер.
--   core.escalation, cms.revision — служебная история; при необходимости —
--     отдельной миграцией после того, как станет понятно, что в них оседает.
--
-- Клиент (tenant). По умолчанию чистятся только данные самой студии — код
-- 'oberon', как у submit_lead. Данные других клиентов платформы хранятся по их
-- договорам; для них функцию вызывают с их кодом явно, null — все сразу.
--
-- Повторный запуск безопасен: удалённого второй раз нет, а обезличенное
-- отбирается условием «есть что стирать», поэтому второй прогон даёт нули.
--
-- Функция работает в обход RLS (security definer, владелец — тот же, что
-- у submit_lead). Если владелец RLS не обходит, она ничего не увидит и ничего
-- не удалит — в сводке будет warning. Отказ безопасный, но тихий; поэтому
-- первый пробный прогон обязателен.

-- ── 1. Функция ─────────────────────────────────────────────────────────────

create or replace function core.purge_expired(
  p_dry_run     boolean default true,
  p_months      int     default 12,
  p_tenant_code text    default 'oberon')
returns jsonb
language plpgsql security definer set search_path = core, crm, cms, bot, public, pg_temp
as $$
declare
  c_mark   constant text := '(удалено по сроку хранения)';
  -- Строки контактов в первом сообщении заявки (формат submit_lead, 018–055).
  -- (?n) — ^ и $ на границах строк; уже стёртые строки не совпадают.
  c_re     constant text := '(?n)^(Имя|Телефон|Email|Компания): (?!\(удалено).*$';
  v_cut    timestamptz;
  v_tenant uuid;
  v_out    jsonb;
  n1 bigint; n2 bigint; n3 bigint; n4 bigint;
begin
  if p_months is null or p_months < 12 then
    raise exception 'срок короче 12 месяцев не задаётся: Политика обещает хранить 12 месяцев';
  end if;

  if p_tenant_code is not null then
    select id into v_tenant from core.tenant where code = p_tenant_code;
    if v_tenant is null then
      raise exception 'клиент % не найден', p_tenant_code;
    end if;
  end if;

  v_cut := now() - make_interval(months => p_months);
  v_out := jsonb_build_object(
    'dry_run', p_dry_run,
    'cutoff',  v_cut,
    'tenant',  coalesce(p_tenant_code, '*'));

  if not exists (select 1 from pg_roles
                  where rolname = current_user and (rolsuper or rolbypassrls)) then
    v_out := v_out || jsonb_build_object('warning',
      'владелец функции не обходит RLS: строки других клиентов не видны, удалять нечего');
  end if;

  -- Всё — в одном блоке: пробный прогон делает ту же работу и в конце
  -- откатывает её исключением. Так сводка пробного и боевого прогона
  -- считается одним и тем же кодом и не может разойтись.
  begin

    -- ── Сделки ───────────────────────────────────────────────────────────
    -- Первыми: сделка держит ссылку на заявку, и удалённая сделка
    -- освобождает заявку для удаления в том же прогоне.
    select count(*) into n3
      from crm.touch x
      join crm.deal d on d.id = x.deal_id
     where d.stage <> 'won' and not d.opted_out and d.updated_at < v_cut
       and (v_tenant is null or d.tenant_id = v_tenant)
       and not exists (select 1 from crm.touch y where y.deal_id = d.id and y.at >= v_cut);

    delete from crm.deal d
     where d.stage <> 'won' and not d.opted_out and d.updated_at < v_cut
       and (v_tenant is null or d.tenant_id = v_tenant)
       and not exists (select 1 from crm.touch y where y.deal_id = d.id and y.at >= v_cut);
    get diagnostics n1 = row_count;

    update crm.deal d
       set name = '', card = '{}'::jsonb, source = '{}'::jsonb,
           products = '{}', next_step = '', next_date = ''
     where d.opted_out and d.stage <> 'won' and d.updated_at < v_cut
       and (v_tenant is null or d.tenant_id = v_tenant)
       and (d.name <> '' or d.card <> '{}'::jsonb or d.source <> '{}'::jsonb
            or d.products <> '{}' or d.next_step <> '' or d.next_date <> '');
    get diagnostics n2 = row_count;

    v_out := v_out || jsonb_build_object(
      'crm.deal',  jsonb_build_object('deleted', n1, 'anonymized_opted_out', n2),
      'crm.touch', jsonb_build_object('deleted_cascade', n3));

    -- ── Заявки ───────────────────────────────────────────────────────────
    -- Отбор один раз: какие заявки истекли и можно ли их удалить целиком.
    if to_regclass('pg_temp.purge_ticket') is not null then
      drop table pg_temp.purge_ticket;
    end if;
    create temp table purge_ticket (
      id   bigint primary key,
      keep boolean not null
    ) on commit drop;

    insert into pg_temp.purge_ticket (id, keep)
    select t.id,
           (   exists (select 1 from crm.time_entry te where te.ticket_id = t.id)
            or exists (select 1 from acc.posting p     where p.ticket_id = t.id)
            or exists (select 1 from crm.doc d         where t.id = any (d.ticket_ids))
            or exists (select 1 from crm.deal dl       where dl.ticket_id = t.id)
            or exists (select 1 from dev.report r      where r.ticket_id = t.id)
            or coalesce(c.status in ('active', 'support'), false))
      from crm.ticket t
      left join crm.company c on c.id = t.company_id
     where (v_tenant is null or t.tenant_id = v_tenant)
       and t.status in ('new', 'triaged', 'estimated', 'done', 'cancelled')
       and greatest(t.created_at, t.updated_at, t.received_at, t.closed_at,
                    (select max(m.at) from crm.ticket_message m where m.ticket_id = t.id))
           < v_cut;

    select count(*) into n3
      from crm.ticket_message m
      join pg_temp.purge_ticket k on k.id = m.ticket_id
     where not k.keep;
    select count(*) into n4
      from crm.estimate e
      join pg_temp.purge_ticket k on k.id = e.ticket_id
     where not k.keep;

    delete from crm.ticket t
     using pg_temp.purge_ticket k
     where k.id = t.id and not k.keep;
    get diagnostics n1 = row_count;

    -- Остающиеся заявки: только контакты. Текст обращения, источник, суммы
    -- и сроки остаются — это основание документа и статистика.
    update crm.ticket t
       set external_ref = null,
           dedupe_key   = null,
           subject      = case when t.subject like 'Заявка с сайта: %'
                               then 'Заявка с сайта' else t.subject end,
           utm          = t.utm - 'fbclid' - 'yclid'
      from pg_temp.purge_ticket k
     where k.id = t.id and k.keep
       and (t.external_ref is not null
            or t.dedupe_key is not null
            or t.subject like 'Заявка с сайта: %'
            or t.utm ?| array['fbclid', 'yclid']);
    get diagnostics n2 = row_count;

    v_out := v_out || jsonb_build_object(
      'crm.ticket',   jsonb_build_object('deleted', n1, 'anonymized', n2),
      'crm.estimate', jsonb_build_object('deleted_cascade', n4));

    update crm.ticket_message m
       set body = regexp_replace(m.body, c_re, '\1: ' || c_mark, 'g')
      from pg_temp.purge_ticket k
     where k.id = m.ticket_id and k.keep
       and m.author = 'client'
       and m.body ~ c_re;
    get diagnostics n2 = row_count;

    v_out := v_out || jsonb_build_object(
      'crm.ticket_message', jsonb_build_object('deleted_cascade', n3, 'anonymized', n2));

    drop table pg_temp.purge_ticket;

    -- ── Уведомления Вестника ─────────────────────────────────────────────
    update core.job j
       set payload = jsonb_set(j.payload, '{text}', to_jsonb(c_mark))
     where j.job_type = 'herald.notify'
       and j.status in ('done', 'done_empty', 'dead', 'cancelled')
       and coalesce(j.finished_at, j.updated_at, j.created_at) < v_cut
       and (v_tenant is null or j.tenant_id = v_tenant)
       and j.payload ? 'text'
       and j.payload->>'text' is distinct from c_mark;
    get diagnostics n1 = row_count;

    v_out := v_out || jsonb_build_object(
      'core.job', jsonb_build_object('anonymized', n1));

    -- ── Решённые предложения агентов ─────────────────────────────────────
    update core.approval a
       set proposal   = case when a.proposal ? 'message'
                             then jsonb_set(a.proposal, '{message}', to_jsonb(c_mark))
                             else a.proposal end,
           edit_delta = case when a.edit_delta ? 'message'
                             then jsonb_set(a.edit_delta, '{message}', to_jsonb(c_mark))
                             else a.edit_delta end
     where a.status <> 'pending'
       and coalesce(a.decided_at, a.created_at) < v_cut
       and (v_tenant is null or a.tenant_id = v_tenant)
       and (   (a.proposal ? 'message' and a.proposal->>'message' is distinct from c_mark)
            or (coalesce(a.edit_delta ? 'message', false)
                and a.edit_delta->>'message' is distinct from c_mark));
    get diagnostics n1 = row_count;

    v_out := v_out || jsonb_build_object(
      'core.approval', jsonb_build_object('anonymized', n1));

    -- ── Отзывы ───────────────────────────────────────────────────────────
    -- Удаляется то, что не опубликовано и не будет: отклонённое, спам и
    -- одобренное, но снятое с сайта (item_id обнулился при удалении cms.item).
    delete from cms.review_inbox r
     where (v_tenant is null or r.tenant_id = v_tenant)
       and coalesce(r.decided_at, r.created_at) < v_cut
       and (r.status in ('rejected', 'spam')
            or (r.status = 'approved' and r.item_id is null));
    get diagnostics n1 = row_count;

    update cms.review_inbox r
       set contact = c_mark, ip_hash = null, user_agent = null, dedupe_key = null
     where (v_tenant is null or r.tenant_id = v_tenant)
       and r.status in ('pending', 'approved')
       and r.created_at < v_cut
       and (r.contact <> c_mark or r.ip_hash is not null
            or r.user_agent is not null or r.dedupe_key is not null);
    get diagnostics n2 = row_count;

    v_out := v_out || jsonb_build_object(
      'cms.review_inbox', jsonb_build_object('deleted', n1, 'anonymized', n2));

    -- ── Бот: состояние диалога и коды приглашений ────────────────────────
    delete from bot.session s
     where (v_tenant is null or s.tenant_id = v_tenant)
       and s.updated_at < v_cut;
    get diagnostics n1 = row_count;

    delete from bot.invite i
     where (v_tenant is null or i.tenant_id = v_tenant)
       and i.created_at < v_cut
       and (i.used_at is not null or i.expires_at < now());
    get diagnostics n2 = row_count;

    v_out := v_out || jsonb_build_object(
      'bot.session', jsonb_build_object('deleted', n1),
      'bot.invite',  jsonb_build_object('deleted', n2));

    -- ── Служебное: пределы частоты и след пересборок ─────────────────────
    delete from core.rate_bucket b
     where (v_tenant is null or b.tenant_id = v_tenant)
       and b.window_start < now() - interval '30 days';
    get diagnostics n1 = row_count;

    delete from cms.rebuild b
     where (v_tenant is null or b.tenant_id = v_tenant)
       and b.requested_at < v_cut;
    get diagnostics n2 = row_count;

    v_out := v_out || jsonb_build_object(
      'core.rate_bucket', jsonb_build_object('deleted', n1),
      'cms.rebuild',      jsonb_build_object('deleted', n2));

    if p_dry_run then
      raise exception using errcode = 'TK001', message = 'пробный прогон: изменения отменены';
    end if;

  exception when sqlstate 'TK001' then
    -- Пробный прогон: всё внутри блока откатилось, а сводка в переменной
    -- осталась (локальные переменные PL/pgSQL исключение не откатывает).
    null;
  end;

  return v_out;
end $$;

comment on function core.purge_expired(boolean, int, text) is
  'Срок хранения ПД (Политика, разделы 3–4): удаляет или обезличивает заявки, переписку и служебные данные '
  'старше p_months месяцев. По умолчанию — пробный прогон (ничего не меняет). Возвращает сводку по таблицам.';

-- Права. Предустановка из 012 выдаёт новым функциям схемы core выполнение
-- панели (authenticated) и раннеру (jarvis_worker). Эту функцию не вызывает
-- никто, кроме владельца и его ночного задания: удаление по кнопке из панели
-- или из сценария n8n — ровно то, чего здесь быть не должно.
revoke all on function core.purge_expired(boolean, int, text) from public;
do $$
declare rl text;
begin
  foreach rl in array array['anon', 'authenticated', 'jarvis_worker', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = rl) then
      execute format('revoke all on function core.purge_expired(boolean, int, text) from %I', rl);
    end if;
  end loop;
end $$;

-- ── 2. Расписание ──────────────────────────────────────────────────────────
--
-- В self-hosted Supabase pg_cron входит в поставку и уже стоит в
-- shared_preload_libraries; включить его можно из миграции. Если не вышло
-- (другая сборка Postgres, база не та, что в cron.database_name) — миграция
-- не падает, а говорит об этом. Тогда вызывать таймером с сервера, например
-- systemd-таймером или cron хоста раз в сутки ночью:
--
--   psql "$DATABASE_URL" -c "select core.purge_expired(false);"
--
-- под тем же владельцем, что применял миграции.
--
-- Время pg_cron — UTC. 22:30 UTC = 03:30 по Алматы (UTC+5): ночью, после
-- резервной копии и до утренних заявок. Задание с тем же именем pg_cron
-- обновляет, а не дублирует, — повторное применение миграции безопасно.
--
-- Посмотреть, что сделал ночной прогон: cron.job_run_details (статус и время);
-- сводку по таблицам — тем же вызовом с true, он покажет, что осталось.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      execute 'create extension if not exists pg_cron';
    exception when others then
      raise notice 'pg_cron есть в поставке, но не включился (%). Срок хранения — таймером с сервера.', sqlerrm;
    end;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute format('select cron.schedule(%L, %L, %L)',
                   'tinker_purge_expired', '30 22 * * *', 'select core.purge_expired(false)');
    raise notice 'Срок хранения: задание pg_cron tinker_purge_expired, ежедневно 03:30 по Алматы.';
  else
    raise notice 'pg_cron нет. Срок хранения вызывать таймером с сервера: select core.purge_expired(false);';
  end if;
end $$;

-- ── 3. Проверка ────────────────────────────────────────────────────────────
-- Пробный прогон сразу при применении: если в функции ошибка в имени таблицы
-- или колонки, миграция упадёт здесь, а не ночью в тишине. Он ничего не меняет.

do $$
declare v jsonb;
begin
  v := core.purge_expired(true);
  raise notice 'Пробный прогон срока хранения: %', v;
end $$;
