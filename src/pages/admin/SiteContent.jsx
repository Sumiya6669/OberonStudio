/**
 * Сайт: справочники.
 *
 * Услуги, кейсы, отзывы, вопросы, стек и готовые решения — одна таблица в базе
 * с описанием полей рядом. Поэтому этот экран один на все справочники, и новый
 * справочник не требует ни нового экрана, ни миграции.
 *
 * Опубликовать запись с незаполненными обязательными полями нельзя: отказывает
 * база, и в отказе перечислено, чего именно не хватает. Пустая карточка на сайте
 * — это то, что видит клиент, и лучше отказать здесь.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchCollections, fetchItems, saveItem, removeItem, fetchRevisions,
} from '@/lib/supabase/queries';
import {
  Badge, Button, Empty, ErrorNote, Modal, Panel, Spinner, Stat, StatusBadge,
  Table, Tabs, cmsStatusLabel, cx, dateTime, num,
} from '@/components/admin/ui';
import { ItemFields, LOCALES } from '@/components/admin/fields';

export default function SiteContent() {
  const { person } = useAuth();
  const collections = useAsync(fetchCollections);
  const [code, setCode] = React.useState(null);
  const current = (collections.data || []).find((c) => c.code === code)
    || (collections.data || [])[0];
  const items = useAsync(
    () => (current ? fetchItems(current.code) : Promise.resolve([])),
    [current?.code],
  );
  const [edit, setEdit] = React.useState(null);
  const [history, setHistory] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (collections.loading) return <Spinner />;
  if (!current) {
    return <Empty>Справочники не заведены. Их создаёт миграция 015 при первом запуске.</Empty>;
  }

  const rows = items.data || [];
  const published = rows.filter((r) => r.status === 'published').length;

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await saveItem({
        id: edit.id,
        tenant_id: person.tenant_id,
        collection: current.code,
        slug: current.has_slug ? (edit.slug || null) : null,
        text: edit.text,
        props: edit.props,
        status: edit.status,
        sort: edit.sort,
      });
      setEdit(null); items.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Сайт: справочники</h1>
        <Button onClick={() => {
          setError(null);
          setEdit({
            slug: '', text: {}, props: {}, status: 'draft',
            sort: ((rows.at(-1)?.sort ?? 0) + 10),
          });
        }}>
          Добавить: {current.title_one.toLowerCase()}
        </Button>
      </div>
      <ErrorNote error={collections.error || items.error || error} />

      <Tabs value={current.code} onChange={setCode}
            items={(collections.data || []).map((c) => ({ value: c.code, label: c.title }))} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Записей" value={rows.length} />
        <Stat label="Опубликовано" value={published}
              hint={published ? 'видно на сайте' : 'сайт показывает зашитое в код'} />
        <Stat label="Полей в описании" value={(current.fields || []).length} />
      </div>

      <Panel title={current.title}>
        {items.loading ? <Spinner /> : (
          <Table
            empty={`Записей нет. Пока справочник пуст, сайт показывает то, что зашито в код, — ничего не пропадёт.`}
            cols={[
              { key: 'sort', title: '№', width: 48, align: 'right' },
              { key: 'label_ru', title: 'Название' },
              { key: 'slug', title: 'Короткое имя', hide: !current.has_slug,
                render: (r) => r.slug
                  ? <span className="font-mono text-xs">{r.slug}</span>
                  : <span className="text-muted-foreground">—</span> },
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
              { key: 'status', title: 'Состояние',
                render: (r) => <StatusBadge value={r.status} dict={cmsStatusLabel} /> },
              { key: 'revisions', title: 'Правок', align: 'right',
                render: (r) => Number(r.revisions)
                  ? <button className="text-blue hover:underline"
                            onClick={() => setHistory(r)}>{num(r.revisions)}</button>
                  : <span className="text-muted-foreground">—</span> },
              { key: 'updated_at', title: 'Изменено', align: 'right',
                render: (r) => <span className="text-xs text-muted-foreground">{dateTime(r.updated_at)}</span> },
              { key: 'act', title: '', align: 'right',
                render: (r) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" onClick={() => {
                      setError(null);
                      setEdit({ ...r, text: r.text || {}, props: r.props || {}, slug: r.slug || '' });
                    }}>Править</Button>
                    <Button variant="danger" onClick={async () => {
                      if (!window.confirm('Удалить запись? Прежнее содержимое останется в истории правок.')) return;
                      try { await removeItem(r.id); items.reload(); } catch (err) { setError(err); }
                    }}>Удалить</Button>
                  </div>
                ) },
            ]}
            rows={rows}
          />
        )}
      </Panel>

      {edit && (
        <Modal title={edit.id ? `${current.title_one}: ${edit.text?.ru?.title || edit.text?.ru?.name || edit.slug || 'без названия'}`
                              : `Новая запись: ${current.title_one.toLowerCase()}`}
               onClose={() => setEdit(null)} wide>
          <form onSubmit={submit} className="space-y-4">
            <ErrorNote error={error} />
            <ItemFields collection={current} value={edit} onChange={setEdit} />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}

      {history && <HistoryModal item={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function HistoryModal({ item, onClose }) {
  const list = useAsync(() => fetchRevisions('item', item.id), [item.id]);
  return (
    <Modal title={`История правок: ${item.label_ru}`} onClose={onClose} wide>
      {list.loading ? <Spinner /> : !list.data?.length ? (
        <Empty>Правок не было.</Empty>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Каждая правка сохраняет ПРЕЖНЕЕ состояние записи. История только дописывается:
            переписать или удалить её нельзя даже из панели — права на это отозваны в базе.
          </p>
          {list.data.map((r) => (
            <div key={r.id} className="rounded-lg border border-line px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={r.op === 'delete' ? 'dead' : undefined}>
                  {r.op === 'delete' ? 'удаление' : 'правка'}
                </Badge>
                <span className="text-muted-foreground">{dateTime(r.at)}</span>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-background px-2 py-1.5 text-[11px]">
                {JSON.stringify(r.snapshot, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
