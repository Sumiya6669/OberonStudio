-- 047. Контентщик: канал перестаёт зависеть от того, дошли ли руки.
--
-- Что было. Пятнадцать разборов лежат на сайте, контент-план написан, а
-- пост в канал всё равно требует сесть и написать. Ровно на этом каналы
-- и умирают: не потому, что нечего сказать, а потому, что садиться некогда.
--
-- Что делает Контентщик. Берёт очередную тему из плана, пишет два текста —
-- под Telegram и под Instagram — и поля для картинки. Дальше предложение
-- ложится в core.approval и ждёт человека, как у Диспетчера: право
-- 'propose', порог автономии такой, что автоматическим оно не станет.
-- Пост от имени студии — не то место, где уместна «накопленная уверенность».
--
-- Две вещи намеренно вынесены из модели в базу.
--
-- Ссылки и хэштеги. Их дописывает cms.post_caption, а не агент. Картинку
-- репостят без подписи, а пост без ссылки на канал и сайт не работает
-- вовсе — и полагаться в этом на то, что модель не забудет, нельзя.
-- Забудет один раз из двадцати, и заметит это не она.
--
-- Публикация по нажатию в Telegram. Решение принимает человек, и проверка
-- «человек ли» настоящая: post_decide_tg ищет по tg_chat_id живого
-- владельца или оператора, а не верит раннеру на слово. Нажатие с чужого
-- аккаунта не проходит.

-- ── 1. Новый вид агента ─────────────────────────────────────────────────────

insert into core.agent_kind (code, title, max_parallel)
values ('content', 'Контентщик', 1)
on conflict (code) do nothing;

-- ── 2. Действие и право ─────────────────────────────────────────────────────

insert into core.action_type
  (code, title, target_system, has_side_effect, min_confidence, autonomy_threshold)
values
  ('post.publish', 'Пост в канал и Instagram', 'telegram', true, 0.600, 999999)
on conflict (code) do update
  set title = excluded.title,
      autonomy_threshold = excluded.autonomy_threshold;

insert into core."grant" (tenant_id, agent_kind, action_type, mode, granted_by, note)
select t.id, 'content', 'post.publish', 'propose', p.id,
       'Только предлагать. Публикацию решает человек.'
  from core.tenant t
  join core.person p on p.tenant_id = t.id
  join core.person_role r on r.person_id = p.id and r.role_code = 'owner'
 where p.is_active
on conflict do nothing;

-- ── 3. Задания ──────────────────────────────────────────────────────────────

insert into core.job_type
  (code, agent_kind, title, requires_payload, lease_sec, est_cost_usd)
values
  ('content.draft',   'content', 'Черновик поста по теме', true,  900, 0.08),
  ('content.publish', 'content', 'Публикация одобренного поста', true, 600, 0)
on conflict (code) do update set agent_kind = excluded.agent_kind,
                                 title = excluded.title,
                                 lease_sec = excluded.lease_sec;

-- ── 4. Очередь тем ──────────────────────────────────────────────────────────
-- Тема — это не «идея поста», а ссылка на уже написанный разбор. Выдумывать
-- темы агенту незачем: пятнадцать штук лежат на сайте и проверяемы.

