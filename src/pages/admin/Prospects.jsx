/**
 * Кандидаты: компании и открытые запросы, которые нашёл ИИ-поиск клиентов
 * (Products for AI Tinker / ИИ-поиск клиентов, таблица crm.prospect, миграция 064).
 *
 * Агент НИЧЕГО не отправляет и не откликается. Здесь — сигнал, ссылка на сам
 * запрос, подходящий продукт и черновик первого сообщения: его копируете и
 * отправляете вы сами. Отклик на заказ с биржи или из канала публикуется на
 * самой площадке — уводить заказчика с площадки её правила запрещают.
 *
 * Людей здесь нет: ФИО, личные телефоны и e-mail агент вырезает до записи, а
 * база не принимает телефон и e-mail в сигнале и черновике. Контакт — только
 * общий контакт компании, опубликованный ею самой.
 *
 * Права решает база: смотреть и менять статус и заметку — владелец и
 * исполнитель, удалить (например, по просьбе компании) — только владелец.
 * Без ответа запись удаляется сама через 6 месяцев (core.purge_expired).
 *
 * «Найти новых» ставит задание prospects.collect; выполняет его раннер на ПК.
 */
import React from 'react';
import { Copy, ExternalLink, Search } from 'lucide-react';
import { useAsync } from '@/lib/admin/useAsync';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  PROSPECT_STATUSES, deleteProspect, enqueueJob, fetchLiveProspectJobs, fetchProspects, updateProspect,
} from '@/lib/supabase/queries';
import { PRODUCTS } from '@/lib/content/site';
import {
  Badge, Button, Empty, ErrorNote, Field, Modal, Spinner, Stat, Toolbar, ago, dateOnly, inputClass,
} from '@/components/admin/ui';
import Select from '@/components/core/Select';

const STATUS = Object.fromEntries(PROSPECT_STATUSES);
const STATUS_TONE = { new: 'new', contacted: 'estimated', replied: 'approved', rejected: 'cancelled', client: 'in_work' };
const SOURCE = { telegram: 'Telegram-канал', manual: 'вручную', partner_search: 'поиск: бухфирмы' };
const KIND = { company: 'компания', request: 'запрос' };
const EXTRA_PRODUCTS = { '1c-dev': 'Доработка 1С (услуга)' };
const productName = (id) => EXTRA_PRODUCTS[id] || PRODUCTS.find((p) => p.id === id)?.name || id;
const LIVE = ['queued', 'leased', 'blocked', 'awaiting', 'failed'];
const JOB_STATUS = { queued: 'в очереди', leased: 'выполняется', blocked: 'ждёт', awaiting: 'ждёт', failed: 'ошибка, будет повтор' };
const isDuplicate = (err) => /job_dedupe_idx|duplicate key/i.test(String(err?.message || err));

export default function Prospects() {
  const { person } = useAuth();
  const list = useAsync(fetchProspects);
  const jobs = useAsync(fetchLiveProspectJobs);
  const [filter, setFilter] = React.useState({ source: '', product: '', status: 'new' });
  const [open, setOpen] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (list.loading) return <Spinner />;
  const rows = list.data || [];
  const live = (jobs.data || []).find((j) => LIVE.includes(j.status));
  const last = (jobs.data || []).find((j) => ['done', 'done_empty'].includes(j.status));

  const sources = [...new Set(rows.map((r) => r.source))];
  const products = [...new Set(rows.flatMap((r) => r.products || []))];
  const shown = rows.filter((r) => (!filter.source || r.source === filter.source)
    && (!filter.product || (r.products || []).includes(filter.product))
    && (!filter.status || r.status === filter.status));
  const count = (s) => rows.filter((r) => r.status === s).length;

  const findNew = async () => {
    setError(null); setBusy(true);
    try {
      await enqueueJob({
        tenantId: person.tenant_id, jobType: 'prospects.collect', agentKind: 'prospects',
        priority: 7, payload: {}, dedupeKey: 'prospects.collect',
      });
    } catch (err) {
      setError(isDuplicate(err) ? new Error('Сбор уже стоит в очереди — второй не нужен. Выполнится, когда запустите раннер на ПК.') : err);
    } finally { setBusy(false); jobs.reload(); }
  };

  const save = async (patch) => {
    setError(null); setBusy(true);
    try { await updateProspect(open.id, patch); setOpen(null); list.reload(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };

  const remove = async () => {
    setError(null); setBusy(true);
    try { await deleteProspect(open.id); setOpen(null); list.reload(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Кандидаты</h1>
        <span className="text-xs text-muted-foreground">
          Агент только находит и готовит черновик. Пишете и откликаетесь — вы.
        </span>
      </div>
      <ErrorNote error={list.error || error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Новых" value={count('new')} />
        <Stat label="Написал" value={count('contacted')} />
        <Stat label="Ответили" value={count('replied')} tone={count('replied') ? 'good' : 'default'} />
        <Stat label="Клиентов" value={count('client')} tone={count('client') ? 'good' : 'default'} />
      </div>

      <Toolbar right={(
        <Button onClick={findNew} disabled={busy || !!live || !person}>
          <Search size={14} /> Найти новых
        </Button>
      )}>
        <Select className={inputClass} value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value })}>
          <option value="">Все источники</option>
          {sources.map((s) => <option key={s} value={s}>{SOURCE[s] || s}</option>)}
        </Select>
        <Select className={inputClass} value={filter.product} onChange={(e) => setFilter({ ...filter, product: e.target.value })}>
          <option value="">Все продукты</option>
          {products.map((p) => <option key={p} value={p}>{productName(p)}</option>)}
        </Select>
        <Select className={inputClass} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">Все статусы</option>
          {PROSPECT_STATUSES.map(([code, title]) => <option key={code} value={code}>{title}</option>)}
        </Select>
      </Toolbar>

      {live && (
        <p className="text-[11px] text-amber-300/80">
          Сбор: {JOB_STATUS[live.status] || live.status} с {dateOnly(live.created_at)}
          {live.status === 'queued' && ' — выполнится, когда запустите раннер на ПК (runner\\run-runner.bat)'}
          {live.status === 'failed' && live.error_text && ` — ${live.error_text.slice(0, 160)}`}
        </p>
      )}
      {!live && last && (
        <p className="text-[11px] text-muted-foreground">
          Последний сбор {ago(last.finished_at || last.created_at)}: новых {last.result?.items_count ?? 0}
        </p>
      )}

      {shown.length === 0 ? (
        <Empty>{rows.length ? 'Под фильтр никто не попал.' : 'Кандидатов пока нет. Нажмите «Найти новых».'}</Empty>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <button key={r.id} onClick={() => { setError(null); setOpen(r); }}
                    className="w-full rounded-xl border border-line bg-surface/60 p-3 text-left text-sm hover:border-violet/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{r.company || 'Открытый запрос'}</span>
                <Badge>{KIND[r.kind] || r.kind}</Badge>
                <Badge>{SOURCE[r.source] || r.source}</Badge>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS[r.status] || r.status}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{r.score}/100 · {dateOnly(r.found_on)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{r.signal}</p>
              <p className="mt-1 truncate text-xs text-violet">{(r.products || []).map(productName).join(', ')}</p>
            </button>
          ))}
        </div>
      )}

      {open && (
        <ProspectCard row={open} busy={busy} error={error} onClose={() => setOpen(null)} onSave={save} onDelete={remove} />
      )}
    </div>
  );
}

