/**
 * Сайт: страницы и блоки.
 *
 * Пока страница в черновиках, сайт показывает то, что зашито в код, — ровно как
 * сегодня. Это сделано намеренно: опубликовать пустую страницу и обнаружить это
 * от клиента хуже, чем не опубликовать ничего. Поэтому черновик ничего не ломает,
 * а публикация без заголовка по-русски просто не проходит: отказывает база.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchCmsPages, savePage, fetchBlocks, saveBlock, removeBlock,
} from '@/lib/supabase/queries';
import {
  Badge, Button, ErrorNote, Field, Modal, Panel, Spinner, Stat, StatusBadge,
  Table, cmsStatusLabel, cx, dateTime, inputClass,
} from '@/components/admin/ui';
import SiteFreshness from '@/components/admin/SiteFreshness';
import { ItemFields, LOCALES } from '@/components/admin/fields';

const BLOCK_TYPES = [
  ['hero', 'Заглавный блок'], ['text', 'Текст'], ['features', 'Список преимуществ'],
  ['cta', 'Призыв к действию'], ['quote', 'Цитата'], ['gallery', 'Галерея'],
  ['services', 'Услуги из справочника'], ['works', 'Кейсы из справочника'],
  ['reviews', 'Отзывы из справочника'], ['faq', 'Вопросы из справочника'],
  ['stack', 'Стек из справочника'], ['products', 'Решения из справочника'],
  ['html', 'Своя разметка'],
];

const PAGE_FIELDS = {
  has_slug: false,
  fields: [
    { key: 'title', label: 'Заголовок', type: 'text', required: true, loc: true },
    { key: 'subtitle', label: 'Подзаголовок', type: 'textarea', required: false, loc: true },
    { key: 'seo_title', label: 'Заголовок для поиска', type: 'text', required: false, loc: true },
    { key: 'seo_desc', label: 'Описание для поиска', type: 'textarea', required: false, loc: true },
  ],
};

export default function SitePages() {
  const { person } = useAuth();
  const pages = useAsync(fetchCmsPages);
  const [edit, setEdit] = React.useState(null);
  const [blocksOf, setBlocksOf] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (pages.loading) return <Spinner />;

  const rows = pages.data || [];
  const published = rows.filter((r) => r.status === 'published').length;

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await savePage({
        id: edit.id,
        tenant_id: person.tenant_id,
        slug: edit.slug,
        nav_key: edit.nav_key || null,
        icon: edit.icon || null,
        text: edit.text,
        in_nav: edit.in_nav,
        in_footer: edit.in_footer,
        status: edit.status,
        sort: edit.sort,
      });
      setEdit(null); pages.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Сайт: страницы</h1>
        <Button onClick={() => {
          setError(null);
          setEdit({
            slug: '/', nav_key: '', icon: '', text: {}, in_nav: true, in_footer: true,
            status: 'draft', sort: 100, props: {},
          });
        }}>Новая страница</Button>
      </div>

      <SiteFreshness reason="pages" />
      <ErrorNote error={pages.error || error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Страниц" value={rows.length} />
        <Stat label="Опубликовано" value={published}
              hint={published ? 'сайт берёт их из базы' : 'сайт показывает зашитое в код'} />
        <Stat label="Черновиков" value={rows.length - published} />
      </div>

      {published === 0 && (
        <p className="rounded-lg border border-line bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
          Ни одна страница не опубликована, поэтому сайт работает как раньше — на текстах
          из кода. Опубликованная страница начинает перекрывать код; неопубликованные
          не влияют ни на что.
        </p>
      )}

      <Panel title="Страницы">
        <Table
          empty="Страниц нет."
          cols={[
            { key: 'slug', title: 'Адрес',
              render: (r) => <span className="font-mono text-xs">{r.slug}</span> },
            { key: 'title_ru', title: 'Заголовок' },
            { key: 'locales', title: 'Языки',
              render: (r) => (
                <div className="flex gap-1">
                  {LOCALES.map((l) => (
                    <span key={l.value}
                          className={cx('rounded border px-1.5 text-[11px]',
                            r.locales?.includes(l.value)
                              ? 'border-emerald-500/40 text-emerald-400'
                              : 'border-line text-muted-foreground/50')}>
                      {l.value}
                    </span>
                  ))}
                </div>
              ) },
            { key: 'blocks', title: 'Блоки', align: 'right',
              render: (r) => (
                <span className="text-xs text-muted-foreground">
                  {r.blocks_published} из {r.blocks_total}
                </span>
              ) },
            { key: 'nav', title: 'В меню',
              render: (r) => (
                <div className="flex gap-1">
                  {r.in_nav && <Badge>меню</Badge>}
                  {r.in_footer && <Badge>подвал</Badge>}
                </div>
              ) },
            { key: 'status', title: 'Состояние',
              render: (r) => <StatusBadge value={r.status} dict={cmsStatusLabel} /> },
            { key: 'updated_at', title: 'Изменена', align: 'right',
              render: (r) => <span className="text-xs text-muted-foreground">{dateTime(r.updated_at)}</span> },
            { key: 'act', title: '', align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" onClick={() => setBlocksOf(r)}>Блоки</Button>
                  <Button variant="ghost" onClick={() => {
                    setError(null);
                    setEdit({ ...r, nav_key: r.nav_key || '', icon: r.icon || '', props: {} });
                  }}>Править</Button>
                </div>
              ) },
          ]}
          rows={rows}
        />
      </Panel>

      {edit && (
        <Modal title={edit.id ? `Страница ${edit.slug}` : 'Новая страница'}
               onClose={() => setEdit(null)} wide>
          <form onSubmit={submit} className="space-y-4">
            <ErrorNote error={error} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Адрес" hint="Начинается со слэша.">
                <input className={inputClass} required value={edit.slug}
                       onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
              </Field>
              <Field label="Ключ в меню"
                     hint="Пока пусто, подпись в меню берётся из словаря переводов.">
                <input className={inputClass} value={edit.nav_key}
                       onChange={(e) => setEdit({ ...edit, nav_key: e.target.value })} />
              </Field>
              <Field label="Значок" hint="Имя из набора lucide, например Sparkles.">
                <input className={inputClass} value={edit.icon}
                       onChange={(e) => setEdit({ ...edit, icon: e.target.value })} />
              </Field>
            </div>

            <ItemFields collection={PAGE_FIELDS} value={edit} onChange={setEdit} />

            <div className="flex flex-wrap gap-4 border-t border-line pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.in_nav}
                       onChange={(e) => setEdit({ ...edit, in_nav: e.target.checked })} />
                Показывать в меню
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.in_footer}
                       onChange={(e) => setEdit({ ...edit, in_footer: e.target.checked })} />
                Показывать в подвале
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}

      {blocksOf && (
        <BlocksModal page={blocksOf} onClose={() => setBlocksOf(null)}
                     tenantId={person.tenant_id} onSaved={() => pages.reload()} />
      )}
    </div>
  );
}

function BlocksModal({ page, onClose, tenantId, onSaved }) {
  const list = useAsync(() => fetchBlocks(page.id), [page.id]);
  const [edit, setEdit] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const blockCollection = {
    has_slug: false,
    fields: [
      { key: 'title', label: 'Заголовок', type: 'text', required: false, loc: true },
      { key: 'body', label: 'Текст', type: 'markdown', required: false, loc: true },
      { key: 'cta_label', label: 'Надпись на кнопке', type: 'text', required: false, loc: true },
    ],
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await saveBlock({
        id: edit.id,
        tenant_id: tenantId,
        page_id: page.id,
        type: edit.type,
        text: edit.text,
        props: edit.props,
        status: edit.status,
        sort: edit.sort,
      });
      setEdit(null); list.reload(); onSaved?.();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Блоки страницы ${page.slug}`} onClose={onClose} wide>
      <div className="space-y-4">
        <ErrorNote error={error} />
        {list.loading ? <Spinner /> : (
          <Table
            empty="Блоков нет. Пока их нет, страница на сайте выглядит как раньше."
            cols={[
              { key: 'sort', title: '№', width: 48, align: 'right' },
              { key: 'type', title: 'Тип',
                render: (b) => (BLOCK_TYPES.find((t) => t[0] === b.type) || [, b.type])[1] },
              { key: 'title', title: 'Заголовок',
                render: (b) => b.text?.ru?.title || <span className="text-muted-foreground">—</span> },
              { key: 'status', title: 'Состояние',
                render: (b) => <StatusBadge value={b.status} dict={cmsStatusLabel} /> },
              { key: 'act', title: '', align: 'right',
                render: (b) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" onClick={() => {
                      setError(null);
                      setEdit({ ...b, text: b.text || {}, props: b.props || {} });
                    }}>Править</Button>
                    <Button variant="danger" onClick={async () => {
                      if (!window.confirm('Удалить блок? Прежнее содержимое останется в истории правок.')) return;
                      try { await removeBlock(b.id); list.reload(); } catch (err) { setError(err); }
                    }}>Удалить</Button>
                  </div>
                ) },
            ]}
            rows={list.data || []}
          />
        )}

        {!edit && (
          <Button onClick={() => {
            setError(null);
            setEdit({
              type: 'text', text: {}, props: {}, status: 'draft',
              sort: ((list.data || []).at(-1)?.sort ?? 0) + 10,
            });
          }}>Добавить блок</Button>
        )}

        {edit && (
          <form onSubmit={submit} className="space-y-4 rounded-xl border border-line p-4">
            <Field label="Тип блока">
              <select className={inputClass} value={edit.type}
                      onChange={(e) => setEdit({ ...edit, type: e.target.value })}>
                {BLOCK_TYPES.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </Field>

            {edit.type.endsWith('s') && ['services', 'works', 'reviews', 'stack', 'products'].includes(edit.type) && (
              <p className="rounded-lg border border-line px-3 py-2 text-xs text-muted-foreground">
                Этот блок берёт записи из справочника. Заголовок и текст здесь — обрамление,
                сами записи правятся в разделе «Сайт: справочники».
              </p>
            )}

            <ItemFields collection={blockCollection} value={edit} onChange={setEdit} />

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Сохранить блок</Button>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>Отмена</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