create table if not exists cms.post_topic (
  id         bigserial primary key,
  tenant_id  uuid not null references core.tenant(id),
  slug       text not null,
  title      text not null,
  angle      text,
  source_url text,
  position   int  not null default 0,
  is_active  boolean not null default true,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

comment on table cms.post_topic is
  'Очередь тем для канала. Пустая очередь — это «сказать нечего», и так и должно быть видно.';

create table if not exists cms.post (
  id          bigserial primary key,
  tenant_id   uuid not null references core.tenant(id),
  topic_id    bigint references cms.post_topic(id),
  status      text not null default 'draft'
              check (status in ('draft','proposed','approved','published','rejected')),
  badge       text,
  headline    text not null,
  sub         text,
  steps       jsonb not null default '[]'::jsonb,
  chips       jsonb not null default '[]'::jsonb,
  tg_body     text not null,
  ig_body     text not null,
  tags_tg     text[] not null default '{}',
  tags_ig     text[] not null default '{}',
  approval_id bigint,
  job_id      bigint,
  tg_message_id bigint,
  -- Карточка черновика, которую показали владельцу. Нужна, чтобы отказ
  -- можно было дать ответом на неё: причину отказа кнопка не унесёт,
  -- а отказ без причины база не принимает.
  tg_draft_message_id bigint,
  ig_saved_path text,
  published_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists post_status_idx on cms.post (tenant_id, status, created_at desc);
create index if not exists post_approval_idx on cms.post (approval_id);
create index if not exists post_draft_msg_idx on cms.post (tenant_id, tg_draft_message_id)
  where tg_draft_message_id is not null;

-- На случай, если таблица уже создана прежней версией миграции.
alter table cms.post add column if not exists tg_draft_message_id bigint;

comment on table cms.post is
  'Черновики и опубликованные посты. Текст здесь БЕЗ ссылок и хэштегов: их дописывает cms.post_caption, чтобы забыть их было нельзя.';

-- ── 5. Хвост поста: ссылки и хэштеги ────────────────────────────────────────
-- Правило, а не привычка. Настройки лежат в cms.settings, чтобы поменять
-- адрес канала можно было без миграции.

create or replace function cms.content_settings(p_tenant uuid)
returns jsonb
language sql stable security definer set search_path = cms, core, pg_temp
as $$
  select coalesce(s.data->'content', '{}'::jsonb)
      || jsonb_build_object(
           'tg_url',   coalesce(s.data->'content'->>'tg_url',   'https://t.me/tinkerkz'),
           'site_url', coalesce(s.data->'content'->>'site_url', 'https://tinker-kz.vercel.app/'))
    from cms.settings s
   where s.tenant_id = p_tenant
  union all
  select jsonb_build_object('tg_url', 'https://t.me/tinkerkz',
                            'site_url', 'https://tinker-kz.vercel.app/')
   where not exists (select 1 from cms.settings s where s.tenant_id = p_tenant)
  limit 1
$$;

create or replace function cms.post_tags(p_post bigint, p_channel text)
returns text[]
language plpgsql stable security definer set search_path = cms, core, pg_temp
as $$
declare
  v    cms.post;
  tags text[];
begin
  select * into v from cms.post where id = p_post;
  if v.id is null then
    raise exception 'пост % не найден', p_post;
  end if;

  if p_channel = 'tg' then
    -- В Telegram хэштеги не приносят охвата: поиска по ним нет. Они работают
    -- как оглавление канала, поэтому их мало и они постоянные.
    tags := coalesce(nullif(v.tags_tg, '{}'), array['#разбор1С']);
    if not ('#tinker' = any(tags)) then
      tags := array['#tinker'] || tags;
    end if;
    return tags[1:3];
  end if;

  -- В Instagram хэштеги охват приносят. Ядро добавляется всегда, чтобы пост
  -- не вышел с тремя тегами просто потому, что модель поленилась.
  tags := array['#1с','#1сказахстан','#автоматизацияучета','#бизнесказахстан']
          || coalesce(v.tags_ig, '{}');
  return (select array_agg(distinct t order by t) from unnest(tags) t)[1:15];
end $$;

create or replace function cms.post_caption(p_post bigint, p_channel text)
returns text
language plpgsql stable security definer set search_path = cms, core, pg_temp
as $$
declare
  v    cms.post;
  cfg  jsonb;
  body text;
begin
  if p_channel not in ('tg','ig') then
    raise exception 'канал бывает tg или ig, а не «%»', p_channel;
  end if;

  select * into v from cms.post where id = p_post;
  if v.id is null then
    raise exception 'пост % не найден', p_post;
  end if;

  cfg  := cms.content_settings(v.tenant_id);
  body := trim(case when p_channel = 'tg' then v.tg_body else v.ig_body end);
  if body = '' then
    raise exception 'пустой текст поста %: публиковать нечего', p_post;
  end if;

  return body
      || E'\n\n' || (cfg->>'tg_url')
      || E'\n'   || (cfg->>'site_url')
      || E'\n\n' || array_to_string(cms.post_tags(p_post, p_channel), ' ');
end $$;

comment on function cms.post_caption(bigint, text) is
  'Итоговый текст поста: тело плюс ссылки плюс хэштеги. Собирается здесь, а не у агента, чтобы хвост нельзя было забыть.';

-- ── 6. Что видит Контентщик ─────────────────────────────────────────────────

create or replace function cms.post_basis(p_topic bigint)
returns jsonb
language sql stable security definer set search_path = cms, core, pg_temp
as $$
  select jsonb_build_object(
    'topic', jsonb_build_object(
      'id', t.id, 'title', t.title, 'angle', t.angle,
      'source_url', t.source_url),
    'links', cms.content_settings(t.tenant_id),
    'published', coalesce((
      select jsonb_agg(jsonb_build_object('headline', p.headline, 'badge', p.badge)
                       order by p.published_at desc)
        from (select * from cms.post
               where tenant_id = t.tenant_id and status = 'published'
               order by published_at desc limit 5) p), '[]'::jsonb),
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', i.text->'ru'->>'title',
               'price_from', i.props->>'price_from'))
        from cms.item i
       where i.tenant_id = t.tenant_id
         and i.collection = 'offer' and i.status = 'published'), '[]'::jsonb))
    from cms.post_topic t
   where t.id = p_topic
