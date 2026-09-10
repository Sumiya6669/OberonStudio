/**
 * Состояние системы.
 *
 * Каждая цифра здесь отвечает на вопрос, который иначе задают постфактум:
 * «почему это не работало три дня». Разделы журнала на месяцы вперёд, таблицы
 * без разграничения доступа, брошенные аренды, молчащий раннер — всё это
 * ломается тихо, и заметить это можно только глядя специально.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { usePoll } from '@/lib/admin/usePoll';
import { useAsync } from '@/lib/admin/useAsync';
import { fetchHealth, fetchDbHygiene } from '@/lib/supabase/queries';
import {
  Button, ErrorNote, Freshness, Panel, Spinner, Stat, cx, dateTime, num,
} from '@/components/admin/ui';

/** Правила «что считать плохим» живут здесь, а не размазаны по разметке. */
const CHECKS = [
  {
    key: 'tables_without_rls',
    title: 'Таблицы без разграничения доступа',
    good: (v) => Number(v) === 0,
    ok: 'ни одной: каждая таблица с клиентом закрыта политикой',
    bad: (v) => `${v} — это значит, что данные одного клиента видны другому`,
  },
  {
    key: 'log_partitions_ahead',
    title: 'Разделы журнала вперёд',
    good: (v) => Number(v) >= 3,
    ok: (v) => `${v} мес.: запись в журнал не упрётся в отсутствие раздела`,
    bad: (v) => `${v} мес. — когда разделы кончатся, журнал начнёт отказывать, и это заметят последним`,
    fix: 'select core.action_log_ensure_partitions(12);',
  },
  {
    key: 'usage_partitions_ahead',
    title: 'Разделы учёта расхода вперёд',
    good: (v) => Number(v) >= 3,
    ok: (v) => `${v} мес.`,
    bad: (v) => `${v} мес. — расход перестанет записываться`,
    fix: 'select core.usage_ensure_partitions(12);',
  },
  {
    key: 'leases_expired',
    title: 'Брошенные аренды заданий',
    good: (v) => Number(v) === 0,
    ok: 'нет',
    bad: (v) => `${v}: задания висят в состоянии «идёт» без исполнителя. Их возвращает «Сторож» раз в 10 минут — если он включён`,
  },
  {
    key: 'approvals_overdue',
    title: 'Просроченные подтверждения',
    good: (v) => Number(v) === 0,
    ok: 'нет',
    bad: (v) => `${v}: срок истёк, но подтверждение не закрыто. Закрывает «Сторож»`,
  },
];

/**
 * Гигиена базы. Это не «что сейчас происходит», а «нет ли структурных дыр»:
 * такие вещи не мигают и не растут, они просто однажды оказываются открыты.
 * hash_ok проверяет pgcrypto ВЫЗОВОМ — из-за того, что расширение стоит в
 * другой схеме, приём заявок и журнал молча не работали (миграция 027).
 */
const HYGIENE = [
  {
    key: 'hash_ok',
    title: 'Криптофункции доступны',
    good: (v) => v === true,
    ok: 'да: отпечатки считаются, значит форма и журнал работают',
    bad: 'нет — приём заявок и журнал действий будут падать молча',
  },
  {
    key: 'partitions_open',
    title: 'Открытые разделы журнала',
    good: (v) => Number(v) === 0,
    ok: 'нет: каждый раздел закрыт политикой',
    bad: (v) => `${v} — журнал одного клиента читается другим напрямую через раздел`,
    fix: "select core.partition_seal('core', 'action_log_2026m09');",
  },
  {
    key: 'rls_without_policy',
    title: 'Закрытые таблицы без политики',
    good: (v) => Number(v) === 0,
    ok: 'нет',
    bad: (v) => `${v}: доступ закрыт для всех, включая вас — запросы вернут пусто`,
  },
  {
    key: 'functions_unpinned',
    title: 'Функции без закреплённого search_path',
    good: (v) => Number(v) === 0,
    ok: 'нет',
    bad: (v) => `${v}: у функции можно подменить, откуда она берёт объекты`,
  },
  {
    key: 'views_as_owner',
    title: 'Витрины от имени владельца',
    good: (v) => Number(v) === 0,
    ok: 'нет: все витрины отдают строки по правам вошедшего',
    bad: (v) => `${v}: витрина обходит разграничение доступа`,
  },
];

