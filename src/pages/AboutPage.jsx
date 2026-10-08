/**
 * /o-kompanii — кто мы, что делаем, как работаем, принципы, отзывы, контакты.
 *
 * Тексты и откуда взят каждый факт — src/lib/content/about.js. Голос
 * («я» или «мы») переключается одним флагом ABOUT_VOICE там же.
 *
 * Цифры не вписаны руками: число расширений и ботов считается по каталогу
 * (PRODUCTS), чтобы страница не разошлась с /products после следующего
 * продукта. Отзывы — только опубликованные в CMS; нет их — блок сводится
 * к ссылке. Реквизиты — только когда заполнены (ABOUT_LEGAL).
 */
import React from 'react';
import {
  AlertTriangle, ArrowRight, Bot, Building2, Code2, Eye, FileText, Layers, Puzzle,
  RefreshCw, ScanSearch, Send,
} from 'lucide-react';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { InstagramIcon, TelegramIcon, WhatsAppIcon } from '@/components/brand/SocialIcons';
import { useLang } from '@/lib/i18n/LangContext';
import { CONTACT_PATH } from '@/lib/routes';
import { PRODUCTS, SITE_SETTINGS } from '@/lib/content/site';
import { useSettings, useTestimonials } from '@/lib/site/SiteContentContext';
import {
  ABOUT_LEGAL, ABOUT_TEXT, ABOUT_VOICE, hasLegal, voiced,
} from '@/lib/content/about';

const ICONS = {
  puzzle: Puzzle, bot: Bot, code: Code2, scan: ScanSearch, layers: Layers, eye: Eye,
  file: FileText, send: Send, refresh: RefreshCw, alert: AlertTriangle,
};

const h2 = 'text-[clamp(1.5rem,3vw,2.2rem)] font-black tracking-[-0.03em] text-white';
const kicker = 'mb-4 text-xs uppercase tracking-[0.3em] text-white/25';