$$;

create or replace function cms.post_next_topic(p_tenant uuid default null)
returns bigint
language sql stable security definer set search_path = cms, core, pg_temp
as $$
  select t.id from cms.post_topic t
   where t.tenant_id = coalesce(p_tenant, core.my_tenant())
     and t.is_active and t.used_at is null
   order by t.position, t.id
   limit 1
$$;

create or replace function cms.post_queue(p_topic bigint default null)
returns bigint
language plpgsql security definer set search_path = cms, core, pg_temp
as $$
declare
  v_tenant uuid := core.my_tenant();
  v_topic  bigint := coalesce(p_topic, cms.post_next_topic(v_tenant));
  v_job    bigint;
begin
  if v_tenant is null then
    raise exception 'клиент не определён';
  end if;
  if v_topic is null then
    raise exception 'в очереди нет ни одной свободной темы: добавьте тему в cms.post_topic';
  end if;

  insert into core.job (tenant_id, job_type, agent_kind, priority, payload, dedupe_key)
  values (v_tenant, 'content.draft', 'content', 5,
          jsonb_build_object('topic_id', v_topic),
          'content.draft:' || v_topic)
  on conflict do nothing
  returning id into v_job;

  -- Идемпотентность здесь не должна выглядеть как сбой: если такое задание
  -- уже стоит в очереди, возвращаем его, а не null. На null дальше падает
  -- вставка предложения, и разбираться пришлось бы по стеку.
  if v_job is null then
    select id into v_job from core.job
     where tenant_id = v_tenant and job_type = 'content.draft'
       and dedupe_key = 'content.draft:' || v_topic
       and status in ('queued','leased','blocked','awaiting','failed')
     limit 1;
  end if;

  return v_job;
end $$;

comment on function cms.post_queue(bigint) is
  'Поставить черновик поста в очередь. Без темы берётся следующая по плану.';

-- ── 7. Предложение от Контентщика ───────────────────────────────────────────

create or replace function cms.post_propose(
  p_job      bigint,
  p_topic    bigint,
  p_badge    text,
  p_headline text,
  p_sub      text,
  p_steps    jsonb,
  p_chips    jsonb,
  p_tg       text,
  p_ig       text,
  p_tags_tg  text[],
  p_tags_ig  text[],
  p_confidence numeric)
returns jsonb
language plpgsql security definer set search_path = cms, core, public, pg_temp
as $$
declare
  v_tenant uuid;
  v_post   bigint;
  v_appr   bigint;
