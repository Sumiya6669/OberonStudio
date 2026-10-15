/**
 * Маркетинг → Просмотры статей.
 *
 * Сколько раз открыли каждую статью /stati/<slug> (миграция 065). Список
 * статей — из сборки (src/lib/content/articles), числа — из базы: статья без
 * единого просмотра показывается с нулём. Строки базы, которым нет статьи
 * на сайте (черновик, переименованный slug, выдуманный ботом адрес), идут
 * отдельно внизу — чтобы их было видно, но они не путались со статьями.
 *
 * Считается просмотр раз за сессию вкладки, без роботов и локального
 * запуска; число — не уникальные посетители, а открытия статьи.
 */
import React from 'react';
import { Eye } from 'lucide-react';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchArticleViews } from '@/lib/supabase/queries';
import { ARTICLES, articlePath } from '@/lib/content/articles';
import { ErrorNote, Panel, Spinner, Table, dateTime, num } from '@/components/admin/ui';

// Функции ещё нет в базе (миграция 065 не применена) — это «не включено», а не сбой.
const MISSING = /could not find the function|schema cache|does not exist|PGRST202/i;

function NotYet() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface/40 p-6 text-center">
      <Eye className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Счётчик просмотров ещё не включён</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Нужно применить миграцию supabase/migrations/065_article_views.sql в SQL Editor —
        после этого статьи начнут считаться, а число появится здесь и на сайте.
      </p>
    </div>
  );
}

export default function ArticleViews() {
  const list = useAsync(fetchArticleViews);

  const { rows, extra, total } = React.useMemo(() => {
    const bySlug = new Map((list.data || []).map((r) => [r.slug, r]));
    const known = ARTICLES.map((a) => ({
      slug: a.slug,
      title: a.title,
      publishedAt: a.publishedAt,
      views: Number(bySlug.get(a.slug)?.views) || 0,
      updatedAt: bySlug.get(a.slug)?.updated_at || null,
    })).sort((x, y) => y.views - x.views || String(y.publishedAt).localeCompare(String(x.publishedAt)));
    const slugs = new Set(ARTICLES.map((a) => a.slug));
    const other = (list.data || [])
      .filter((r) => !slugs.has(r.slug))
      .map((r) => ({ slug: r.slug, views: Number(r.views) || 0, updatedAt: r.updated_at }));
    return { rows: known, extra: other, total: known.reduce((s, r) => s + r.views, 0) };
  }, [list.data]);

  if (list.loading) return <Spinner />;
  if (list.error && MISSING.test(String(list.error.message || list.error))) return <NotYet />;
  if (list.error) return <ErrorNote error={list.error} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">Всего просмотров статей: <b className="tabular-nums">{num(total)}</b></span>
        <span className="text-xs text-muted-foreground">
          Раз за сессию вкладки, без роботов. Не уникальные посетители — открытия статьи.
        </span>
      </div>

      <Panel>
        <Table
          rows={rows}
          rowKey={(r) => r.slug}
          empty="Статей на сайте пока нет — все в черновиках."
          cols={[
            {
              key: 'title', title: 'Статья',
              render: (r) => (
                <a href={articlePath(r.slug)} target="_blank" rel="noopener noreferrer"
                   className="font-medium hover:underline">{r.title}</a>
              ),
            },
            { key: 'views', title: 'Просмотры', align: 'right', width: 110, render: (r) => num(r.views) },
            { key: 'updatedAt', title: 'Последний', width: 150, render: (r) => (r.updatedAt ? dateTime(r.updatedAt) : '—') },
          ]}
        />
      </Panel>

      {extra.length > 0 && (
        <Panel title="Нет на сайте">
          <p className="-mt-1 mb-3 text-xs text-muted-foreground">
            Адреса, которых нет среди опубликованных статей: черновик, сменённый slug или выдуманный адрес.
          </p>
          <Table
            rows={extra}
            rowKey={(r) => r.slug}
            cols={[
              { key: 'slug', title: 'slug', render: (r) => <span className="text-muted-foreground">{r.slug}</span> },
              { key: 'views', title: 'Просмотры', align: 'right', width: 110, render: (r) => num(r.views) },
              { key: 'updatedAt', title: 'Последний', width: 150, render: (r) => dateTime(r.updatedAt) },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
