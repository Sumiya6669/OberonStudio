/**
 * Абонементы и обязательства.
 *
 * Экран отвечает на три вопроса в порядке важности:
 *
 *   1. что уже просрочено — потому что это разговор с клиентом сегодня;
 *   2. сколько часов съедено из пакетов — потому что это деньги;
 *   3. держим ли мы обещание в среднем — потому что «ответ в течение часа»
 *      либо факт, либо лозунг, и разница видна только в цифре.
 *
 * Тарифы стоят последними и намеренно: их правят раз в полгода. При этом
 * правка тарифа НЕ меняет проданные абонементы — условия зафиксированы на
 * момент продажи, и это видно прямо в таблице абонементов.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchPlans, savePlan, fetchSubscriptions, fetchSlaBreach, fetchSlaMonth,
  fetchCompanies, sellSubscription, endSubscription, invoiceSubscription,
} from '@/lib/supabase/queries';
import {
  Badge, Button, ErrorNote, Field, Modal, Panel, Spinner, Stat, Table,
  ago, cx, dateOnly, hours, inputClass, money,
} from '@/components/admin/ui';

const today = () => new Date().toISOString().slice(0, 10);

/** Минуты в человеческий срок: обещания читаются часами и днями, не минутами. */
function term(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 60 * 24) {
    const h = minutes / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1)} ч`;
  }
  const d = minutes / 60 / 24;
  return `${Number.isInteger(d) ? d : d.toFixed(1)} дн`;
}

const CLOCK = { calendar: 'круглосуточно', business: 'в рабочее время' };

export default function CrmSubscriptions() {
  const { person } = useAuth();
  const subs = useAsync(fetchSubscriptions);
  const breach = useAsync(fetchSlaBreach);
  const month = useAsync(() => fetchSlaMonth(6));
  const plans = useAsync(fetchPlans);
  const companies = useAsync(fetchCompanies);

  const [sell, setSell] = React.useState(null);
  const [plan, setPlan] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (subs.loading || plans.loading) return <Spinner />;

  const rows = subs.data || [];
  const active = rows.filter((r) => r.status === 'active');
  const mrr = active.reduce((s, r) => s + Number(r.price || 0), 0);
  // Тариф «без абонемента» цены не имеет по смыслу, поэтому в счёт не идёт.
  const plansPriced = (plans.data || [])
    .some((p) => p.code !== 'default' && Number(p.price) > 0);
  const now = (month.data || [])[0];
  const overdue = breach.data || [];

  const act = async (fn) => {
    setError(null); setBusy(true);
    try {
      await fn();
      subs.reload(); breach.reload(); plans.reload();
      setSell(null); setPlan(null);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Абонементы и сроки</h1>
        <Button onClick={() => { setError(null); setSell({ plan: '', company: '', from: today() }); }}>
          Продать абонемент
        </Button>
      </div>

      <ErrorNote error={subs.error || breach.error || plans.error || error} />

      {/* Просрочка — первым и заметно. Это не сводка, это список звонков. */}
      {overdue.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4" />
            Обещание нарушено: {overdue.length}
          </div>
          <Table
            cols={[
              { key: 'subject', title: 'Заявка' },
              { key: 'company', title: 'Клиент', render: (r) => r.company || '—' },
              {
                key: 'what',
                title: 'Что просрочено',
                render: (r) => (
                  <span className="text-red-300">
                    {r.react_overdue ? `реакция на ${term(r.react_late_minutes)}` : ''}
                    {r.react_overdue && r.resolve_overdue ? ', ' : ''}
                    {r.resolve_overdue ? `сдача на ${term(r.resolve_late_minutes)}` : ''}
                  </span>
                ),
              },
              { key: 'created_at', title: 'Пришла', render: (r) => ago(r.created_at) },
            ]}
            rows={overdue}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Действующих абонементов" value={active.length} />
        {/* Ноль бывает по двум разным причинам, и лечатся они по-разному:
            либо тарифы без цены, либо цены есть, а продаж нет. Одна и та же
            подпись на оба случая отправляет чинить не то. */}
        <Stat label="Повторяемый доход в месяц" value={money(mrr)}
              hint={mrr > 0 ? null
                : plansPriced ? 'абонементов пока не продано'
                : 'цены абонементов не заданы'}
              tone={mrr === 0 ? 'warn' : 'default'} />
        <Stat label="Обещаний в срок за месяц"
              value={now?.promised ? `${now.in_time} из ${now.promised}` : '—'}
              hint={now?.late ? `просрочено: ${now.late}` : null}
              tone={now?.late ? 'warn' : 'default'} />
        <Stat label="Среднее время первого ответа"
              value={now?.avg_reply_minutes ? term(now.avg_reply_minutes) : '—'} />
      </div>

      <Panel title="Абонементы">
        <Table
          cols={[
            { key: 'company', title: 'Клиент' },
            { key: 'title', title: 'Что продано' },
            { key: 'price', title: 'В месяц', render: (r) => (Number(r.price) ? money(r.price) : 'не задана') },
            {
              key: 'pack',
              title: 'Пакет часов',
              render: (r) => (r.included_minutes
                ? (
                  <span>
                    {hours(r.used_minutes)} из {hours(r.included_minutes)}
                    {r.over_minutes > 0 && (
                      <span className="ml-2 text-amber-300">+{hours(r.over_minutes)} сверх</span>
                    )}
                  </span>
                )
                : 'без пакета'),
            },
            {
              key: 'promise',
              title: 'Обещание',
              render: (r) => (
                <span className="text-xs text-muted-foreground">
                  реакция {term(r.react_minutes)} · сдача {term(r.resolve_minutes)}
                  <br />{CLOCK[r.clock] || r.clock}
                </span>
              ),
            },
            {
              key: 'status',
              title: 'Состояние',
              render: (r) => (
                <div className="space-y-1">
                  <Badge tone={r.status === 'active' ? 'approved' : undefined}>
                    {r.status === 'active' ? 'действует' : r.status === 'paused' ? 'на паузе' : 'закрыт'}
                  </Badge>
                  {r.has_overdue_invoice && (
                    <div className="text-xs text-red-400">есть просроченный счёт</div>
                  )}
                </div>
              ),
            },
            {
              key: 'act',
              title: '',
              render: (r) => (r.status === 'active' ? (
                <div className="flex gap-2">
                  <Button variant="ghost" disabled={busy}
                          onClick={() => act(() => invoiceSubscription(r.id))}>
                    Счёт за месяц
                  </Button>
                  <Button variant="danger" disabled={busy}
                          onClick={() => act(() => endSubscription(r.id, today()))}>
                    Закрыть
                  </Button>
                </div>
              ) : null),
            },
          ]}
          rows={rows}
          empty="Абонементов пока нет. Это самый предсказуемый доход из всех — стоит начать с одного клиента."
        />
      </Panel>

      <Panel title="Тарифы"
             action={<span className="text-xs text-muted-foreground">
               правка тарифа не меняет проданные абонементы
             </span>}>
        <Table
          cols={[
            { key: 'title', title: 'Название' },
            { key: 'code', title: 'Код', render: (r) => <code className="text-xs">{r.code}</code> },
            {
              key: 'price',
              title: 'Цена',
              render: (r) => (Number(r.price)
                ? money(r.price)
                : <span className="text-amber-300">не задана</span>),
            },
            { key: 'included_minutes', title: 'Включено', render: (r) => (r.included_minutes ? hours(r.included_minutes) : '—') },
            { key: 'overage_rate', title: 'Сверх пакета', render: (r) => (Number(r.overage_rate) ? `${money(r.overage_rate)}/ч` : 'ставка клиента') },
            {
              key: 'promise',
              title: 'Обещание',
              render: (r) => `${term(r.react_minutes)} / ${term(r.resolve_minutes)}`,
            },
            {
              key: 'act',
              title: '',
              render: (r) => (
                <Button variant="ghost" onClick={() => { setError(null); setPlan({ ...r }); }}>
                  Править
                </Button>
              ),
            },
          ]}
          rows={plans.data || []}
        />
      </Panel>

      {sell && (
        <Modal title="Продать абонемент" onClose={() => setSell(null)}>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            act(() => sellSubscription({
              company: sell.company, plan: sell.plan, from: sell.from,
              price: sell.price === '' || sell.price === undefined ? null : Number(sell.price),
              minutes: sell.hours ? Math.round(Number(sell.hours) * 60) : null,
            }));
          }}>
            <Field label="Клиент">
              <select className={inputClass} required value={sell.company}
                      onChange={(e) => setSell({ ...sell, company: e.target.value })}>
                <option value="">— выберите —</option>
                {(companies.data || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Тариф" hint="условия скопируются в абонемент и дальше от прайса не зависят">
              <select className={inputClass} required value={sell.plan}
                      onChange={(e) => {
                        const p = (plans.data || []).find((x) => x.code === e.target.value);
                        setSell({
                          ...sell, plan: e.target.value,
                          price: p && Number(p.price) ? String(p.price) : '',
                          hours: p && p.included_minutes ? String(p.included_minutes / 60) : '',
                        });
                      }}>
                <option value="">— выберите —</option>
                {(plans.data || []).filter((p) => p.code !== 'default' && p.is_active)
                  .map((p) => <option key={p.code} value={p.code}>{p.title}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Цена в месяц, ₸">
                <input className={inputClass} type="number" min="0" step="1000"
                       value={sell.price ?? ''}
                       onChange={(e) => setSell({ ...sell, price: e.target.value })} />
              </Field>
              <Field label="Часов включено">
                <input className={inputClass} type="number" min="0" step="0.5"
                       value={sell.hours ?? ''}
                       onChange={(e) => setSell({ ...sell, hours: e.target.value })} />
              </Field>
            </div>
            <Field label="Действует с">
              <input className={inputClass} type="date" required value={sell.from}
                     onChange={(e) => setSell({ ...sell, from: e.target.value })} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Прежний абонемент этого клиента закроется автоматически: два
              действующих пакета часов у одного клиента — это спор о том,
              из какого списывать.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setSell(null)}>Отмена</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Сохраняю…' : 'Продать'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {plan && (
        <Modal title={`Тариф: ${plan.title}`} onClose={() => setPlan(null)}>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            act(() => savePlan({
              tenant_id: person.tenant_id,
              code: plan.code,
              title: plan.title,
              kind: plan.kind,
              price: Number(plan.price) || 0,
              included_minutes: Math.round(Number(plan.included_hours || 0) * 60),
              overage_rate: Number(plan.overage_rate) || 0,
              react_minutes: Number(plan.react_minutes) || null,
              resolve_minutes: Number(plan.resolve_minutes) || null,
              clock: plan.clock,
              note: plan.note?.trim() || null,
              is_active: plan.is_active,
            }));
          }}>
            <Field label="Название">
              <input className={inputClass} required value={plan.title}
                     onChange={(e) => setPlan({ ...plan, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Цена в месяц, ₸" hint="ноль означает «не задана»">
                <input className={inputClass} type="number" min="0" step="1000"
                       value={plan.price}
                       onChange={(e) => setPlan({ ...plan, price: e.target.value })} />
              </Field>
              <Field label="Часов включено">
                <input className={inputClass} type="number" min="0" step="0.5"
                       value={plan.included_hours ?? (plan.included_minutes || 0) / 60}
                       onChange={(e) => setPlan({ ...plan, included_hours: e.target.value })} />
              </Field>
            </div>
            <Field label="Ставка сверх пакета, ₸/ч" hint="ноль — брать ставку клиента">
              <input className={inputClass} type="number" min="0" step="500"
                     value={plan.overage_rate}
                     onChange={(e) => setPlan({ ...plan, overage_rate: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Реакция, минут">
                <input className={inputClass} type="number" min="1"
                       value={plan.react_minutes ?? ''}
                       onChange={(e) => setPlan({ ...plan, react_minutes: e.target.value })} />
              </Field>
              <Field label="Срок сдачи, минут">
                <input className={inputClass} type="number" min="1"
                       value={plan.resolve_minutes ?? ''}
                       onChange={(e) => setPlan({ ...plan, resolve_minutes: e.target.value })} />
              </Field>
            </div>
            <Field label="Как идёт время"
                   hint="«час» в пятницу в 23:50 означает разное — клиент должен знать, что ему продали">
              <select className={inputClass} value={plan.clock}
                      onChange={(e) => setPlan({ ...plan, clock: e.target.value })}>
                <option value="calendar">круглосуточно</option>
                <option value="business">только в рабочее время</option>
              </select>
            </Field>
            <Field label="Примечание">
              <textarea className={inputClass} rows={2} value={plan.note || ''}
                        onChange={(e) => setPlan({ ...plan, note: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={plan.is_active}
                     onChange={(e) => setPlan({ ...plan, is_active: e.target.checked })} />
              тариф в продаже
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setPlan(null)}>Отмена</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {(month.data || []).length > 1 && (
        <Panel title="Держим ли обещание">
          <Table
            cols={[
              { key: 'month', title: 'Месяц', render: (r) => dateOnly(r.month) },
              { key: 'promised', title: 'Обещано' },
              { key: 'in_time', title: 'В срок' },
              {
                key: 'late',
                title: 'Просрочено',
                render: (r) => (r.late > 0
                  ? <span className="text-red-400">{r.late}</span>
                  : <span className="text-muted-foreground">0</span>),
              },
              {
                key: 'share',
                title: 'Доля в срок',
                render: (r) => (r.promised
                  ? <span className={cx(r.in_time / r.promised >= 0.9 ? 'text-emerald-400' : 'text-amber-300')}>
                      {Math.round((r.in_time / r.promised) * 100)}%
                    </span>
                  : '—'),
              },
              { key: 'avg', title: 'Средний ответ', render: (r) => term(r.avg_reply_minutes) },
            ]}
            rows={month.data}
          />
        </Panel>
      )}
    </div>
  );
}
