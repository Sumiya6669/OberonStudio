/**
 * Маркетинг → Откуда заявки.
 *
 * Счёт заявок за период по всему, что о источнике действительно лежит в
 * crm.ticket: канал, форма, страница входа, домен перехода, метки UTM и
 * метки клика рекламы (fbclid/yclid, с миграции 055).
 *
 * Деньги и конверсию по источникам считает экран «Источники заявок» —
 * здесь только поток заявок, зато за любой период, а не помесячно.
 */
import React from 'react';
import { useAsync } from '@/lib/admin/useAsync';
import { MARKETING_LEADS_LIMIT, fetchLeadOrigins } from '@/lib/supabase/queries';
import {
  DIRECT, NO_FORM, NO_PAGE, NO_TAG, PERIODS, periodRange, summarizeLeads, toDateInput,
} from '@/lib/admin/marketing';
import {
  Button, Empty, ErrorNote, Field, Panel, Spinner, Stat, Tabs, cx, dateOnly, inputClass, num,
} from '@/components/admin/ui';

const MUTED = new Set([NO_FORM, NO_PAGE, DIRECT, NO_TAG]);
const SHOW = 12;

/** Полоса доли: длина — доля от всех заявок периода. */
function ShareBar({ share, muted }) {
  return (
    <div className="h-1.5 w-full min-w-[60px] overflow-hidden rounded-full bg-white/10">
      <div className={cx('h-full rounded-full', muted ? 'bg-white/25' : 'bg-violet')}
           style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
    </div>
  );
}

