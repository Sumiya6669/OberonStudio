-- 060. Безопасность: служебные функции агентов — только для раннера, не для вошедших пользователей.
--
-- Аудит 07.10.2026: функции SECURITY DEFINER в схемах crm/cms/core/acc обходят RLS и внутри не
-- проверяют клиента, а EXECUTE на них выдан роли authenticated (миграции 008, 012, 045 — «на все
-- функции схемы»). При открытой регистрации в Supabase Auth любой зарегистрировавшийся мог, например,
-- вызвать crm.dispatch_basis(id) и прочитать любую заявку целиком (имя, телефон, переписку), или
-- подсунуть черновик ответа/поста через dispatch_propose / post_propose.
--
-- Эти функции вызывает только раннер (роль jarvis_worker, runner/oberon/db.py и handlers.py) и другие
-- SECURITY DEFINER-функции изнутри (там действуют права владельца, отзыв их не ломает). Админка их не
-- вызывает (проверено по src/: только упоминания в комментариях). Вызывающих их invoker-функций нет
-- (проверено по pg_proc на живой базе 07.10.2026).
--
-- НЕ трогаем: функции, на которых стоят политики и админка (my_tenant, my_person, my_roles, is_owner,
-- require_owner, link_me), чистые помощники (money, loc, sha256_hex, tg_escape), acc.* под админкой и
-- acc.next_number (его вызывает invoker-функция acc.invoice_from_time).
--
-- Повторный запуск безопасен. Отдельно (в панели Supabase, не SQL): выключить регистрацию новых
-- пользователей — Authentication → Sign In / Providers → «Allow new users to sign up».

do $$
declare
  r record;
  v_names text[] := array[
    -- crm
    'crm.dispatch_basis', 'crm.dispatch_propose', 'crm.mark_overdue', 'crm.month_prep_text',
    'crm.resolve_company',
    -- cms
    'cms.post_approval_by_message', 'cms.post_basis', 'cms.post_caption', 'cms.post_draft_sent',
    'cms.post_for_publish', 'cms.post_next_topic', 'cms.post_notify', 'cms.post_propose',
    'cms.post_published', 'cms.post_queue', 'cms.post_tags', 'cms.seed',
    -- core
    'core.approval_reap', 'core.grant_mode', 'core.herald_notify', 'core.job_claim', 'core.job_fail',
    'core.job_finish', 'core.job_reap', 'core.log_action', 'core.quota_commit', 'core.quota_reap',
    'core.quota_release', 'core.quota_reserve', 'core.rate_take', 'core.self_check',
    'core.self_check_text',
    -- acc
    'acc.seed_chart'
  ];
  v_sig text;
begin
  for r in
    select p.oid, n.nspname || '.' || p.proname as fq
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname || '.' || p.proname) = any (v_names)
       and p.prokind = 'f'
  loop
    v_sig := r.oid::regprocedure::text;
    execute format('revoke execute on function %s from public', v_sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', v_sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke execute on function %s from authenticated', v_sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'jarvis_worker') then
      execute format('grant execute on function %s to jarvis_worker', v_sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', v_sig);
    end if;
  end loop;
end $$;

-- Новые функции в служебных схемах больше не получают EXECUTE для вошедших автоматически
-- (миграция 012 выдала это по умолчанию). Нужное админке выдаём явно в миграции функции.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'alter default privileges in schema core, crm, cms, acc revoke execute on functions from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter default privileges in schema core, crm, cms, acc revoke execute on functions from anon';
  end if;
end $$;

-- Забытая тестовая таблица public.probe_estimate_before (аудит: права anon, политик нет, в коде не упоминается).
-- Удаление необратимо — раскомментируй, если таблица точно не нужна:
-- drop table if exists public.probe_estimate_before;

-- Проверка после применения (должно вернуть 0 строк):
-- select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname in ('crm','cms','core','acc') and p.prosecdef
--    and has_function_privilege('authenticated', p.oid, 'execute')
--    and p.proname not in ('my_tenant','my_person','my_roles','is_owner','require_owner','link_me','next_number');
