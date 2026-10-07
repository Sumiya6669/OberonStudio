/**
 * /bezopasnost — как продукты Tinker обращаются с базой 1С.
 *
 * Тексты и источник каждого утверждения — src/lib/content/security.js.
 * Страница для главного бухгалтера: блоки в порядке его вопросов — не
 * сломает ли типовую, что запишет, что отправит, как обновляется, кто
 * управляет, где ключи, а в конце — про сам сайт.
 */
import React from 'react';
import {
  ArrowRight, FileText, Globe, Layers, Lock, RefreshCw, ScanSearch, Send, ShieldCheck, Users,
} from 'lucide-react';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useLang } from '@/lib/i18n/LangContext';
import { CONTACT_PATH } from '@/lib/routes';
import { SECURITY_TEXT } from '@/lib/content/security';

const ICONS = { layers: Layers, file: FileText, send: Send, refresh: RefreshCw, users: Users, lock: Lock, globe: Globe };

export default function SecurityPage() {
  const { lang } = useLang();
  const tx = SECURITY_TEXT[lang] || SECURITY_TEXT.ru;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />

      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-12 pt-28">
        <Reveal>
          <p className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/25">
            <ShieldCheck className="h-3.5 w-3.5" /> {tx.label}
          </p>
          <h1 className="max-w-4xl text-[clamp(2.1rem,5vw,3.6rem)] font-black leading-[1.05] tracking-[-0.04em] text-white">
            {tx.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/45">{tx.sub}</p>
        </Reveal>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl space-y-5 px-5 pb-16">
        {tx.sections.map((block) => {
          const Icon = ICONS[block.icon] || ShieldCheck;
          return (
            <Reveal key={block.title}>
              <article className="rounded-2xl border border-line bg-white/[0.015] p-6 sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                    <Icon className="h-4 w-4 text-emerald-400/80" />
                  </span>
                  <h2 className="text-lg font-bold text-white sm:text-xl">{block.title}</h2>
                </div>
                <ul className="space-y-3">
                  {block.points.map((line, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/55">
                      <span className="mt-[2px] shrink-0 select-none text-primary/60">—</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {block.icon === 'globe' && (
                  <Link to="/privacy" className="mt-5 inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-white">
                    {tx.privacyLink} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </article>
            </Reveal>
          );
        })}
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-28">
        <Reveal>
          <div className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-10">
            <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] font-black tracking-[-0.03em] text-white">{tx.ctaTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">{tx.ctaText}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/proverka"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary/80"
              >
                <ScanSearch className="h-4 w-4" /> {tx.ctaCheck}
              </Link>
              <Link
                to={CONTACT_PATH}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/20 hover:text-white"
              >
                {tx.ctaContact} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