begin
  if coalesce(trim(p_headline), '') = '' then
    raise exception 'у поста должен быть заголовок';
  end if;
  if coalesce(trim(p_tg), '') = '' or coalesce(trim(p_ig), '') = '' then
    raise exception 'нужны оба текста: и под Telegram, и под Instagram';
  end if;
  if length(p_tg) > 900 then
    raise exception 'текст для Telegram длиннее экрана телефона (% знаков): длинное в канале не читают', length(p_tg);
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'уверенность должна быть от 0 до 1';
  end if;

  select t.tenant_id into v_tenant from cms.post_topic t where t.id = p_topic;
  if v_tenant is null then
    raise exception 'тема % не найдена', p_topic;
  end if;

  insert into cms.post (tenant_id, topic_id, status, badge, headline, sub,
                        steps, chips, tg_body, ig_body, tags_tg, tags_ig, job_id)
  values (v_tenant, p_topic, 'proposed', nullif(trim(coalesce(p_badge, '')), ''),
          trim(p_headline), nullif(trim(coalesce(p_sub, '')), ''),
          coalesce(p_steps, '[]'::jsonb), coalesce(p_chips, '[]'::jsonb),
          trim(p_tg), trim(p_ig),
          coalesce(p_tags_tg, '{}'), coalesce(p_tags_ig, '{}'), p_job)
  returning id into v_post;

  insert into core.approval
    (tenant_id, job_id, action_type, proposal, rationale, confidence, expires_at)
  values
    (v_tenant, p_job, 'post.publish',
     jsonb_build_object('post_id', v_post, 'topic_id', p_topic),
     'Черновик поста по теме из плана', p_confidence, now() + interval '7 days')
  returning id into v_appr;

  update cms.post set approval_id = v_appr, updated_at = now() where id = v_post;
  update cms.post_topic set used_at = now() where id = p_topic;

  return jsonb_build_object('post_id', v_post, 'approval_id', v_appr);
end $$;

-- Запасной путь: раннер не смог показать карточку в Telegram. Молча оставить
-- предложение лежать нельзя — предложение, о котором никто не узнал, ничем
-- не лучше его отсутствия.
create or replace function cms.post_notify(p_post bigint)
returns int
language plpgsql security definer set search_path = cms, core, pg_temp
as $$
declare v cms.post;
begin
  select * into v from cms.post where id = p_post;
  if v.id is null then raise exception 'пост % не найден', p_post; end if;

  return core.herald_notify(
    v.tenant_id,
    '<b>Контентщик</b>' || E'\n' ||
    core.tg_escape(v.headline) || E'\n\n' ||
    core.tg_escape(left(v.tg_body, 600)) || E'\n\n' ||
    'Решение № ' || coalesce(v.approval_id::text, '—') ||
    ' ждёт вас: одобрить, поправить или отклонить.',
    'post:' || p_post);
end $$;

create or replace function cms.post_draft_sent(p_post bigint, p_message_id bigint)
returns void
language sql security definer set search_path = cms, core, pg_temp
as $$
  update cms.post set tg_draft_message_id = p_message_id, updated_at = now()
   where id = p_post
$$;

-- Ответ на карточку черновика — это отказ с причиной. Сопоставление идёт
-- по номеру сообщения, а не по тексту: текст пишет человек, и угадывать
-- по нему, о каком посте речь, — не проверка, а гадание.
create or replace function cms.post_approval_by_message(p_message_id bigint)
returns bigint
language sql stable security definer set search_path = cms, core, pg_temp
as $$
  select p.approval_id from cms.post p
   where p.tg_draft_message_id = p_message_id
     and p.status = 'proposed'
   limit 1
$$;

-- ── 8. Решение человека ─────────────────────────────────────────────────────

create or replace function cms.post_apply_decision(
  p_approval bigint,
  p_verdict  text,
  p_person   uuid,
  p_patch    jsonb,
  p_reason   text)
returns jsonb
language plpgsql security definer set search_path = cms, core, public, pg_temp
as $$
declare
  v_a    core.approval;
  v_post bigint;
  v_job  bigint;
  v_st   text;
