/**
 * Маркетинг → Посещения.
 *
 * Свой учёт посещений сайта (миграция 067, src/lib/site/siteVisits.js) —
 * не зависит ни от Яндекс Метрики, ни от согласия на cookie. В базе только
 * счётчики «день, страница, источник → число»: ни IP, ни браузера, ни номера
 * посетителя. Поэтому здесь нет «уникальных посетителей» — есть входы
 * (первая страница вкладки) и просмотры (страница, раз за сессию вкладки).
 *
 * Слов поиска нет и не будет: их знают только поисковики (Вебмастер,
 * Search Console). Здесь — на какие страницы входят из поиска.
 */
import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar as RBar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchSiteVisits } from '@/lib/supabase/queries';
import { SEARCH_SOURCES, SOURCE_LABELS } from '@/lib/site/visitSource';
import { Empty, ErrorNote, Panel, Spinner, Stat, Tabs, cx, num } from '@/components/admin/ui';

const PERIODS = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
];

// Функции ещё нет в базе (миграция 067 не применена) — это «не включено», а не сбой.
const MISSING = /could not find the function|schema cache|does not exist|PGRST202/i;
const SHOW = 12;

function NotYet() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface/40 p-6 text-center">
      <BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Учёт посещений ещё не включён</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Нужно применить миграцию supabase/migrations/067_site_visits.sql в SQL Editor —
        после этого сайт начнёт считать посещения, а сводка появится здесь.
      </p>
    </div>
  );
}

/** 'YYYY-MM-DD' → Date в полдень (без сдвигов по поясу). */
const parseDay = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
};
const isoDay = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const shortDay = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Все дни периода, включая пустые: на графике провал должен быть виден как ноль. */
function fillDays(report) {
  const from = parseDay(report?.from);
  const to = parseDay(report?.to);
  if (!from || !to) return [];
  const byDay = new Map((report.days || []).map((d) => [String(d.day).slice(0, 10), d]));
  const out = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const key = isoDay(d);
    const row = byDay.get(key);
    out.push({ day: key, label: shortDay(d), entries: Number(row?.entries) || 0, views: Number(row?.views) || 0 });
  }
  return out;
}

function ShareBar({ share, muted }) {
  return (
    <div className="h-1.5 w-full min-w-[60px] overflow-hidden rounded-full bg-white/10">
      <div className={cx('h-full rounded-full', muted ? 'bg-white/25' : 'bg-violet')}
           style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
    </div>
  );
}

