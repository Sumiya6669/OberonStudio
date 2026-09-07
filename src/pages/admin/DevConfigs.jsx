/**
 * Конфигурации 1С. Здесь хранится только паспорт индекса: где лежит выгрузка,
 * чем собран индекс, когда, и не устарел ли. Сам индекс строит скилл
 * 1c-config-analysis на вашей машине — база хранит ссылку, а не гигабайты.
 *
 * Пометка «устарел» важнее, чем кажется: молчаливый ответ по вчерашней
 * конфигурации хуже отказа, поэтому отчёты по такому индексу помечаются
 * триггером базы, а не надеждой на внимательность.
 */
import React, { useState } from 'react';
import { Database, RefreshCw, FileSearch } from 'lucide-react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchConfigs, fetchCompanies, saveConfigSnapshot, fetchReports, enqueueJob,
} from '@/lib/supabase/queries';
import {
  Badge, Button, Empty, ErrorNote, Field, Panel, Spinner, dateTime, inputClass,
} from '@/components/admin/ui';

const EMPTY = { title: '', company_id: '', src_path: '', db_path: '', source_kind: 'xml', note: '' };

export default function DevConfigs() {
  const { person } = useAuth();
  const list = useAsync(fetchConfigs);
  const companies = useAsync(fetchCompanies);
  const [form, setForm] = useState(null);
  const [openReports, setOpenReports] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError(null); setBusy(true);
    try { await fn(); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const submit = (event) => {
    event.preventDefault();
    run(async () => {
      await saveConfigSnapshot({
        id: form.id,
        tenant_id: person.tenant_id,
        company_id: form.company_id,
        title: form.title.trim(),
        src_path: form.src_path.trim(),
        db_path: form.db_path.trim(),
        source_kind: form.source_kind,
        note: form.note.trim() || null,
      });
      setForm(null); list.reload();
    });
  };

  const reindex = (snapshot) => run(async () => {
    await enqueueJob({
      tenantId: person.tenant_id,
      jobType: 'dev.index',
      agentKind: 'dev_1c',
      priority: 6,
      payload: { snapshot_id: snapshot.id, src_path: snapshot.src_path, db_path: snapshot.db_path },
      dedupeKey: `dev.index:${snapshot.id}`,
    });
  });

  const audit = (snapshot) => run(async () => {
    await enqueueJob({
      tenantId: person.tenant_id,
      jobType: 'dev.audit',
      agentKind: 'dev_1c',
      priority: 5,
      payload: { snapshot_id: snapshot.id },
      dedupeKey: `dev.audit:${snapshot.id}`,
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Конфигурации 1С</h1>
        <Button onClick={() => setForm({ ...EMPTY })}>Добавить</Button>
      </div>

      <ErrorNote error={error} />

      {form && (
        <Panel title={form.id ? 'Правка' : 'Новая конфигурация'}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Field label="Клиент">
              <select required className={inputClass} value={form.company_id}
                      onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                <option value="">— выберите —</option>
                {(companies.data || []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
            <Field label="Название" hint="как отличаете её от других баз клиента">
              <input required className={inputClass} value={form.title}
                     onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Путь к выгрузке" hint="на машине с раннером, например D:\clients\alfa\1CXML">
              <input required className={inputClass} value={form.src_path}
                     onChange={(e) => setForm({ ...form, src_path: e.target.value })} /></Field>
            <Field label="Путь к индексу" hint="D:\clients\alfa\_index\config_index.sqlite">
              <input required className={inputClass} value={form.db_path}
                     onChange={(e) => setForm({ ...form, db_path: e.target.value })} /></Field>
            <Field label="Источник">
              <select className={inputClass} value={form.source_kind}
                      onChange={(e) => setForm({ ...form, source_kind: e.target.value })}>
                <option value="xml">выгрузка в XML</option>
                <option value="cf_unpack">распаковка CF</option>
              </select>
            </Field>
            <Field label="Заметка"><input className={inputClass} value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={busy}>Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Отмена</Button>
            </div>
          </form>
        </Panel>
      )}

      {list.loading ? <Spinner /> : !list.data?.length ? (
        <Panel><Empty>Ни одной конфигурации. Добавьте первую и поставьте задание на индексацию.</Empty></Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.data.map((c) => (
            <Panel key={c.id} title={`${c.company_title} · ${c.title}`}
                   action={c.stale
                     ? <Badge tone="failed">индекс устарел</Badge>
                     : c.indexed_at ? <Badge tone="approved">готов</Badge> : <Badge>не собран</Badge>}>
              <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Конфигурация</dt>
                <dd>{c.cfg_name || '—'} {c.cfg_version || ''}</dd>
                <dt className="text-muted-foreground">Режим</dt>
                <dd>{c.app_mode || '—'}</dd>
                <dt className="text-muted-foreground">Строк кода</dt>
                <dd className="tabular-nums">{(c.modules_loc || 0).toLocaleString('ru-RU')}</dd>
                <dt className="text-muted-foreground">Объектов</dt>
                <dd className="tabular-nums">{c.objects_total || 0}</dd>
                <dt className="text-muted-foreground">Вне поддержки</dt>
                <dd className="tabular-nums">
                  {c.objects_custom || 0}
                  {c.custom_pct != null && <span className="ml-1 text-muted-foreground">({c.custom_pct}%)</span>}
                </dd>
                <dt className="text-muted-foreground">Обычные формы</dt>
                <dd>{c.has_binforms ? 'разобраны' : 'нет или не разобраны'}</dd>
                <dt className="text-muted-foreground">Проиндексирован</dt>
                <dd>{dateTime(c.indexed_at)}</dd>
                <dt className="text-muted-foreground">Отчётов</dt>
                <dd className="tabular-nums">{c.reports_count || 0}</dd>
              </dl>

              <p className="mt-3 break-all text-[11px] text-muted-foreground">{c.src_path}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" disabled={busy} onClick={() => reindex(c)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Переиндексировать
                </Button>
                <Button variant="ghost" disabled={busy || !c.indexed_at} onClick={() => audit(c)}>
                  <FileSearch className="h-3.5 w-3.5" /> Аудит доработок
                </Button>
                <Button variant="ghost"
                        onClick={() => setOpenReports(openReports === c.id ? null : c.id)}>
                  <Database className="h-3.5 w-3.5" /> Отчёты
                </Button>
              </div>

              {openReports === c.id && <Reports snapshotId={c.id} />}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function Reports({ snapshotId }) {
  const { data, loading, error } = useAsync(() => fetchReports(snapshotId), [snapshotId]);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data?.length) return <Empty>Отчётов пока нет.</Empty>;

  return (
    <ul className="mt-3 space-y-2 border-t border-line pt-3">
      {data.map((r) => (
        <li key={r.id} className="rounded-lg border border-line px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">{r.title}</span>
            <Badge tone={r.stale_index ? 'failed' : undefined}>{r.kind}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{dateTime(r.created_at)}</span>
            <span>находок: {Array.isArray(r.findings) ? r.findings.length : 0}</span>
            <span>${Number(r.cost_usd || 0).toFixed(3)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
