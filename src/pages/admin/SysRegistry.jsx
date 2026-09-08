/**
 * Реестры агентов и заданий.
 *
 * Реестры вместо перечислений в схеме: добавить вид задания — это вставка
 * строки, а не миграция. Здесь же живут два предела, из-за которых чаще всего
 * «всё стоит, а непонятно почему»:
 *
 *   max_parallel — сколько заданий агент берёт одновременно. Очередь стоит
 *   не потому что агент сломался, а потому что этот предел выбран.
 *
 *   lease_sec — сколько агент держит задание. Истекла аренда — задание
 *   возвращается в очередь «Сторожем». Слишком маленький срок для длинной
 *   работы означает, что задание будут отбирать у работающего агента.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import {
  fetchAgentKinds, saveAgentKind, fetchJobTypesAll, saveJobType,
} from '@/lib/supabase/queries';
import {
  Badge, Button, ErrorNote, Field, Modal, Panel, Spinner, Table, Tabs,
  duration, inputClass, num, usd,
} from '@/components/admin/ui';

export default function SysRegistry() {
  const [tab, setTab] = React.useState('agents');
  const agents = useAsync(fetchAgentKinds);
  const jobs = useAsync(fetchJobTypesAll);
  const [edit, setEdit] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (agents.loading) return <Spinner />;

  const saveAgent = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await saveAgentKind(edit.code, {
        title: edit.title.trim(),
        max_parallel: Number(edit.max_parallel),
        is_active: edit.is_active,
      });
      setEdit(null); agents.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const saveJob = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await saveJobType(edit.code, {
        title: edit.title.trim(),
        max_attempts: Number(edit.max_attempts),
        backoff_base_sec: Number(edit.backoff_base_sec),
        lease_sec: Number(edit.lease_sec),
        est_cost_usd: Number(edit.est_cost_usd),
        is_active: edit.is_active,
      });
      setEdit(null); jobs.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Реестры агентов</h1>
      <ErrorNote error={agents.error || jobs.error || error} />

      <Tabs value={tab} onChange={setTab}
            items={[
              { value: 'agents', label: 'Агенты', count: (agents.data || []).length },
              { value: 'jobs', label: 'Виды заданий', count: (jobs.data || []).length },
            ]} />

      {tab === 'agents' && (
        <Panel title="Агенты">
          <Table
            empty="Реестр агентов пуст."
            rowKey={(r) => r.code}
            cols={[
              { key: 'title', title: 'Агент',
                render: (r) => (
                  <div>
                    <div>{r.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                  </div>
                ) },
              { key: 'max_parallel', title: 'Одновременно', align: 'right',
                render: (r) => num(r.max_parallel) },
              { key: 'is_active', title: 'Состояние',
                render: (r) => r.is_active
                  ? <Badge tone="approved">включён</Badge>
                  : <Badge tone="cancelled">выключен</Badge> },
              { key: 'act', title: '', align: 'right',
                render: (r) => (
                  <Button variant="ghost" onClick={() => { setError(null); setEdit({ ...r, kind: 'agent' }); }}>
                    Изменить
                  </Button>
                ) },
            ]}
            rows={agents.data || []}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Выключенный агент не берёт новые задания, но уже взятые доводит до конца.
            Задания продолжают ставиться в очередь и ждут включения — они не теряются.
          </p>
        </Panel>
      )}

      {tab === 'jobs' && (
        <Panel title="Виды заданий">
          {jobs.loading ? <Spinner /> : (
            <Table
              empty="Реестр заданий пуст."
              rowKey={(r) => r.code}
              cols={[
                { key: 'title', title: 'Задание',
                  render: (r) => (
                    <div>
                      <div>{r.title}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                    </div>
                  ) },
                { key: 'agent_kind', title: 'Агент',
                  render: (r) => <span className="font-mono text-xs">{r.agent_kind}</span> },
                { key: 'max_attempts', title: 'Попыток', align: 'right' },
                { key: 'backoff_base_sec', title: 'Пауза', align: 'right',
                  render: (r) => duration(r.backoff_base_sec * 1000) },
                { key: 'lease_sec', title: 'Держит', align: 'right',
                  render: (r) => duration(r.lease_sec * 1000) },
                { key: 'est_cost_usd', title: 'Ожидаемая цена', align: 'right',
                  render: (r) => usd(r.est_cost_usd) },
                { key: 'requires_payload', title: 'Нужны данные',
                  render: (r) => r.requires_payload ? 'да' : 'нет' },
                { key: 'is_active', title: 'Состояние',
                  render: (r) => r.is_active
                    ? <Badge tone="approved">включено</Badge>
                    : <Badge tone="cancelled">выключено</Badge> },
                { key: 'act', title: '', align: 'right',
                  render: (r) => (
                    <Button variant="ghost" onClick={() => { setError(null); setEdit({ ...r, kind: 'job' }); }}>
                      Изменить
                    </Button>
                  ) },
              ]}
              rows={jobs.data || []}
            />
          )}
        </Panel>
      )}

      {edit?.kind === 'agent' && (
        <Modal title={edit.title} onClose={() => setEdit(null)}>
          <form onSubmit={saveAgent} className="space-y-4">
            <ErrorNote error={error} />
            <Field label="Название">
              <input className={inputClass} required value={edit.title}
                     onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <Field label="Заданий одновременно"
                   hint="От 1 до 32. Именно этот предел чаще всего и держит очередь.">
              <input className={inputClass} type="number" min="1" max="32" required
                     value={edit.max_parallel}
                     onChange={(e) => setEdit({ ...edit, max_parallel: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_active}
                     onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
              Включён
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}

      {edit?.kind === 'job' && (
        <Modal title={edit.title} onClose={() => setEdit(null)}>
          <form onSubmit={saveJob} className="space-y-4">
            <ErrorNote error={error} />
            <Field label="Название">
              <input className={inputClass} required value={edit.title}
                     onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Попыток" hint="От 1 до 10.">
                <input className={inputClass} type="number" min="1" max="10" required
                       value={edit.max_attempts}
                       onChange={(e) => setEdit({ ...edit, max_attempts: e.target.value })} />
              </Field>
              <Field label="Базовая пауза, с" hint="Не меньше 5. Растёт с каждой попыткой.">
                <input className={inputClass} type="number" min="5" required
                       value={edit.backoff_base_sec}
                       onChange={(e) => setEdit({ ...edit, backoff_base_sec: e.target.value })} />
              </Field>
            </div>
            <Field label="Держит задание, с"
                   hint="От 30 до 21600. Меньше реальной длительности работы — и задание отберут у работающего агента.">
              <input className={inputClass} type="number" min="30" max="21600" required
                     value={edit.lease_sec}
                     onChange={(e) => setEdit({ ...edit, lease_sec: e.target.value })} />
            </Field>
            <Field label="Ожидаемая цена, $"
                   hint="По ней резервируется квота до обращения к внешней службе.">
              <input className={inputClass} type="number" min="0" step="0.00001" required
                     value={edit.est_cost_usd}
                     onChange={(e) => setEdit({ ...edit, est_cost_usd: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_active}
                     onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
              Включено
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Сохранить</Button>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
