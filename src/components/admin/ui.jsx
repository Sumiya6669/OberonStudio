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