function ProspectCard({ row, busy, error, onClose, onSave, onDelete }) {
  const { isOwner } = useAuth();
  const [status, setStatus] = React.useState(row.status);
  const [note, setNote] = React.useState(row.note || '');
  const [copied, setCopied] = React.useState(false);
  const [sure, setSure] = React.useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(row.draft); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setCopied(false); }
  };

  const facts = [
    ['Компания', [row.company, row.bin && `БИН ${row.bin}`].filter(Boolean).join(' · ')],
    ['Отрасль, город', [row.industry, row.city].filter(Boolean).join(', ')],
    ['Контакт компании', row.contact],
    ['Продукты', (row.products || []).map(productName).join(', ')],
    ['Почему', (row.reasons || []).join('; ')],
    ['Источник', `${SOURCE[row.source] || row.source}, ${dateOnly(row.found_on)}`],
  ].filter(([, v]) => v);

  return (
    <Modal wide title={row.company || 'Открытый запрос'} onClose={onClose}>
      <div className="space-y-4">
        <ErrorNote error={error} />
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Сигнал</div>
          <p className="whitespace-pre-line text-sm">{row.signal}</p>
          <a href={row.url} target="_blank" rel="noopener noreferrer nofollow"
             className="mt-1 inline-flex items-center gap-1 text-xs text-violet hover:underline">
            <ExternalLink size={12} /> {row.kind === 'request' ? 'Открыть запрос на площадке' : 'Открыть источник'}
          </a>
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1.5 text-sm">
          {facts.map(([k, v]) => (<React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></React.Fragment>))}
        </dl>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Черновик ({row.draft_by === 'claude' ? 'Claude' : 'шаблон'}) — проверьте и отправьте сами</span>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={copy}>
              <Copy size={12} /> {copied ? 'Скопировано' : 'Скопировать'}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border border-line bg-background/60 p-3 font-sans text-sm">{row.draft}</pre>
          {row.kind === 'request' && (
            <p className="mt-1 text-[11px] text-amber-300/80">
              Это заказ на площадке: отклик публикуйте там же, не уводите заказчика в личку.
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Статус">
            <Select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {PROSPECT_STATUSES.map(([code, title]) => <option key={code} value={code}>{title}</option>)}
            </Select>
          </Field>
          <Field label="Заметка">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Без ответа (новый, написал, не подходит) запись удаляется через 6 месяцев после смены статуса.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => onSave({ status, note: note.trim() })}>Записать</Button>
          <Button variant="ghost" onClick={onClose}>Закрыть</Button>
          {isOwner && (sure
            ? <Button variant="danger" disabled={busy} onClick={onDelete}>Точно удалить</Button>
            : <Button variant="danger" className="ml-auto" onClick={() => setSure(true)}>Удалить по запросу</Button>)}
        </div>
      </div>
    </Modal>
  );
}