begin
  if p_verdict not in ('approve','edit','reject') then
    raise exception 'бывает approve, edit или reject';
  end if;

  select * into v_a from core.approval where id = p_approval;
  if v_a.id is null then raise exception 'решение % не найдено', p_approval; end if;
  if v_a.action_type <> 'post.publish' then
    raise exception 'решение % не про пост', p_approval;
  end if;
  if v_a.status <> 'pending' then
    raise exception 'решение % уже %: повторно решать нечего', p_approval, v_a.status;
  end if;
  if p_verdict = 'reject' and coalesce(trim(p_reason), '') = '' then
    raise exception 'у отказа должна быть причина: без неё агент не научится';
  end if;

  v_post := (v_a.proposal->>'post_id')::bigint;
  v_st := case p_verdict when 'approve' then 'approved'
                         when 'edit'    then 'approved_edited'
                         else 'rejected' end;

  update core.approval
     set status = v_st, decided_by = p_person, decided_at = now(),
         edit_delta = case when p_verdict = 'edit' then p_patch end,
         reject_reason = case when p_verdict = 'reject' then trim(p_reason) end
   where id = p_approval;

  if p_verdict = 'edit' and p_patch is not null then
    update cms.post
       set headline = coalesce(p_patch->>'headline', headline),
           sub      = coalesce(p_patch->>'sub', sub),
           tg_body  = coalesce(p_patch->>'tg_body', tg_body),
           ig_body  = coalesce(p_patch->>'ig_body', ig_body),
           updated_at = now()
     where id = v_post;
  end if;

  if p_verdict = 'reject' then
    update cms.post set status = 'rejected', updated_at = now() where id = v_post;
    -- Тема возвращается в очередь: отклонили текст, а не тему.
    update cms.post_topic set used_at = null
     where id = (v_a.proposal->>'topic_id')::bigint;
  else
    update cms.post set status = 'approved', updated_at = now() where id = v_post;
    insert into core.job (tenant_id, job_type, agent_kind, priority, payload, dedupe_key)
    values (v_a.tenant_id, 'content.publish', 'content', 4,
            jsonb_build_object('post_id', v_post),
            'content.publish:' || v_post)
    on conflict do nothing
    returning id into v_job;
  end if;

  insert into core.autonomy_stat (tenant_id, agent_kind, action_type,
                                  streak_clean, total_approved, total_edited, total_rejected)
  values (v_a.tenant_id, 'content', v_a.action_type,
          case when p_verdict = 'approve' then 1 else 0 end,
          case when p_verdict = 'approve' then 1 else 0 end,
          case when p_verdict = 'edit'    then 1 else 0 end,
          case when p_verdict = 'reject'  then 1 else 0 end)
  on conflict (tenant_id, agent_kind, action_type) do update
     set streak_clean = case when p_verdict = 'approve'
                             then core.autonomy_stat.streak_clean + 1 else 0 end,
         total_approved = core.autonomy_stat.total_approved + case when p_verdict = 'approve' then 1 else 0 end,
         total_edited   = core.autonomy_stat.total_edited   + case when p_verdict = 'edit'    then 1 else 0 end,
         total_rejected = core.autonomy_stat.total_rejected + case when p_verdict = 'reject'  then 1 else 0 end,
         last_reset_at    = case when p_verdict <> 'approve' then now() else core.autonomy_stat.last_reset_at end,
         last_reset_cause = case when p_verdict <> 'approve' then p_verdict else core.autonomy_stat.last_reset_cause end;

  return jsonb_build_object('ok', true, 'status', v_st,
                            'post_id', v_post, 'publish_job', v_job);
end $$;

-- Решение из панели: человек уже вошёл, личность известна.
create or replace function public.post_decide(
  p_approval bigint,
  p_verdict  text,
  p_patch    jsonb default null,
  p_reason   text default null)
returns jsonb
language plpgsql security definer set search_path = cms, core, public, pg_temp
as $$
declare v_person uuid := core.my_person();
begin
  if v_person is null then
    raise exception 'решение принимает вошедший человек, а не агент';
  end if;
  if not exists (select 1 from core.approval
                  where id = p_approval and tenant_id = core.my_tenant()) then
    raise exception 'решение % не найдено', p_approval;
  end if;
  return cms.post_apply_decision(p_approval, p_verdict, v_person, p_patch, p_reason);
end $$;

