/**
 * /proverka — бесплатная экспресс-проверка базы 1С (лид-магнит).
 *
 * Порядок блоков — порядок сомнений бухгалтера: что это и подходит ли моей
 * базе → что именно найдёт → не сломает ли базу → как запустить → что
 * потом делать с отчётом → где взять файл.
 *
 * «Безопасность» стоит ДО формы, а не мелким шрифтом после: человек
 * открывает чужой файл в рабочей базе, и пока этот вопрос не снят, до формы
 * он не дойдёт.
 *
 * Файл отдаётся ссылкой после заявки. Он лежит в public/downloads/ и
 * доступен по прямому адресу — это не секрет и не защита, а момент, когда
 * человек оставляет контакт для разбора отчёта. Заявка идёт тем же путём,
 * что и все формы сайта: /api/lead → submit_lead, согласие на ПД обязательно.
 */
import React, { useState } from 'react';
import {
  ArrowRight, CheckCircle2, CodeXml, FileDown, Loader2, Lock, ScanSearch, ShieldCheck, WifiOff,
} from 'lucide-react';
import Reveal from '@/components/core/Reveal';
import ConsentCheckbox from '@/components/core/ConsentCheckbox';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useLang } from '@/lib/i18n/LangContext';
import { submitLead } from '@/lib/leads';
import { reachGoal } from '@/lib/analytics/metrika';
import {
  EPF_FILE, EPF_URL, PRODUCTS_1C_PATH, PROVERKA_FORM, PROVERKA_SUBJECT, PROVERKA_TEXT,
} from '@/lib/content/proverka';

const SAFETY_ICONS = { lock: Lock, offline: WifiOff, shield: ShieldCheck, code: CodeXml };

const EMPTY = { name: '', phone: '', email: '', company: '' };

const label = 'mb-4 text-xs uppercase tracking-[0.3em] text-white/20';
const h2 = 'text-[clamp(1.6rem,3vw,2.4rem)] font-black tracking-[-0.03em] leading-[1.1] text-white';
const input = 'w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/15 outline-none focus:border-primary/40 transition-colors ym-disable-keys';

