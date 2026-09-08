/**
 * Мелкие части админки. Намеренно без библиотеки компонентов: панель должна
 * пережить обновление зависимостей публичного сайта, а её вид — три класса.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Panel({ title, action, children, className }) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface/60 backdrop-blur', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'default' }) {
  const tones = {
    default: 'text-foreground',
    good: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-red-400',
  };
  return (
    <div className="rounded-xl border border-line bg-surface/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cx('mt-1 text-2xl font-semibold tabular-nums', tones[tone])}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const BADGE_TONES = {
  new: 'bg-blue/15 text-blue border-blue/30',
  triaged: 'bg-blue/10 text-blue border-blue/20',
  estimated: 'bg-gold/15 text-gold border-gold/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  in_work: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  done: 'bg-white/5 text-muted-foreground border-line',
  cancelled: 'bg-white/5 text-muted-foreground border-line',
  queued: 'bg-blue/10 text-blue border-blue/20',
  leased: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  failed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  dead: 'bg-red-500/15 text-red-400 border-red-500/30',
  blocked: 'bg-red-500/10 text-red-300 border-red-500/20',
  awaiting: 'bg-gold/10 text-gold border-gold/20',
  done_empty: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
};

export function Badge({ children, tone }) {
  return (
    <span className={cx(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
      BADGE_TONES[tone] || 'bg-white/5 text-muted-foreground border-line')}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground/70">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground/60 outline-none focus:border-blue/60';

export function Button({ variant = 'primary', className, disabled, children, ...rest }) {
  const styles = {
    primary: 'bg-blue text-white hover:bg-blue/90',
    ghost: 'border border-line text-foreground hover:border-blue/40 hover:text-blue',
    danger: 'border border-red-500/30 text-red-400 hover:bg-red-500/10',
  };
  return (
    <button
      {...rest}
      disabled={disabled}
      className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-50', styles[variant], className)}>
      {children}
    </button>
  );
}

export const Spinner = () => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" /> загружаем
  </div>
);

export function Empty({ children }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {String(error.message || error)}
    </div>
  );
}

/** Часы из минут, всегда одинаково: 90 → «1,5 ч». */
export const hours = (minutes) =>
  `${((minutes || 0) / 60).toFixed(1).replace('.', ',')} ч`;

export const money = (value, currency = '₸') =>
  `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ${currency}`;

export const dateTime = (value) =>
  value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const dateOnly = (value) =>
  value ? new Date(value).toLocaleDateString('ru-RU', { dateStyle: 'short' }) : '—';

/* ── Добавлено вместе с разделами «Бух учет», «ИИ» и «Администрирование» ──── */

export const num = (value, digits = 0) =>
  (Number(value) || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });

export const usd = (value) => `$${(Number(value) || 0).toFixed(2)}`;

export const pct = (value) =>
  value === null || value === undefined ? '—' : `${num(value, 1)} %`;

/** «5 мин назад», «2 ч назад». Для живого экрана: точное время там мешает. */
export const ago = (value) => {
  if (!value) return '—';
  const sec = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (sec < 10) return 'только что';
  if (sec < 60) return `${sec} с назад`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
};

export const duration = (ms) => {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} мс`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace('.', ',')} с`;
  const m = Math.floor(s / 60);
  return `${m} мин ${Math.round(s % 60)} с`;
};

/**
 * Таблица. Колонки описываются данными, а не разметкой: экранов много,
 * и одинаковые таблицы должны выглядеть одинаково без усилий.
 * cols: [{ key, title, render?, align?, width?, hide? }]
 */
export function Table({ cols, rows, rowKey = (r, i) => r.id ?? i, onRowClick, empty, footer }) {
  const shown = cols.filter((c) => !c.hide);
  if (!rows?.length) return <Empty>{empty || 'Пусто.'}</Empty>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {shown.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}
                  className={cx('whitespace-nowrap pb-2 pr-3 font-medium',
                    c.align === 'right' && 'text-right')}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx('border-t border-line/60',
                  onRowClick && 'cursor-pointer hover:bg-white/[0.03]')}>
              {shown.map((c) => (
                <td key={c.key}
                    className={cx('py-2 pr-3 align-top',
                      c.align === 'right' && 'text-right tabular-nums')}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot className="border-t-2 border-line">{footer}</tfoot>}
      </table>
    </div>
  );
}

