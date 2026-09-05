/**
 * Карточка заявки. Здесь же ставятся задания агентам разработки: кнопка кладёт
 * задание в очередь, а раннер на вашей машине разберёт его, когда поднимется.
 * Обещание на приём заявки — минута; обещания на ответ агента нет, и это честно.
 */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchTicket, fetchTicketMessages, addTicketMessage, updateTicket,
  fetchEstimates, decideEstimate, addTimeEntry, fetchConfigs, enqueueJob,
} from '@/lib/supabase/queries';
import {
  Badge, Button, Empty, ErrorNote, Field, Panel, Spinner, dateTime, hours, inputClass, money,
} from '@/components/admin/ui';

const STATUSES = ['new', 'triaged', 'estimated', 'approved', 'in_work', 'done', 'cancelled'];
const KINDS = ['bug', 'feature', 'consult', 'update', 'integration', 'other'];

const DEV_ACTIONS = [
  { jobType: 'dev.impact',          label: 'Влияние правки' },
  { jobType: 'dev.diagnose',        label: 'Разобрать ошибку' },
  { jobType: 'dev.estimate_assist', label: 'Справка к оценке' },
];

export default function TicketDetail() {
  const { id } = useParams();
  const { person } = useAuth();
  const ticket = useAsync(() => fetchTicket(id), [id]);
  const messages = useAsync(() => fetchTicketMessages(id), [id]);
  const estimates = useAsync(() => fetchEstimates(id), [id]);
  const configs = useAsync(fetchConfigs);

  const [reply, setReply] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (ticket.loading) return <Spinner />;
  if (ticket.error) return <ErrorNote error={ticket.error} />;

  const t = ticket.data;
  const configForCompany = (configs.data || []).filter((c) => c.company_id === t.company_id);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try { await fn(); } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const startDevJob = (jobType) => run(async () => {
    const snapshot = configForCompany[0];
    await enqueueJob({
      tenantId: person.tenant_id,
      jobType,
      agentKind: 'dev_1c',
      priority: 4,
      payload: { ticket_id: Number(id), snapshot_id: snapshot?.id ?? null },
      // Двойное нажатие кнопки не создаст второго задания: это индекс в базе.
      dedupeKey: `${jobType}:ticket:${id}`,
    });
  });

  return (
    <div className="space-y-4">
      <Link to="/admin/tickets" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> к списку
      </Link>

      <ErrorNote error={error} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title={`№${t.id} · ${t.subject}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge tone={t.status}>{t.status}</Badge>
              {t.kind && <Badge>{t.kind}</Badge>}
              {t.system && <span>{t.system}</span>}
              <span>· канал: {t.channel}</span>
              <span>· пришла {dateTime(t.received_at || t.created_at)}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Статус">
                <select className={inputClass} value={t.status}
                        onChange={(e) => run(async () => {
                          await updateTicket(id, { status: e.target.value }); ticket.reload();
                        })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Тип">
                <select className={inputClass} value={t.kind || ''}
                        onChange={(e) => run(async () => {
                          await updateTicket(id, { kind: e.target.value || null }); ticket.reload();
                        })}>
                  <option value="">не задан</option>
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Переписка">
            {messages.loading ? <Spinner /> : (
              <ul className="space-y-3">
                {(messages.data || []).map((m) => (
                  <li key={m.id} className="rounded-lg border border-line px-3 py-2">
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge>{m.author}</Badge> {dateTime(m.at)}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-2">
              <textarea rows={3} className={inputClass} placeholder="Заметка или ответ клиенту"
                        value={reply} onChange={(e) => setReply(e.target.value)} />
              <Button disabled={busy || !reply.trim()}
                      onClick={() => run(async () => {
                        await addTicketMessage(id, reply.trim());
                        setReply(''); messages.reload();
                      })}>
                Добавить
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Оценка">
            {estimates.loading ? <Spinner /> : !estimates.data?.length ? (
              <Empty>Оценки нет. Поставьте задание Оценщику или впишите вручную.</Empty>
            ) : (
              <ul className="space-y-3">
                {estimates.data.map((e) => (
                  <li key={e.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium tabular-nums">
                        {e.hours_min}–{e.hours_max} ч · {money(e.price)}
                      </span>
                      <Badge tone={e.status}>{e.status}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{e.rationale}</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      уверенность {Math.round(e.confidence * 100)}%
                    </div>
                    {e.status === 'draft' && (
                      <div className="mt-3 flex gap-2">
                        <Button disabled={busy}
                          onClick={() => run(async () => {
                            await decideEstimate(e.id, 'accepted', person.id);
                            await updateTicket(id, { status: 'estimated' });
                            estimates.reload(); ticket.reload();
                          })}>Принять</Button>
                        <Button variant="ghost" disabled={busy}
                          onClick={() => run(async () => {
                            await decideEstimate(e.id, 'rejected', person.id);
                            estimates.reload();
                          })}>Отклонить</Button>
                      </div>
                    )}
                    {e.hours_fact != null && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        факт: {e.hours_fact} ч
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Агенты разработки">
            {!configForCompany.length ? (
              <Empty>
                У клиента нет проиндексированной конфигурации.
                Агент честно скажет «нет индекса», а не заполнит догадками.
              </Empty>
            ) : (
              <p className="mb-3 text-xs text-muted-foreground">
                Индекс: {configForCompany[0].title}
                {configForCompany[0].stale && <span className="ml-1 text-amber-400">· устарел</span>}
              </p>
            )}
            <div className="space-y-2">
              {DEV_ACTIONS.map((a) => (
                <Button key={a.jobType} variant="ghost" className="w-full justify-start"
                        disabled={busy || !person?.tenant_id}
                        onClick={() => startDevJob(a.jobType)}>
                  <Play className="h-3.5 w-3.5" /> {a.label}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Задание встанет в очередь. Раннер разберёт его, когда вы поднимете машину,
              и пришлёт сводку в Telegram.
            </p>
          </Panel>

          <Panel title="Время">
            <div className="mb-2 text-sm">
              Потрачено: <span className="tabular-nums">{hours((t.hours_spent || 0) * 60)}</span>
            </div>
            <div className="space-y-2">
              <Field label="Минут">
                <input type="number" min="1" max="720" className={inputClass}
                       value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </Field>
              <Field label="Что делали">
                <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button disabled={busy || !minutes || !person?.id}
                      onClick={() => run(async () => {
                        await addTimeEntry({
                          ticket_id: Number(id), person_id: person.id,
                          minutes: Number(minutes), note: note || null,
                          tenant_id: person.tenant_id,
                        });
                        setMinutes(''); setNote(''); ticket.reload();
                      })}>
                Записать
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
