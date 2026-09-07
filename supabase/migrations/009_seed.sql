-- 009. Начальные данные: реестры и ваш клиент.
-- Идемпотентно: миграцию можно прогнать повторно.

insert into core.role (code, title) values
  ('owner',    'Владелец'),
  ('approver', 'Подтверждающий'),
  ('operator', 'Исполнитель'),
  ('viewer',   'Наблюдатель')
on conflict (code) do nothing;

insert into core.agent_kind (code, title, max_parallel) values
  ('dispatcher', 'Диспетчер',                  1),
  ('registrar',  'Регистратор заявок',         2),
  ('estimator',  'Оценщик',                    2),
  ('herald',     'Вестник',                    1),
  ('controller', 'Контролёр',                  1),
  ('clerk',      'Приказчик',                  1),
  ('dev_1c',     'Инженер 1С (раннер на ПК)',  4)
on conflict (code) do nothing;

insert into core.job_type (code, agent_kind, title, requires_payload, lease_sec, backoff_base_sec, max_attempts, est_cost_usd) values
  ('registrar.intake',      'registrar',  'Разбор входящего сообщения',      true,   300,  30, 3, 0.01),
  ('estimator.draft',       'estimator',  'Черновик оценки по заявке',       true,   600,  60, 3, 0.05),
  ('herald.notify',         'herald',     'Доставка сообщения',              false,  120,  30, 3, 0),
  ('controller.weekly',     'controller', 'Недельная самопроверка',          true,  1800, 300, 2, 0.10),
  ('dev.index',             'dev_1c',     'Построение индекса конфигурации', true, 21600, 300, 2, 0),
  ('dev.impact',            'dev_1c',     'Влияние правки',                  true,  1800, 120, 3, 0.30),
  ('dev.diagnose',          'dev_1c',     'Разбор ошибки',                   true,  1800, 120, 3, 0.50),
  ('dev.audit',             'dev_1c',     'Аудит доработок',                 true,  7200, 300, 2, 1.50),
  ('dev.estimate_assist',   'dev_1c',     'Справка по конфигурации к оценке',true,  1800, 120, 3, 0.20)
on conflict (code) do nothing;

insert into core.action_type (code, title, target_system, has_side_effect, min_confidence, autonomy_threshold) values
  ('cfg.read',        'Чтение конфигурации и индекса', 'fs',       false, 0.500,  20),
  ('cfg.write_index', 'Запись в _index и _reports',    'fs',       true,  0.800,  50),
  ('cfg.write_src',   'Запись в выгрузку клиента',     'fs',       true,  0.990, 500),
  ('git.commit',      'Коммит в репозиторий',          'git',      true,  0.950, 200),
  ('1c.write',        'Запись в базу 1С',              '1c',       true,  0.999, 999),
  ('msg.send_tg',     'Отправка в Telegram',           'telegram', true,  0.900, 100),
  ('doc.create',      'Формирование документа',        'internal', true,  0.900, 100),
  ('ticket.classify', 'Классификация заявки',          'internal', false, 0.700,  50),
  ('estimate.draft',  'Черновик оценки',               'internal', false, 0.700, 100)
on conflict (code) do nothing;

insert into core.provider (code, title, unit, global_limit, period) values
  ('anthropic', 'Anthropic API',  'token',   null, 'month'),
  ('brave',     'Brave Search',   'request', 2000, 'month'),
  ('firecrawl', 'Firecrawl',      'page',    null, 'month'),
  ('telegram',  'Telegram Bot',   'message', null, 'day')
on conflict (code) do nothing;

-- Ваш клиент (tenant). Один на студию; многоклиентность заложена с первого дня.
insert into core.tenant (code, title, status, tz)
values ('oberon', 'Oberon Studio', 'active', 'Asia/Qyzylorda')
on conflict (code) do nothing;

-- Квоты на месяц. Не задана квота — обращение к службе запрещено,
-- поэтому строки обязательны, а не желательны.
insert into core.quota (tenant_id, provider, period, limit_units, soft_pct)
select t.id, p.code, p.period, v.lim, 80
  from core.tenant t
  cross join (values
      ('anthropic', 20000000::numeric),   -- токенов в месяц
      ('brave',      1500),
      ('firecrawl',  2000),
      ('telegram',    300)                -- сообщений в сутки
  ) as v(code, lim)
  join core.provider p on p.code = v.code
 where t.code = 'oberon'
on conflict (tenant_id, provider, period) do nothing;

-- Привязка вашей учётной записи к человеку в системе.
-- Вызвать ОДИН РАЗ после регистрации в Supabase Auth:
--   select core.link_me('albert.gaan@optimus-kz.kz', 'Альберт Гаан');
create or replace function core.link_me(p_email text, p_name text)
returns uuid
language plpgsql security definer set search_path = core, public
as $$
declare v_tenant uuid; v_uid uuid; v_person uuid;
begin
  select id into v_tenant from core.tenant where code = 'oberon';
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'вызывать из-под вошедшего пользователя';
  end if;

  insert into core.person (tenant_id, auth_user_id, full_name, email, position, is_active)
       values (v_tenant, v_uid, p_name, p_email, 'Основатель', true)
  on conflict (tenant_id, auth_user_id) do update
       set full_name = excluded.full_name, email = excluded.email
  returning id into v_person;

  insert into core.person_role (tenant_id, person_id, role_code)
       values (v_tenant, v_person, 'owner')
  on conflict do nothing;

  return v_person;
end $$;