/** Плавно к блоку, без смены адреса: решётка в адресе сбила бы переход между страницами. */
const scrollTo = (id) => (event) => {
  event.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function LeadForm({ tx }) {
  const { t } = useLang();
  const [form, setForm] = useState(EMPTY);
  // Конфигурация — номер варианта, а не подпись: в заявку уходит русская
  // подпись на любом языке страницы, чтобы в панели не было трёх написаний.
  const [config, setConfig] = useState(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [sent, setSent] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!consent) {
      setError(t.consent.required);
      return;
    }
    setSaving(true);
    setError('');
    const configName = config === null ? null : PROVERKA_TEXT.ru.form.configs[config];
    try {
      const result = await submitLead({
        ...form,
        service: PROVERKA_SUBJECT,
        source: PROVERKA_FORM,
        message: [
          'Запрос файла экспресс-проверки базы 1С (.epf).',
          configName && `Конфигурация: ${configName}.`,
        ].filter(Boolean).join(' '),
        consent: true,
      });
      setReceipt(result || null);
      setSent(true);
      setForm(EMPTY);
      setConfig(null);
      setConsent(false);
    } catch (err) {
      setError(err.message || tx.error);
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-start" role="status">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-black text-white">{tx.doneTitle}</h3>
        <p className="mt-2 text-sm text-white/40">{tx.doneSub}</p>

        <a
          href={EPF_URL}
          download={EPF_FILE}
          onClick={() => reachGoal('express_check_download')}
          className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary/80"
        >
          <FileDown className="h-4 w-4" />
          {tx.download}
        </a>
        <p className="mt-2 font-mono text-[11px] text-white/25">{EPF_FILE}</p>

        <ol className="mt-7 space-y-2.5">
          {tx.doneSteps.map((line, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/55">
              <span className="mt-[1px] shrink-0 select-none tabular-nums text-primary/60">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>

        {receipt?.ref && (
          <p className="mt-6 text-xs text-white/30">
            {tx.ref}: <span className="font-semibold text-white/60">{receipt.ref}</span>
          </p>
        )}

        <button
          type="button"
          onClick={() => { setSent(false); setReceipt(null); }}
          className="mt-6 text-xs text-white/30 underline underline-offset-2 transition-colors hover:text-white/60"
        >
          {tx.again}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['name', tx.name, tx.namePh, true, 'name', 'text'],
          ['phone', tx.phone, tx.phonePh, true, 'tel', 'tel'],
          ['email', tx.email, tx.emailPh, false, 'email', 'email'],
          ['company', tx.company, tx.companyPh, false, 'organization', 'text'],
        ].map(([key, title, placeholder, required, autoComplete, type]) => (
          <label key={key} className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-wide text-white/30">
              {title}{required && <span className="text-primary/70"> *</span>}
            </span>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
              required={required}
              autoComplete={autoComplete}
              placeholder={placeholder}
              className={input}
            />
          </label>
        ))}
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-[10px] uppercase tracking-wide text-white/30">{tx.config}</legend>
        <div className="flex flex-wrap gap-2">
          {tx.configs.map((name, i) => (
            <button
              key={name}
              type="button"
              aria-pressed={config === i}
              onClick={() => setConfig(config === i ? null : i)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${
                config === i
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-line bg-surface-2 text-white/40 hover:text-white/70'}`}
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      <ConsentCheckbox checked={consent} onChange={setConsent} />

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={saving || !consent}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary/80 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {saving ? tx.sending : tx.submit}
      </button>
    </form>
  );
}

export default function ProverkaPage() {
  const { lang } = useLang();
  const tx = PROVERKA_TEXT[lang] || PROVERKA_TEXT.ru;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] max-w-full -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(ellipse, hsl(252 100% 68% / 0.06) 0%, transparent 70%)' }}
      />

      {/* Что это и для какой базы */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-28">
        <Reveal>
          <p className={label}>{tx.hero.label}</p>
          <h1 className="max-w-4xl text-[clamp(2.1rem,5vw,4rem)] font-black leading-[1.04] tracking-[-0.04em] text-white">
            {tx.hero.title}
          </h1>
          <div className="mt-6 flex flex-wrap gap-2">
            {tx.hero.configs.map((name) => (
              <span key={name} className="rounded-full border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5 text-xs text-primary/90">
                {name}
              </span>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/45">{tx.hero.sub}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#poluchit"
              onClick={scrollTo('poluchit')}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-white shadow-[0_0_30px_hsl(220_100%_60%/0.3)] transition-all hover:bg-primary/80"
            >
              <FileDown className="h-4 w-4" />
              {tx.hero.ctaPrimary}
            </a>
            <a
              href="#chto-proveryaet"
              onClick={scrollTo('chto-proveryaet')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-7 py-3.5 text-sm font-semibold text-white/60 transition-all hover:border-white/20 hover:text-white"
            >
              <ScanSearch className="h-4 w-4" />
              {tx.hero.ctaSecondary}
            </a>
          </div>
        </Reveal>
      </section>

      {/* Шесть проверок и что их закрывает */}
      <section id="chto-proveryaet" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
        <Reveal>
          <p className={label}>{tx.checks.label}</p>
          <h2 className={h2}>{tx.checks.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/35">{tx.checks.sub}</p>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tx.checks.items.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.05} className="h-full">
              <article className="flex h-full flex-col rounded-2xl border border-line bg-white/[0.015] p-6 transition-colors duration-300 hover:border-white/15">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-xs text-primary">
                    {i + 1}
                  </span>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                </div>
                <ul className="space-y-2">
                  {item.points.map((line, k) => (
                    <li key={k} className="flex gap-2 text-sm leading-relaxed text-white/50">
                      <span className="mt-[2px] select-none text-primary/60">·</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-5">
                  <div className="border-t border-line pt-4 text-xs text-white/30">
                    {tx.checks.productLabel}:{' '}
                    <Link to={PRODUCTS_1C_PATH} className="font-semibold text-primary transition-colors hover:text-white">
                      {item.product}
                    </Link>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <Link
            to={PRODUCTS_1C_PATH}
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-white"
          >
            {tx.checks.productsLink}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Reveal>
      </section>

      {/* Безопасность — до формы: без этого файл в рабочую базу не откроют */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <p className={label}>{tx.safety.label}</p>
          <h2 className={h2}>{tx.safety.title}</h2>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {tx.safety.items.map((item) => {
            const Icon = SAFETY_ICONS[item.icon] || ShieldCheck;
            return (
              <div key={item.title} className="bg-background p-6">
                <Icon className="mb-4 h-5 w-5 text-emerald-400/80" />
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Как запустить и что делать с отчётом */}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2">
        <Reveal>
          <p className={label}>{tx.howto.label}</p>
          <h2 className={h2}>{tx.howto.title}</h2>
          <ol className="mt-8 space-y-6">
            {tx.howto.steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/45">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={0.1}>
          <p className={label}>{tx.report.label}</p>
          <h2 className={h2}>{tx.report.title}</h2>
          <ul className="mt-8 space-y-4">
            {tx.report.items.map((line, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/50">
                <span className="mt-[1px] select-none text-primary/60">+</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 text-sm leading-relaxed text-white/60">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" />
            {tx.report.note}
          </p>
        </Reveal>
      </section>

      {/* Заявка и файл */}
      <section id="poluchit" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-5 pb-28 pt-16">
        <Reveal>
          <div className="grid gap-10 rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
            <div>
              <p className="mb-4 text-[10px] uppercase tracking-[0.25em] text-primary/60">{tx.form.label}</p>
              <h2 className={h2}>{tx.form.title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-white/40">{tx.form.sub}</p>
              <p className="mt-6 flex items-center gap-2 font-mono text-xs text-white/25">
                <FileDown className="h-3.5 w-3.5" /> {EPF_FILE}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface/80 p-6 backdrop-blur-2xl lg:p-7">
              <LeadForm tx={tx.form} />
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
