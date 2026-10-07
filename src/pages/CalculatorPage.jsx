/**
 * /kalkulyator — «сколько вы теряете» на ЭСФ и ручной работе.
 *
 * Расчёт и тексты — src/lib/content/calculator.js (там же, почему в нём нет
 * штрафов). Считается в браузере: ни формы, ни запроса к серверу на странице
 * нет. На сборке страница собирается со значениями по умолчанию, поэтому
 * результат виден и без JavaScript.
 */
import React, { useId, useMemo, useState } from 'react';
import { ArrowRight, Calculator, Clock, Lock, ScanSearch, TriangleAlert } from 'lucide-react';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useLang } from '@/lib/i18n/LangContext';
import { CALC_DEFAULTS, CALC_TEXT, calculate, formatHours } from '@/lib/content/calculator';
import { PRODUCTS_1C_PATH } from '@/lib/content/proverka';
import { groupThousands } from '@/lib/money';

const FIELDS = [
  { key: 'sales', step: 1 },
  { key: 'avgCheck', step: 1000 },
  { key: 'bank', step: 1 },
  { key: 'counterparties', step: 1 },
  { key: 'minutes', step: 0.5, estimate: true },
  { key: 'lateShare', step: 0.5, max: 100, estimate: true },
];

function Field({ field, text, estimateLabel, value, onChange }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm font-medium text-white/75">
        {text.label}
        {field.estimate && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
            {estimateLabel}
          </span>
        )}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        max={field.max}
        step={field.step}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-base tabular-nums text-white outline-none transition-colors focus:border-primary/50"
      />
      <p className="mt-1.5 text-xs leading-snug text-white/30">{text.hint}</p>
    </div>
  );
}

export default function CalculatorPage() {
  const { lang } = useLang();
  const tx = CALC_TEXT[lang] || CALC_TEXT.ru;
  const [values, setValues] = useState(() => Object.fromEntries(
    Object.entries(CALC_DEFAULTS).map(([k, v]) => [k, String(v)]),
  ));
  const result = useMemo(() => calculate(values), [values]);
  const update = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));
  const lateSales = Math.round(result.lateSales);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(ellipse, hsl(252 100% 68% / 0.06) 0%, transparent 70%)' }}
      />

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-28">
        <Reveal>
          <p className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/25">
            <Calculator className="h-3.5 w-3.5" /> {tx.label}
          </p>
          <h1 className="max-w-4xl text-[clamp(2.1rem,5vw,4rem)] font-black leading-[1.04] tracking-[-0.04em] text-white">
            {tx.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/45">{tx.sub}</p>
          <p className="mt-4 flex max-w-2xl items-start gap-2 text-sm text-emerald-300/70">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {tx.privacy}
          </p>
        </Reveal>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-6 px-5 pb-28 xl:grid-cols-[1fr_1fr]">
        <form
          className="rounded-3xl border border-line bg-surface/80 p-6 sm:p-8"
          onSubmit={(e) => e.preventDefault()}
          aria-label={tx.inputsTitle}
        >
          <h2 className="mb-6 text-lg font-bold text-white">{tx.inputsTitle}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <Field
                key={field.key}
                field={field}
                text={tx.fields[field.key]}
                estimateLabel={tx.estimate}
                value={values[field.key]}
                onChange={update}
              />
            ))}
          </div>
        </form>

        <div className="flex flex-col gap-6" aria-live="polite">
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-6 sm:p-8">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-amber-300/70">
              <TriangleAlert className="h-4 w-4" /> {tx.atRisk.title}
            </p>
            <p className="mt-3 text-[clamp(2rem,5vw,3rem)] font-black leading-none tabular-nums text-white">
              {groupThousands(result.atRisk)}
              <span className="mt-1 block text-sm font-semibold text-white/40">{tx.atRisk.unit}</span>
            </p>
            <p className="mt-3 text-sm text-white/60">{tx.atRisk.lateSales(groupThousands(lateSales))}</p>
            <p className="mt-4 text-xs leading-relaxed text-white/35">{tx.atRisk.note}</p>
          </div>

          <div className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-8">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-primary/70">
              <Clock className="h-4 w-4" /> {tx.hours.title}
            </p>
            <p className="mt-3 text-[clamp(2rem,5vw,3rem)] font-black leading-none tabular-nums text-white">
              {formatHours(result.hours, lang)}
              <span className="mt-1 block text-sm font-semibold text-white/40">{tx.hours.unit}</span>
            </p>
            <ul className="mt-4 space-y-1.5">
              {result.parts.map((p) => (
                <li key={p.key} className="flex justify-between gap-4 text-sm text-white/55">
                  <span>{tx.hours.parts[p.key]}</span>
                  <span className="tabular-nums text-white/75">{formatHours(p.hours, lang)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-white/35">{tx.hours.note}</p>
          </div>

          <div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/proverka"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_30px_hsl(220_100%_60%/0.3)] transition-colors hover:bg-primary/80"
              >
                <ScanSearch className="h-4 w-4" /> {tx.ctaCheck}
              </Link>
              <Link
                to={PRODUCTS_1C_PATH}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/20 hover:text-white"
              >
                {tx.ctaProducts} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/35">{tx.ctaNote}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/25">{tx.formula}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