-- Решение кнопкой в Telegram. Раннеру здесь не верят на слово: личность
-- ищется по tg_chat_id среди живых владельцев и операторов этого клиента.
-- Нажатие с чужого аккаунта не проходит, даже если раннер передал его.
create or replace function cms.post_decide_tg(
  p_approval   bigint,
  p_verdict    text,
  p_tg_chat_id bigint,
  p_reason     text default null)
returns jsonb
language plpgsql security definer set search_path = cms, core, public, pg_temp
as $$
declare
  v_tenant uuid;
  v_person uuid;
begin
  select tenant_id into v_tenant from core.approval where id = p_approval;
  if v_tenant is null then raise exception 'решение % не найдено', p_approval; end if;

  select pr.id into v_person
    from core.person pr
    join core.person_role r on r.person_id = pr.id
   where pr.tenant_id = v_tenant
     and pr.is_active
     and pr.tg_chat_id = p_tg_chat_id
     and r.role_code in ('owner','operator')
   limit 1;

  if v_person is null then
    raise exception 'нажатие от %: такой человек не владелец и не оператор', p_tg_chat_id;
  end if;

  return cms.post_apply_decision(p_approval, p_verdict, v_person, null, p_reason);
end $$;

-- ── 9. Фиксация публикации ──────────────────────────────────────────────────

create or replace function cms.post_published(
  p_post       bigint,
  p_message_id bigint default null,
  p_ig_path    text default null)
returns void
language plpgsql security definer set search_path = cms, core, pg_temp
as $$
begin
  update cms.post
     set status = 'published',
         tg_message_id = coalesce(p_message_id, tg_message_id),
         ig_saved_path = coalesce(p_ig_path, ig_saved_path),
         published_at = coalesce(published_at, now()),
         updated_at = now()
   where id = p_post;
  if not found then
    raise exception 'пост % не найден', p_post;
  end if;
end $$;

create or replace function cms.post_for_publish(p_post bigint)
returns jsonb
language sql stable security definer set search_path = cms, core, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id, 'status', p.status,
    'badge', p.badge, 'headline', p.headline, 'sub', p.sub,
    'steps', p.steps, 'chips', p.chips,
    'tg_caption', cms.post_caption(p.id, 'tg'),
    'ig_caption', cms.post_caption(p.id, 'ig'))
    from cms.post p where p.id = p_post
$$;

-- ── 10. Права ───────────────────────────────────────────────────────────────

revoke all on function cms.post_apply_decision(bigint, text, uuid, jsonb, text) from public;
revoke all on function cms.post_decide_tg(bigint, text, bigint, text) from public;
revoke all on function cms.content_settings(uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'jarvis_worker') then
    grant select, insert, update on cms.post, cms.post_topic to jarvis_worker;
    grant usage, select on sequence cms.post_id_seq, cms.post_topic_id_seq to jarvis_worker;
    grant execute on function cms.post_basis(bigint), cms.post_propose(bigint, bigint, text, text, text, jsonb, jsonb, text, text, text[], text[], numeric),
                              cms.post_caption(bigint, text), cms.post_tags(bigint, text),
                              cms.post_for_publish(bigint), cms.post_published(bigint, bigint, text),
                              cms.post_notify(bigint), cms.post_decide_tg(bigint, text, bigint, text),
                              cms.post_draft_sent(bigint, bigint),
                              cms.post_approval_by_message(bigint),
                              cms.post_next_topic(uuid), cms.post_queue(bigint)
      to jarvis_worker;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on cms.post, cms.post_topic to authenticated;
    grant execute on function public.post_decide(bigint, text, jsonb, text),
                              cms.post_queue(bigint), cms.post_caption(bigint, text)
      to authenticated;
  end if;
end $$;

-- ── 11. RLS ─────────────────────────────────────────────────────────────────
-- Тот же блок, что и для остальных таблиц cms: политика на каждую роль,
-- force на владельца таблицы.

do $$
declare r record; roles text[] := array['jarvis_worker','authenticated'];
        rl text; pol text;