/** Окно поверх страницы. Закрывается по Esc — иначе форма превращается в ловушку. */
export function Modal({ title, onClose, children, wide }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
         onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={cx('my-8 w-full rounded-2xl border border-line bg-surface shadow-2xl',
                         wide ? 'max-w-4xl' : 'max-w-xl')}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} aria-label="Закрыть"
                  className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Toolbar({ children, right }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {right && <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface/40 p-1">
      {items.map((it) => (
        <button key={it.value} onClick={() => onChange(it.value)}
          className={cx('rounded-lg px-3 py-1.5 text-xs font-medium transition',
            value === it.value ? 'bg-blue/15 text-blue' : 'text-muted-foreground hover:text-foreground')}>
          {it.label}{it.count !== undefined && <span className="ml-1.5 opacity-60">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Полоса заполнения. tone считается по значению, а не задаётся снаружи. */
export function Bar({ value, max, label }) {
  const share = max > 0 ? Math.min(100, (100 * value) / max) : 0;
  const color = share >= 100 ? 'bg-red-500' : share >= 80 ? 'bg-amber-400' : 'bg-blue';
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="tabular-nums">{num(share, 0)} %</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

const OUTCOME = {
  ok: ['bg-emerald-500/15 text-emerald-400 border-emerald-500/30', 'выполнено'],
  error: ['bg-red-500/15 text-red-400 border-red-500/30', 'ошибка'],
  refused: ['bg-amber-500/15 text-amber-400 border-amber-500/30', 'отказ'],
  escalated: ['bg-violet-500/15 text-violet-300 border-violet-500/30', 'эскалация'],
  partial: ['bg-gold/15 text-gold border-gold/30', 'частично'],
};

/** Отказ — не ошибка. Разные цвета, потому что это разные события. */
export function Outcome({ value }) {
  const [cls, label] = OUTCOME[value] || ['bg-white/5 text-muted-foreground border-line', value];
  return (
    <span className={cx('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium', cls)}>
      {label}
    </span>
  );
}

const ENTRY_STATUS = { draft: 'черновик', posted: 'проведён', void: 'отменён' };
const CMS_STATUS = { draft: 'черновик', published: 'опубликовано', hidden: 'скрыто' };
const DOC_STATUS = {
  draft: 'черновик', issued: 'выставлен', paid: 'оплачен',
  partly_paid: 'оплачен частично', overdue: 'просрочен', cancelled: 'отменён',
};

export const entryStatusLabel = (s) => ENTRY_STATUS[s] || s;
export const cmsStatusLabel = (s) => CMS_STATUS[s] || s;
export const docStatusLabel = (s) => DOC_STATUS[s] || s;

export function StatusBadge({ value, dict }) {
  const tone = value === 'posted' || value === 'published' || value === 'paid' ? 'approved'
    : value === 'overdue' || value === 'void' ? 'dead'
    : value === 'draft' ? 'queued'
    : value === 'partly_paid' ? 'estimated'
    : value === 'hidden' ? 'cancelled' : undefined;
  return <Badge tone={tone}>{dict ? dict(value) : value}</Badge>;
}

/** Подпись «данные от такого-то времени». Живой экран обязан говорить, насколько он живой. */
export function Freshness({ at, stale, error }) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        связь потеряна, данные от {dateTime(at)}
      </span>
    );
  }
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs',
      stale ? 'text-amber-400' : 'text-muted-foreground')}>
      <span className={cx('h-1.5 w-1.5 rounded-full', stale ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse')} />
      {stale ? `обновление задерживается, данные от ${dateTime(at)}` : `обновлено ${ago(at)}`}
    </span>
  );
}