/** Таблица «значение — число — доля». Длинный хвост сворачивается. */
function ShareTable({ title, rows, hint, nameTitle = 'Значение' }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <Panel title={title}
      action={rows.length > SHOW && (
        <button onClick={() => setAll(!all)} className="text-xs text-muted-foreground hover:text-foreground">
          {all ? 'свернуть' : `все ${rows.length}`}
        </button>
      )}>
      {hint && <p className="-mt-1 mb-3 text-xs text-muted-foreground">{hint}</p>}
      {rows.length === 0 ? <Empty>Нет данных.</Empty> : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">{nameTitle}</th>
                <th className="w-16 pb-2 pr-3 text-right font-medium">Заявок</th>
                <th className="w-20 pb-2 pr-3 text-right font-medium">Доля</th>
                <th className="w-[28%] pb-2 font-medium"><span className="sr-only">Полоса доли</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const muted = MUTED.has(row.name);
                return (
                  <tr key={row.name} className="border-t border-line/60">
                    <td className={cx('max-w-[260px] break-words py-2 pr-3 align-top',
                      muted && 'text-muted-foreground')}>{row.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num(row.count)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{num(row.share, 1)} %</td>
                    <td className="py-2 align-middle"><ShareBar share={row.share} muted={muted} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** Плашка «этого в базе нет». */
function Notice({ title, children }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="font-medium text-amber-300">{title}</div>
      {children && <div className="mt-1 text-xs leading-relaxed text-amber-100/80">{children}</div>}
    </div>
  );
}

const defaultCustom = () => {
  const to = new Date();
  const from = new Date(); from.setDate(to.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
};

export default function LeadOrigins() {
  const [period, setPeriod] = React.useState('30');
  const [draft, setDraft] = React.useState(defaultCustom);
  const [custom, setCustom] = React.useState(defaultCustom);

  const range = React.useMemo(() => periodRange(period, custom), [period, custom]);
  const key = range.error ? `error:${range.error}` : `${range.from.getTime()}:${range.to.getTime()}`;
  const list = useAsync(
    () => (range.error ? Promise.resolve([]) : fetchLeadOrigins(range)),
    [key],
  );

  const rows = list.data || [];
  const s = React.useMemo(() => summarizeLeads(rows), [rows]);
  const truncated = rows.length >= MARKETING_LEADS_LIMIT;
  const lastDay = range.to ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1) : null;
  const hasTerm = s.utm.utm_term.some((r) => r.name !== NO_TAG);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Tabs items={PERIODS} value={period} onChange={setPeriod} />
        {period === 'custom' && (
          <form className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => { e.preventDefault(); setCustom({ ...draft }); }}>
            <Field label="с">
              <input className={inputClass} type="date" required value={draft.from}
                     onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            </Field>
            <Field label="по">
              <input className={inputClass} type="date" required value={draft.to}
                     onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </Field>
            <Button type="submit" variant="ghost">Показать</Button>
          </form>
        )}
        {!range.error && (
          <span className="ml-auto text-xs text-muted-foreground">
            {dateOnly(range.from)} — {dateOnly(lastDay)} · по дате создания заявки
          </span>
        )}
      </div>

      <ErrorNote error={range.error || list.error} />
      {truncated && (
        <Notice title={`Показаны последние ${num(MARKETING_LEADS_LIMIT)} заявок периода`}>
          Сузьте период, чтобы посчитать все.
        </Notice>
      )}

      {list.loading ? <Spinner /> : range.error ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Заявок за период" value={num(s.total)} />
            <Stat label="С сайта" value={num(s.site)}
                  hint={s.total ? `${num((100 * s.site) / s.total, 0)} % всех` : null} />
            <Stat label="С метками UTM" value={num(s.withUtm)}
                  tone={s.total && !s.withUtm ? 'warn' : 'default'}
                  hint={s.total ? `${num((100 * s.withUtm) / s.total, 0)} % всех` : null} />
            <Stat label="С переходом с сайта" value={num(s.withRef)}
                  hint="браузер сообщил, откуда пришли" />
          </div>

          {s.total === 0 ? (
            <Empty>За этот период заявок нет.</Empty>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <ShareTable title="По каналу" nameTitle="Канал" rows={s.byChannel}
                  hint="Сайт, Telegram-бот, почта, телефон или заведена вручную." />
                <ShareTable title="По форме" nameTitle="Форма" rows={s.byForm}
                  hint="Форма, через которую отправили заявку. У заявок из бота и почты формы нет." />
                <ShareTable title="По странице входа" nameTitle="Страница" rows={s.byLanding}
                  hint="Первая страница визита, а не та, где отправили форму: важно, что привело." />
                <ShareTable title="По домену перехода" nameTitle="Домен" rows={s.byReferrer}
                  hint="Откуда пришёл посетитель. Переходы внутри сайта не считаются; многие приложения домен не сообщают." />
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-semibold tracking-tight">Метки кампании</h2>
                {s.withUtm === 0 && (
                  <p className="text-sm text-muted-foreground">
                    За период ни одной заявки с метками UTM. Метки в базе сохраняются — просто ссылок
                    с ними ещё не было. Соберите их на вкладке «Ссылки с метками».
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Клики из рекламы за период: Meta (fbclid) — {s.fromMeta}, Яндекс (yclid) — {s.fromYandex}.
                  Метка клика ставится сама, когда человек приходит из рекламного кабинета.
                </p>
                <div className="grid gap-4 xl:grid-cols-2">
                  <ShareTable title="utm_source" nameTitle="Источник" rows={s.utm.utm_source} />
                  <ShareTable title="utm_medium" nameTitle="Тип канала" rows={s.utm.utm_medium} />
                  <ShareTable title="utm_campaign" nameTitle="Кампания" rows={s.utm.utm_campaign} />
                  <ShareTable title="utm_content" nameTitle="Вариант" rows={s.utm.utm_content} />
                  {hasTerm && <ShareTable title="utm_term" nameTitle="Ключ" rows={s.utm.utm_term} />}
                </div>
              </div>
            </>
          )}

          <Panel title="Что не сохраняется в базе">
            <ul className="space-y-3 text-sm">
              <li>
                <span className="font-medium">Страница, где отправили форму.</span>{' '}
                <span className="text-muted-foreground">
                  Пишется только текстом в первое сообщение заявки («Страница: …»). Если понадобится в
                  отчёте — добавим колонку crm.ticket.form_page.
                </span>
              </li>
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
