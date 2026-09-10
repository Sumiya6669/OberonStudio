/**
 * Реестры агентов и заданий.
 *
 * Здесь живут два предела, из-за которых чаще всего «всё стоит, а непонятно
 * почему»:
 *
 *   одновременно — сколько заданий агент берёт разом. Очередь стоит не потому
 *   что агент сломался, а потому что этот предел выбран;
 *
 *   держит задание — сколько агент удерживает работу. Истекла аренда — задание
 *   возвращается в очередь «Сторожем». Слишком маленький срок для длинной
 *   работы означает, что задание будут отбирать у работающего агента.
 *
 * Правится только первый. Выключатель и предел одновременности — это то, что
 * трогают в работе, и они пишутся в переопределение на клиента. Сроки видов
 * заданий не правятся из панели: это свойство самой работы, а не клиента, и
 * менять их стоит осознанно, запросом в базе. Кнопка, которую легко нажать
 * не туда, здесь была бы вредна.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchAgentBoard, saveAgentLimit, resetAgentLimit, fetchJobTypesAll,
} from '@/lib/supabase/queries';
import {
  Badge, Button, ErrorNote, Field, Modal, Panel, Spinner, Stat, Table, Tabs,
  duration, inputClass, num, usd,
} from '@/components/admin/ui';

export default function SysRegistry() {
  const { person } = useAuth();
  const [tab, setTab] = React.useState('agents');
  const agents = useAsync(fetchAgentBoard);
  const jobs = useAsync(fetchJobTypesAll);
  const [edit, setEdit] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (agents.loading) return <Spinner />;

  const rows = agents.data || [];
  const off = rows.filter((r) => !r.is_active).length;
  const overridden = rows.filter((r) => r.overridden).length;

  const submit = async (event) => {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      await saveAgentLimit({
        tenantId: person.tenant_id,
        agentKind: edit.code,
        maxParallel: edit.max_parallel === '' ? null : Number(edit.max_parallel),
        isActive: edit.is_active,
        note: edit.limit_note,
      });
      setEdit(null); agents.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const reset = async () => {
    setError(null); setBusy(true);
    try {
      await resetAgentLimit(edit.code);
      setEdit(null); agents.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Реестры агентов</h1>
      <ErrorNote error={agents.error || jobs.error || error} />

      <Tabs value={tab} onChange={setTab}
            items={[
              { value: 'agents', label: 'Агенты', count: rows.length },
              { value: 'jobs', label: 'Виды заданий', count: (jobs.data || []).length },
            ]} />

      {tab === 'agents' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Агентов" value={rows.length} />
            <Stat label="Выключено" value={off} tone={off ? 'warn' : 'good'} />
            <Stat label="С своими пределами" value={overridden}
                  hint="остальные — как в общем реестре" />
          </div>

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
                { key: 'running', title: 'Сейчас', align: 'right',
                  render: (r) => (
                    <span className={Number(r.running) >= Number(r.max_parallel)
                      ? 'text-amber-400' : ''}>
                      {r.running} / {r.max_parallel}
                    </span>
                  ) },
                { key: 'waiting', title: 'Ждут', align: 'right',
                  render: (r) => num(r.waiting) },
                { key: 'max_parallel', title: 'Предел',
                  render: (r) => (
                    <div>
                      <div className="tabular-nums">{r.max_parallel}</div>
                      {r.overridden && Number(r.max_parallel) !== Number(r.max_parallel_registry) && (
                        <div className="text-xs text-muted-foreground">
                          в реестре {r.max_parallel_registry}
                        </div>
                      )}
                    </div>
                  ) },
                { key: 'is_active', title: 'Состояние',
                  render: (r) => (
                    <div className="space-y-1">
                      {r.is_active
                        ? <Badge tone="approved">включён</Badge>
                        : <Badge tone="cancelled">выключен</Badge>}
                      {r.overridden && (
                        <div className="text-xs text-muted-foreground">задано вами</div>
                      )}
                    </div>
                  ) },
                { key: 'limit_note', title: 'Примечание',
                  render: (r) => r.limit_note || <span className="text-muted-foreground">—</span> },
                { key: 'act', title: '', align: 'right',
                  render: (r) => (
                    <Button variant="ghost" onClick={() => {
                      setError(null);
                      setEdit({
                        code: r.code, title: r.title,
                        max_parallel: r.max_parallel ?? '',
                        max_parallel_registry: r.max_parallel_registry,
                        is_active_registry: r.is_active_registry,
                        is_active: Boolean(r.is_active),
                        limit_note: r.limit_note || '',
                        overridden: Boolean(r.overridden),
                        waiting: r.waiting, running: r.running,
                      });
                    }}>
                      Изменить
                    </Button>
                  ) },
              ]}
              rows={rows}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Выключенный агент не берёт новые задания, но уже взятые доводит до конца:
              обрывать работу на середине хуже, чем дать ей закончиться. Задания
              продолжают ставиться в очередь и ждут включения — они не теряются.
            </p>
          </Panel>
        </>
      )}

      {tab === 'jobs' && (
        <Panel title="Виды заданий"
               action={<span className="text-xs text-muted-foreground">только чтение</span>}>
          {jobs.loading ? <Spinner /> : (
            <>
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
                ]}
                rows={jobs.data || []}
              />
              <div className="mt-4 rounded-lg border border-line px-3 py-2 text-xs text-muted-foreground">
                <p>
                  Сроки и число попыток — свойство самой работы, а не клиента: «аудит
                  доработок держится два часа» верно для любого. Реестр общий для всех
                  клиентов, поэтому правится не из панели, а запросом:
                </p>
                <code className="mt-1.5 block break-all rounded bg-background px-2 py-1 font-mono">
                  update core.job_type set lease_sec = 3600 where code = &apos;dev.audit&apos;;
                </code>
              </div>
            </>
          )}
        </Panel>
      )}

      {edit && (
        <Modal title={edit.title} onClose={() => setEdit(null)}>
          <form onSubmit={submit} className="space-y-4">
            <ErrorNote error={error} />

            <div className="rounded-lg border border-line px-3 py-2 text-xs text-muted-foreground">
              Сейчас в работе {edit.running}, ждут в очереди {edit.waiting}.
              {Number(edit.running) >= Number(edit.max_parallel || 0) && Number(edit.waiting) > 0 && (
                <span className="text-amber-400"> Предел выбран — именно поэтому очередь стоит.</span>
              )}
            </div>

            <Field label="Заданий одновременно"
                   hint={`От 1 до 32. Пусто — как в общем реестре (${edit.max_parallel_registry}).`}>
              <input className={inputClass} type="number" min="1" max="32"
                     value={edit.max_parallel}
                     onChange={(e) => setEdit({ ...edit, max_parallel: e.target.value })} />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_active}
                     onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
              Включён
            </label>

            <Field label="Примечание" hint="Зачем изменено. Через месяц это спасает.">
              <input className={inputClass} value={edit.limit_note}
                     onChange={(e) => setEdit({ ...edit, limit_note: e.target.value })}
                     placeholder="например: ноутбук слабый, больше двух не тянет" />
            </Field>

            <p className="text-xs text-muted-foreground">
              Значение сохраняется как ваше переопределение, поверх общего реестра.
              Общий реестр одинаков для всех клиентов и из панели не правится.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>Сохранить</Button>
              {edit.overridden && (
                <Button type="button" variant="ghost" disabled={busy} onClick={reset}>
                  Вернуть как в реестре
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>Отмена</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