/** Таблица «название — входов — доля — полоса». Длинный хвост сворачивается. */
function ShareTable({ title, hint, rows, nameTitle, countTitle = 'Входов' }) {
  const [all, setAll] = React.useState(false);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <Panel title={title}
      action={rows.length > SHOW && (
        <button type="button" onClick={() => setAll(!all)} className="text-xs text-muted-foreground hover:text-foreground">
          {all ? 'свернуть' : `все ${rows.length}`}
        </button>
      )}>
      {hint && <p className="-mt-1 mb-3 text-xs text-muted-foreground">{hint}</p>}
      {rows.length === 0 ? <Empty>Нет данных за период.</Empty> : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">{nameTitle}</th>
                <th className="w-16 pb-2 pr-3 text-right font-medium">{countTitle}</th>
                <th className="w-20 pb-2 pr-3 text-right font-medium">Доля</th>
                <th className="w-[28%] pb-2 font-medium"><span className="sr-only">Полоса доли</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const share = total ? (100 * row.count) / total : 0;
                return (
                  <tr key={row.key} className="border-t border-line/60">
                    <td className={cx('max-w-[260px] break-words py-2 pr-3 align-top', row.muted && 'text-muted-foreground')}>
                      {row.name}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num(row.count)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{num(share, 1)} %</td>
                    <td className="py-2 align-middle"><ShareBar share={share} muted={row.muted} /></td>
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

const PageLink = ({ path }) => (
  <a href={path} target="_blank" rel="noopener noreferrer" className="break-all hover:underline">{path}</a>
);

/** Таблица страниц: путь и числа. */
function PathTable({ title, hint, rows, cols, empty }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <Panel title={title}
      action={rows.length > SHOW && (
        <button type="button" onClick={() => setAll(!all)} className="text-xs text-muted-foreground hover:text-foreground">
          {all ? 'свернуть' : `все ${rows.length}`}
        </button>
      )}>
      {hint && <p className="-mt-1 mb-3 text-xs text-muted-foreground">{hint}</p>}
      {rows.length === 0 ? <Empty>{empty}</Empty> : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">Страница</th>
                {cols.map((c) => <th key={c.key} className="w-20 pb-2 pr-3 text-right font-medium">{c.title}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.path} className="border-t border-line/60">
                  <td className="max-w-[320px] py-2 pr-3 align-top"><PageLink path={row.path} /></td>
                  {cols.map((c) => (
                    <td key={c.key} className={cx('py-2 pr-3 text-right tabular-nums', c.muted && 'text-muted-foreground')}>
                      {num(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const TOOLTIP_STYLE = {
  background: 'rgba(12,14,20,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 12,
};
const SERIES = { entries: 'посещения (входы)', views: 'просмотры страниц' };

function DaysPanel({ days }) {
  const [asTable, setAsTable] = React.useState(false);
  const any = days.some((d) => d.entries || d.views);
  return (
    <Panel title="По дням (время Астаны)"
      action={any && (
        <button type="button" onClick={() => setAsTable(!asTable)} className="text-xs text-muted-foreground hover:text-foreground">
          {asTable ? 'график' : 'таблица'}
        </button>
      )}>
      {!any ? <Empty>За период посещений не записано.</Empty> : asTable ? (
        <div className="-mx-4 max-h-80 overflow-auto px-4">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">День</th>
                <th className="pb-2 pr-3 text-right font-medium">Посещения</th>
                <th className="pb-2 text-right font-medium">Просмотры</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line/60">
                  <td className="py-1.5 pr-3 tabular-nums">{d.label}.{d.day.slice(0, 4)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{num(d.entries)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{num(d.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor"
                     strokeOpacity={0.3} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} width={40} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                       formatter={(value, key) => [num(value), SERIES[key] || key]} />
              <Legend formatter={(key) => SERIES[key] || key} wrapperStyle={{ fontSize: 12 }} />
              <RBar dataKey="entries" fill="#7C5CFF" radius={[3, 3, 0, 0]} />
              <RBar dataKey="views" fill="rgba(255,255,255,0.28)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export default function SiteVisits() {
  const [period, setPeriod] = React.useState('30');
  const report = useAsync(() => fetchSiteVisits(Number(period)), [period]);
  const r = report.data;

  const view = React.useMemo(() => {
    if (!r) return null;
    const entries = Number(r.totals?.entries) || 0;
    const views = Number(r.totals?.views) || 0;
    const days = fillDays(r);
    const sources = (r.sources || []).map((s) => ({
      key: s.source,
      name: SOURCE_LABELS[s.source] || s.source,
      count: Number(s.entries) || 0,
      muted: s.source === 'direct',
    }));
    const fromSearch = sources.filter((s) => SEARCH_SOURCES.includes(s.key)).reduce((a, s) => a + s.count, 0);
    const domains = (r.domains || []).map((d) => ({
      key: d.detail || '—',
      name: d.detail || '(адрес не показан: IP, приложение или нестандартный адрес)',
      count: Number(d.entries) || 0,
      muted: !d.detail,
    }));
    const utm = (r.utm || []).map((d) => ({
      key: d.detail || '—',
      name: d.detail === 'yclid' ? 'yclid — клик рекламы Яндекс Директа без utm'
        : d.detail === 'gclid' ? 'gclid — клик рекламы Google Ads без utm'
          : d.detail || '(метка нестандартная: кириллица, пробелы, слишком длинная)',
      count: Number(d.entries) || 0,
      muted: !d.detail,
    }));
    const pages = (r.pages || []).map((p) => ({ path: p.path, views: Number(p.views) || 0, entries: Number(p.entries) || 0 }));
    const search = (r.search || []).map((p) => ({
      path: p.path,
      google: Number(p.google) || 0,
      yandex: Number(p.yandex) || 0,
      bing: Number(p.bing) || 0,
      total: Number(p.total) || 0,
    }));
    return { entries, views, days, sources, fromSearch, domains, utm, pages, search };
  }, [r]);

  const missing = report.error && MISSING.test(String(report.error.message || report.error));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Tabs items={PERIODS} value={period} onChange={setPeriod} />
        <span className="ml-auto text-xs text-muted-foreground">
          Свой счётчик сайта: без cookie и Метрики, только числа по дням, страницам и источникам
        </span>
      </div>

      {report.loading ? <Spinner /> : missing ? <NotYet /> : report.error ? <ErrorNote error={report.error} /> : view && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Посещений" value={num(view.entries)} hint="входов на сайт за период" />
            <Stat label="Просмотров страниц" value={num(view.views)}
                  hint={view.entries ? `${num(view.views / view.entries, 1)} на посещение` : null} />
            <Stat label="Из поиска" value={num(view.fromSearch)}
                  hint={view.entries ? `${num((100 * view.fromSearch) / view.entries, 0)} % посещений · Google, Яндекс, Bing` : null} />
            <Stat label="В среднем за день" value={num(view.entries / Math.max(1, view.days.length), 1)}
                  hint={`за ${view.days.length} дн.`} />
          </div>

          <DaysPanel days={view.days} />

          <div className="grid gap-5 xl:grid-cols-2">
            <ShareTable title="Откуда пришли" nameTitle="Источник" rows={view.sources}
              hint="По первой странице визита. «Напрямую» — набрали адрес, закладка или приложение не сообщило, откуда переход (так часто делают Telegram и WhatsApp на телефоне — для них лучше ставить ссылки с метками)." />
            <PathTable title="Входы из поиска" rows={view.search}
              hint="На какие страницы попадают из Google, Яндекса и Bing. Слова запросов знают только поисковики — смотрите их в Яндекс Вебмастере и Google Search Console."
              empty="Входов из поиска за период нет."
              cols={[
                { key: 'google', title: 'Google' },
                { key: 'yandex', title: 'Яндекс' },
                { key: 'bing', title: 'Bing' },
                { key: 'total', title: 'Всего', muted: true },
              ]} />
            <ShareTable title="Метки utm_source" nameTitle="utm_source" rows={view.utm}
              hint="Переходы по ссылкам с метками (Маркетинг → Ссылки с метками). Метка важнее домена перехода." />
            <ShareTable title="Другие сайты" nameTitle="Домен" rows={view.domains}
              hint="Только домен, без адреса страницы и параметров." />
          </div>

          <PathTable title="Страницы" rows={view.pages}
            hint="Просмотры — раз за сессию вкладки на страницу (обновление не считается). Входы — сколько визитов началось с этой страницы."
            empty="Просмотров за период нет."
            cols={[
              { key: 'views', title: 'Просмотры' },
              { key: 'entries', title: 'Входы', muted: true },
            ]} />

          <p className="text-xs leading-relaxed text-muted-foreground">
            Не считаются роботы, автоматизированные браузеры, предпросмотры Vercel, локальный запуск и панель /admin.
            Это не уникальные посетители: базе нечем отличить одного человека от другого — так и задумано.
          </p>
        </>
      )}
    </div>
  );
}
