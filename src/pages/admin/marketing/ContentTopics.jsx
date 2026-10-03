/**
 * Маркетинг → Темы статей.
 *
 * Очередь тем Контентщика (cms.post_topic, миграция 047) и что стало с каждой
 * темой: следующая на очереди, взята в работу, черновик на согласовании,
 * опубликована. Только чтение: тему берёт агент, решение по посту человек
 * принимает кнопкой в Telegram, а здесь видно, где всё это сейчас стоит.
 *
 * Пустая очередь или база без миграции 047 — не ошибка: значит, бот
 * маркетолога ещё не работает, и экран так и говорит.
 */
import React from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchContentTopics } from '@/lib/supabase/queries';
import { TOPIC_STATUS, topicRows } from '@/lib/admin/marketing';
import {
  Badge, ErrorNote, Panel, Spinner, Table, Tabs, dateOnly,
} from '@/components/admin/ui';

const FILTERS = [
  { value: 'all', label: 'Все', match: () => true },
  { value: 'queue', label: 'В очереди', match: (s) => ['next', 'queued', 'returned'].includes(s) },
  { value: 'work', label: 'В работе', match: (s) => ['taken', 'draft', 'proposed', 'approved'].includes(s) },
  { value: 'published', label: 'Опубликованы', match: (s) => s === 'published' },
  { value: 'off', label: 'Выключены', match: (s) => s === 'off' },
];

// Таблицы ещё нет в базе (миграция 047 не применена) — это «бот не запущен», а не сбой.
const MISSING = /does not exist|schema cache|relation .* not found|could not find the table/i;

const isHttp = (value) => /^https?:\/\//i.test(String(value || ''));

function NotYet() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface/40 p-6 text-center">
      <Newspaper className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Контент-план ведёт бот маркетолога</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Список появится здесь, когда бот заработает на сервере в РК.
      </p>
    </div>
  );
}

export default function ContentTopics() {
  const list = useAsync(fetchContentTopics);
  const [filter, setFilter] = React.useState('all');

  const rows = React.useMemo(
    () => topicRows(list.data?.topics, list.data?.posts),
    [list.data],
  );

  if (list.loading) return <Spinner />;
  if (list.error && MISSING.test(String(list.error.message || list.error))) return <NotYet />;
  if (list.error) return <ErrorNote error={list.error} />;
  if (rows.length === 0) return <NotYet />;

  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, rows.filter((r) => f.match(r.status)).length]));
  const current = FILTERS.find((f) => f.value === filter) || FILTERS[0];
  const shown = rows.filter((r) => current.match(r.status));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))}
              value={filter} onChange={setFilter} />
        <span className="text-xs text-muted-foreground">
          Только просмотр. Тему берёт Контентщик, пост одобряют кнопкой в Telegram.
        </span>
      </div>

      <Panel>
        <Table
          rows={shown}
          empty="В этом разделе тем нет."
          cols={[
            { key: 'position', title: '№', align: 'right', width: 48 },
            {
              key: 'title', title: 'Тема',
              render: (r) => (
                <div>
                  <div className="font-medium">{r.title}</div>
                  {r.angle && <div className="mt-0.5 text-xs text-muted-foreground">{r.angle}</div>}
                </div>
              ),
            },
            {
              key: 'status', title: 'Статус',
              render: (r) => {
                const st = TOPIC_STATUS[r.status] || { label: r.status };
                return <Badge tone={st.tone}>{st.label}</Badge>;
              },
            },
            {
              key: 'post', title: 'Последний пост',
              render: (r) => (r.post ? (
                <div className="text-xs">
                  <div className="text-foreground">{r.post.headline}</div>
                  <div className="mt-0.5 text-muted-foreground">
                    {r.post.published_at ? `опубликован ${dateOnly(r.post.published_at)}` : `создан ${dateOnly(r.post.created_at)}`}
                  </div>
                </div>
              ) : <span className="text-xs text-muted-foreground">—</span>),
            },
            {
              key: 'source_url', title: 'Разбор на сайте',
              render: (r) => (isHttp(r.source_url) ? (
                <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 text-xs text-violet hover:underline">
                  {r.slug} <ExternalLink className="h-3 w-3" />
                </a>
              ) : <span className="text-xs text-muted-foreground">{r.slug}</span>),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