begin
  for r in
    select c.relnamespace::regnamespace::text as sch, c.relname as tbl
      from pg_class c
     where c.relkind = 'r'
       and c.relnamespace::regnamespace::text = 'cms'
       and c.relname in ('post', 'post_topic')
  loop
    execute format('alter table %I.%I enable row level security', r.sch, r.tbl);
    execute format('alter table %I.%I force row level security', r.sch, r.tbl);
    foreach rl in array roles loop
      if exists (select 1 from pg_roles where rolname = rl) then
        pol := format('%s_%s', r.tbl, rl);
        if not exists (select 1 from pg_policies
                        where schemaname = r.sch and tablename = r.tbl and policyname = pol) then
          execute format(
            'create policy %I on %I.%I for all to %I using (tenant_id = core.my_tenant()) with check (tenant_id = core.my_tenant())',
            pol, r.sch, r.tbl, rl);
        end if;
      end if;
    end loop;
  end loop;
end $$;

-- ── 12. Темы из контент-плана ───────────────────────────────────────────────
-- Пятнадцать разборов, которые уже написаны и лежат на сайте. Порядок —
-- из плана: сначала самое узнаваемое, потом деньги и обмены, потом склад
-- и скорость, потом мелочи.

insert into cms.post_topic (tenant_id, slug, title, angle, source_url, position)
select t.id, v.slug, v.title, v.angle,
       'https://tinker-kz.vercel.app/1c/' || v.slug, v.pos
  from core.tenant t
  cross join (values
    ('ne-provoditsya-dokument', 'Не проводится документ в 1С',
     'Что проверить самому: дата запрета, контроль остатков, права пользователя', 10),
    ('sleteli-dorabotki',       'После обновления слетели доработки',
     'Почему правка типового модуля не переживает обновление, а расширение переживает', 20),
    ('ne-zakryvaetsya-mesyats', 'Не закрывается месяц',
     'Типовые причины и порядок, в котором их проверяют', 30),
    ('obmen-s-bankom',          'Не работает обмен с банком',
     'Выписка не грузится: формат, сертификат, настройки обмена', 40),
    ('esf-oshibka',             'ЭСФ не выписывается или уходит с ошибкой',
     'Что смотреть до того, как звонить в поддержку', 50),
    ('zakazy-s-marketpleysa',   'Заказы с маркетплейса не попадают в 1С',
     'Kaspi, Wildberries, OZON: где рвётся цепочка', 60),
    ('ne-shodyatsya-ostatki',   'Не сходятся остатки на складе',
     'Отрицательные остатки, пересорт, задним числом проведённые документы', 70),
    ('1s-tormozit',             '1С тормозит',
     'Что можно проверить без программиста и когда дело в железе', 80),
    ('baza-vyrosla',            'База выросла: пора на сервер?',
     'Файловая база и клиент-сервер: где проходит граница', 90),
    ('pechatnaya-forma',        'Нужна своя печатная форма',
     'Сколько это стоит и почему внешняя форма лучше правки типовой', 100),
    ('prava-polzovatelya',      'Сотрудник видит лишнее или не видит нужное',
     'Роли и права доступа: как разобраться в них самому', 110),
    ('kassa-ne-probivaet',      'Касса не пробивает чек',
     'Драйвер, соединение, настройки ККМ', 120),
    ('1s-ne-zapuskaetsya',      '1С не запускается',
     'Порядок действий, пока не начали переустанавливать', 130),
    ('propali-dokumenty',       'Пропали документы',
     'Где они на самом деле и что делать до восстановления из копии', 140),
    ('samopisnaya-konfiguratsiya', 'Своя конфигурация вместо типовой',
     'Когда это оправдано, а когда дороже и хуже', 150)
  ) as v(slug, title, angle, pos)
on conflict (tenant_id, slug) do nothing;

-- ── 13. Проверка ────────────────────────────────────────────────────────────

do $$
declare n int;
begin
  select count(*) into n from cms.post_topic;
  raise notice 'Тем в очереди: %', n;
  if not exists (select 1 from core.job_type where code = 'content.draft') then
    raise exception 'задание content.draft не зарегистрировано';
  end if;
  if not exists (select 1 from core."grant" where agent_kind = 'content'
                   and action_type = 'post.publish' and mode = 'propose') then
    raise warning 'у Контентщика нет права post.publish: включите в панели ИИ -> Права и автономия';
  end if;
end $$;