export default function AboutPage() {
  const { lang } = useLang();
  const tx = ABOUT_TEXT[lang] || ABOUT_TEXT.ru;
  const v = (value) => voiced(value, ABOUT_VOICE);
  const settings = useSettings(SITE_SETTINGS);
  const reviews = (useTestimonials() || []).filter((r) => r.text).slice(0, 3);

  const facts = [
    { value: String(PRODUCTS.filter((p) => p.group === '1c').length), label: tx.facts.ext },
    { value: '2', label: tx.facts.configs },
    { value: String(PRODUCTS.filter((p) => p.group === 'bots').length), label: tx.facts.bots },
    { value: '6+', label: tx.facts.years },
  ];

  const contacts = [
    { href: settings.telegram_url, label: 'Telegram', sub: settings.telegram, Icon: TelegramIcon, tone: 'text-sky-400' },
    { href: settings.whatsapp_url, label: 'WhatsApp', sub: settings.whatsapp, Icon: WhatsAppIcon, tone: 'text-emerald-400' },
    { href: settings.telegram_channel_url, label: tx.channel, sub: settings.telegram_channel, Icon: TelegramIcon, tone: 'text-sky-400' },
    { href: settings.instagram_url, label: 'Instagram', sub: settings.instagram, Icon: InstagramIcon, tone: 'text-pink-400' },
  ].filter((c) => c.href);

  const legal = hasLegal(ABOUT_LEGAL)
    ? Object.entries(tx.legal).filter(([key]) => ABOUT_LEGAL[key]).map(([key, name]) => ({ key, name, value: ABOUT_LEGAL[key] }))
    : [];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />

      {/* Кто мы */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-12 pt-28">
        <Reveal>
          <p className={`${kicker} flex items-center gap-2`}>
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> {tx.label}
          </p>
          <h1 className="max-w-4xl text-[clamp(2.1rem,5vw,3.6rem)] font-black leading-[1.05] tracking-[-0.04em] text-white">
            {tx.title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/55 sm:text-lg">{v(tx.lead)}</p>
        </Reveal>
        <Reveal delay={0.05}>
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="bg-background p-5 sm:p-6">
                <dt className="sr-only">{f.label}</dt>
                <dd>
                  <span className="block text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl">{f.value}</span>
                  <span className="mt-1 block text-xs leading-snug text-white/40">{f.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* Что делаем */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
        <Reveal><h2 className={`${h2} mb-6`}>{v(tx.whatTitle)}</h2></Reveal>
        <div className="grid gap-5 md:grid-cols-2">
          {tx.what.map((item, i) => {
            const Icon = ICONS[item.icon] || Puzzle;
            return (
              <Reveal key={item.title} delay={i * 0.04}>
                <article className="flex h-full flex-col rounded-2xl border border-line bg-white/[0.015] p-6 sm:p-7">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-white/50">{item.text}</p>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                    <Link to={item.to} className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-white">
                      {item.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    {item.second && (
                      <Link to={item.second.to} className="inline-flex items-center gap-1.5 text-sm text-white/45 transition-colors hover:text-white">
                        {item.second.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Как работаем */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
        <Reveal><h2 className={`${h2} mb-6`}>{v(tx.howTitle)}</h2></Reveal>
        <Reveal>
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {tx.how.map((step, i) => (
              <li key={step.title} className="bg-background p-5 sm:p-6">
                <span className="font-mono text-xs text-primary/70">{String(i + 1).padStart(2, '0')}</span>
                <p className="mt-2 font-semibold text-white/85">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/45">{step.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/45">{v(tx.terms)}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/process" className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-white">
              {tx.howLink} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link to="/faq" className="inline-flex items-center gap-1.5 text-sm text-white/45 transition-colors hover:text-white">
              {tx.termsLink} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Принципы */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
        <Reveal>
          <h2 className={h2}>{tx.principlesTitle}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/40">{tx.principlesSub}</p>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tx.principles.map((p, i) => {
            const Icon = ICONS[p.icon] || Layers;
            return (
              <Reveal key={p.title} delay={i * 0.03}>
                <article className="h-full rounded-2xl border border-line bg-white/[0.015] p-6">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                      <Icon className="h-4 w-4 text-emerald-400/80" aria-hidden="true" />
                    </span>
                    <h3 className="font-bold leading-snug text-white">{p.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-white/50">{p.text}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
        <Reveal>
          <Link to="/bezopasnost" className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-white">
            {tx.principlesLink} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Reveal>
      </section>

      {/* Отзывы — только опубликованные. Нет их (или CMS недоступна) — одна ссылка, без пустого заголовка. */}
      {reviews.length === 0 ? (
        <section className="relative z-10 mx-auto max-w-6xl px-5 pb-12">
          <Link to="/reviews" className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-white">
            {tx.reviewsTitle} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      ) : (
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
        <Reveal>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className={h2}>{tx.reviewsTitle}</h2>
            <Link to="/reviews" className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-white">
              {tx.reviewsAll} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
            {reviews.map((r) => (
              <Reveal key={r.id}>
                <figure className="flex h-full flex-col rounded-2xl border border-line bg-white/[0.015] p-6">
                  <blockquote className="flex-1 text-sm leading-relaxed text-white/60">«{r.text}»</blockquote>
                  <figcaption className="mt-5 text-xs">
                    {r.name && <span className="block font-semibold text-white/70">{r.name}</span>}
                    {r.company && <span className="block text-white/30">{r.company}</span>}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
        </div>
      </section>
      )}

      {/* Контакты */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-28">
        <Reveal>
          <div className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-10">
            <h2 className={h2}>{tx.contactsTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">{v(tx.hours)}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {contacts.map(({ href, label, sub, Icon, tone }) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-3 rounded-xl border border-line bg-background/60 px-4 py-3 transition-colors hover:border-white/15">
                    <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white/80">{label}</span>
                      {sub && <span className="block truncate text-xs text-white/35">{sub}</span>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <Link to={CONTACT_PATH}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary/80">
              {tx.contactCta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        {legal.length > 0 && (
          <Reveal>
            <div className="mt-6 rounded-2xl border border-line p-6">
              <h2 className="mb-4 text-lg font-bold text-white">{tx.legalTitle}</h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {legal.map((row) => (
                  <div key={row.key}>
                    <dt className="text-xs text-white/30">{row.name}</dt>
                    <dd className="text-white/70">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        )}
      </section>
    </div>
  );
}