export default function SysHealth() {
  const health = usePoll(fetchHealth, { interval: 15000 });
  const hyg = useAsync(fetchDbHygiene);

  if (health.loading && !health.data) return <Spinner />;
  const h = health.data || {};

  const runnerAge = h.runner_last_seen
    ? (Date.now() - new Date(h.runner_last_seen).getTime()) / 1000
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Состояние системы</h1>
          <div className="mt-1"><Freshness at={health.at} stale={health.stale} error={health.error} /></div>
        </div>
        <Button variant="ghost" onClick={health.reload}>Проверить сейчас</Button>
      </div>
      <ErrorNote error={health.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Политик доступа" value={num(h.policies_total)} />
        <Stat label="Записей в журнале за месяц" value={num(h.log_rows_month)} />
        <Stat label="Отказов за неделю" value={num(h.refusals_week)}
              hint="отказ — штатное поведение" />
        <Stat label="Ошибок за неделю" value={num(h.errors_week)}
              tone={Number(h.errors_week) > 0 ? 'warn' : 'good'} />
      </div>

      <Panel title="Проверки">
        <ul className="space-y-2">
          {CHECKS.map((c) => {
            const value = h[c.key];
            const ok = c.good(value);
            const text = ok
              ? (typeof c.ok === 'function' ? c.ok(value) : c.ok)
              : (typeof c.bad === 'function' ? c.bad(value) : c.bad);
            return (
              <li key={c.key}
                  className={cx('flex items-start gap-3 rounded-lg border px-3 py-2.5',
                    ok ? 'border-line' : 'border-amber-500/40 bg-amber-500/5')}>
                {ok
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{text}</div>
                  {!ok && c.fix && (
                    <div className="mt-1.5">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Как исправить — выполнить в SQL-редакторе Supabase
                      </div>
                      <code className="mt-0.5 block break-all rounded bg-background px-2 py-1 font-mono text-xs">
                        {c.fix}
                      </code>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Гигиена базы"
             action={<span className="text-xs text-muted-foreground">
               структура, а не загрузка
             </span>}>
        {hyg.loading ? <Spinner /> : (
          <ul className="space-y-2">
            {HYGIENE.map((c) => {
              const value = hyg.data?.[c.key];
              const ok = c.good(value);
              const text = ok
                ? (typeof c.ok === 'function' ? c.ok(value) : c.ok)
                : (typeof c.bad === 'function' ? c.bad(value) : c.bad);
              return (
                <li key={c.key}
                    className={cx('flex items-start gap-3 rounded-lg border px-3 py-2.5',
                      ok ? 'border-line' : 'border-red-500/40 bg-red-500/5')}>
                  {ok
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{text}</div>
                    {!ok && c.fix && (
                      <code className="mt-1 block break-all rounded bg-background px-2 py-1 font-mono text-xs">
                        {c.fix}
                      </code>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Раннер на вашем ПК">
          {runnerAge === null ? (
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-sm">Ни одного шага в журнале</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Раннер ещё ничего не делал. Пока в журнале нет ни одной записи
                  от исполнителя вида <code className="font-mono">pc:*</code>,
                  считать его работающим нельзя — даже если процесс запущен.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              {runnerAge < 900
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
              <div>
                <div className="text-sm">
                  {runnerAge < 900 ? 'На связи' : 'Молчит'}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Последний шаг: {dateTime(h.runner_last_seen)}.
                  {runnerAge >= 900 && ' Если ПК выключен, это нормально: задания просто ждут в очереди.'}
                </p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Незакрытое">
          <ul className="space-y-1.5 text-sm">
            <Row label="Открытых эскалаций" value={h.escalations_open}
                 to="/admin/ai" warn={Number(h.escalations_open) > 0} />
            <Row label="Подтверждений ждут" value={h.approvals_pending}
                 to="/admin/ai" warn={Number(h.approvals_pending) > 0} />
            <Row label="Мёртвых заданий за неделю" value={h.jobs_dead_week}
                 to="/admin/ai/queue" warn={Number(h.jobs_dead_week) > 0} />
            <Row label="Самое старое задание в очереди, мин" value={h.oldest_wait_min ?? 0}
                 to="/admin/ai/queue" warn={Number(h.oldest_wait_min) > 120} />
            <Row label="Черновиков учёта" value={h.acc_drafts}
                 to="/admin/money/entries" warn={Number(h.acc_drafts) > 0} />
            <Row label="Черновиков страниц сайта" value={h.cms_page_drafts} to="/admin/site" />
            <Row label="Черновиков в справочниках" value={h.cms_item_drafts} to="/admin/site/content" />
            <Row label="Устаревших индексов 1С" value={h.configs_stale}
                 to="/admin/configs" warn={Number(h.configs_stale) > 0} />
            <Row label="Конфигураций без индекса" value={h.configs_unindexed}
                 to="/admin/configs" warn={Number(h.configs_unindexed) > 0} />
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, to, warn }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <Link to={to} className="text-muted-foreground hover:text-blue">{label}</Link>
      <span className={cx('tabular-nums font-medium', warn ? 'text-amber-400' : 'text-foreground')}>
        {num(value)}
      </span>
    </li>
  );
}
