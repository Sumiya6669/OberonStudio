/**
 * Воронка продаж: сделки ИИ-продажника по этапам.
 *
 * Сделку ведёт продажник (Products for AI Tinker / ИИ-продажник): отвечает
 * лиду на сайте и в Telegram, собирает карточку и подбирает продукты из
 * каталога. Здесь видно, где каждый лид и что дальше; этап можно поправить.
 * КП, скидку, договор и счёт делает человек — продажник их не отправляет.
 *
 * Переписка лидов здесь не показывается: она у продажника, на сервере в РК.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchDeals, updateDeal } from '@/lib/supabase/queries';
import { PRODUCTS } from '@/lib/content/site';
import {
  Badge, Button, ErrorNote, Field, Modal, Spinner, Stat, ago, inputClass, money,
} from '@/components/admin/ui';
import Select from '@/components/core/Select';

const STAGES = [
  ['new', 'Новые'], ['qualified', 'Квалифицированы'], ['demo', 'Демо'], ['proposal', 'КП'],
  ['negotiation', 'Переговоры'], ['won', 'Выиграны'], ['lost', 'Проиграны'],
];
const LOST = {
  price: 'дорого', no_1c: 'нет 1С / не та конфигурация', no_need: 'нет задачи', competitor: 'выбрал другого',
  silence: 'пропал', later: 'не сейчас', other: 'другое',
};
const ONEC = { buh_kz: 'БухКз 3.0', ka: 'КА 2.4', other: 'другая 1С', none: 'без 1С', unknown: '1С ?' };
const ROLE = { accountant: 'бухгалтер', director: 'директор', buhfirm: 'бухфирма', it: 'IT', other: 'другое' };
const CHANNEL = { site: 'сайт', tg: 'Telegram', wa: 'WhatsApp', meta: 'Meta', email: 'почта', manual: 'вручную' };
const productName = (id) => PRODUCTS.find((p) => p.id === id)?.name || id;

export default function Funnel() {
  const deals = useAsync(fetchDeals);
  const [open, setOpen] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (deals.loading) return <Spinner />;
  const rows = (deals.data || []).filter((d) => !(d.opted_out && d.stage === 'lost'));
  const active = rows.filter((d) => !['won', 'lost'].includes(d.stage));
  const week = Date.now() - 7 * 86400 * 1000;
  const fresh = rows.filter((d) => new Date(d.created_at).getTime() >= week);
  const responses = rows.filter((d) => d.first_in && d.first_out)
    .map((d) => (new Date(d.first_out) - new Date(d.first_in)) / 1000)
    .filter((s) => s >= 0);
  const avgResponse = responses.length ? responses.reduce((a, b) => a + b, 0) / responses.length : null;
  const won = rows.filter((d) => d.stage === 'won');

  const save = async (patch) => {
    setError(null); setBusy(true);
    try { await updateDeal(open.id, patch); setOpen(null); deals.reload(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Воронка</h1>
        <span className="text-xs text-muted-foreground">
          Ведёт ИИ-продажник. КП, цены, договор и счёт — только вы.
        </span>
      </div>
      <ErrorNote error={deals.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Лидов за неделю" value={fresh.length} />
        <Stat label="В работе" value={active.length}
              hint={`по каталогу от ${money(active.reduce((s, d) => s + Number(d.amount || 0), 0))}`} />
        <Stat label="Первый ответ" value={avgResponse == null ? '—' : `${Math.round(avgResponse)} с`}
              tone={avgResponse != null && avgResponse > 60 ? 'warn' : 'default'} hint="в среднем" />
        <Stat label="Выиграно" value={won.length} tone={won.length ? 'good' : 'default'} />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="grid min-w-[1100px] grid-cols-7 gap-3">
          {STAGES.map(([code, title]) => {
            const items = rows.filter((d) => d.stage === code).sort((a, b) => b.score - a.score);
            return (
              <div key={code} className="rounded-xl border border-line bg-surface/40 p-2">
                <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide">{title}</span>
                  <span>{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((d) => (
                    <button key={d.id} onClick={() => { setError(null); setOpen(d); }}
                            className="w-full rounded-lg border border-line bg-background/60 p-2 text-left text-xs hover:border-violet/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">{d.name || `#${d.id}`}</span>
                        <Badge>{CHANNEL[d.channel] || d.channel}</Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {[ONEC[d.card?.onec], ROLE[d.card?.role]].filter(Boolean).join(' · ') || 'квалификация'}
                      </div>
                      {d.products?.length > 0 && (
                        <div className="mt-1 truncate text-violet">{d.products.map(productName).join(', ')}</div>
                      )}
                      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground/80">
                        <span>{d.source_label}</span>
                        <span>{ago(d.last_touch || d.updated_at)}</span>
                      </div>
                      {code === 'lost' && d.lost_reason && (
                        <div className="mt-1 text-[11px] text-muted-foreground">{LOST[d.lost_reason]}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open && <DealCard deal={open} busy={busy} error={error} onClose={() => setOpen(null)} onSave={save} />}
    </div>
  );
}

function DealCard({ deal, busy, error, onClose, onSave }) {
  const [stage, setStage] = React.useState(deal.stage);
  const [lost, setLost] = React.useState(deal.lost_reason || 'other');
  const [next, setNext] = React.useState({ step: deal.next_step || '', date: deal.next_date || '' });
  const c = deal.card || {};
  const rows = [
    ['1С', [ONEC[c.onec], c.bases && `баз ${c.bases}`, c.orgs && `организаций ${c.orgs}`].filter(Boolean).join(', ')],
    ['НДС', c.vat === true ? 'плательщик' : c.vat === false ? 'не плательщик' : ''],
    ['Кто пишет', [ROLE[c.role], c.company, c.bin && `БИН ${c.bin}`].filter(Boolean).join(' · ')],
    ['Боль', (c.pains || []).join(', ')],
    ['Срочность', { now: 'горит', month: 'в этом месяце', later: 'присматривается' }[c.urgency]],
    ['Контакт', [c.contact_name, c.phone, c.telegram, c.email].filter(Boolean).join(', ')],
    ['Продукты', (deal.products || []).map(productName).join(', ')],
    ['Оценка по каталогу', deal.amount > 0 ? `от ${money(deal.amount)}` : ''],
    ['Источник', Object.entries(deal.source || {}).map(([k, v]) => `${k}: ${v}`).join(', ')],
  ].filter(([, v]) => v);
  return (
    <Modal title={`${deal.name || `Сделка #${deal.id}`} · ${CHANNEL[deal.channel] || deal.channel}`} onClose={onClose}>
      <div className="space-y-4">
        <ErrorNote error={error} />
        <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (<React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></React.Fragment>))}
        </dl>
        <p className="text-xs text-muted-foreground">
          Очередь {deal.score}/100 — только порядок ответа, на цену не влияет. Переписка — у продажника в Telegram (/deal {deal.id}).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Этап">
            <Select className={inputClass} value={stage} onChange={(e) => setStage(e.target.value)}
                    disabled={deal.opted_out}>
              {STAGES.map(([code, title]) => <option key={code} value={code}>{title}</option>)}
            </Select>
          </Field>
          {stage === 'lost' && (
            <Field label="Причина">
              <Select className={inputClass} value={lost} onChange={(e) => setLost(e.target.value)}>
                {Object.entries(LOST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Следующий шаг"><input className={inputClass} value={next.step}
                 onChange={(e) => setNext({ ...next, step: e.target.value })} /></Field>
          <Field label="Когда"><input className={inputClass} value={next.date}
                 onChange={(e) => setNext({ ...next, date: e.target.value })} placeholder="05.10 15:00" /></Field>
        </div>
        {deal.opted_out && <p className="text-xs text-amber-400">Лид попросил не писать — сделка закрыта.</p>}
        <div className="flex gap-2">
          <Button disabled={busy || deal.opted_out}
                  onClick={() => onSave({ stage, lost_reason: stage === 'lost' ? lost : null,
                                          next_step: next.step, next_date: next.date })}>Записать</Button>
          <Button variant="ghost" onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </Modal>
  );
}
