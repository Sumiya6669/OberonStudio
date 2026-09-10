/**
 * /uslugi/<slug> — одна работа целиком.
 *
 * Порядок блоков — порядок вопросов покупателя: что это и мне ли это →
 * что входит → чего НЕ будет → как проходит → сколько и когда → что
 * останется на руках.
 *
 * «Что не входит» стоит сразу после «что входит», а не мелким шрифтом в
 * конце. Так и надо: возражение, снятое до разговора, экономит время
 * обеим сторонам, а обнаруженное после оплаты портит отношения.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import Reveal from '@/components/core/Reveal';
import { LocaleLink as Link } from '@/components/nav/LocaleLink';
import { useOffers, useContentReady } from '@/lib/site/SiteContentContext';
import { CONTACT_PATH } from '@/lib/routes';
import PageNotFound from '@/lib/PageNotFound';
import { priceLabel } from './OffersPage';

function Block({ label, items, tone = 'plain' }) {
  if (!items?.length) return null;
  const marks = { plain: '·', yes: '+', no: '−', step: null };
  return (
    <div>
      <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">{label}</p>
      <ul className="space-y-3">
        {items.map((line, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/55">
            <span className={`mt-[1px] shrink-0 select-none tabular-nums ${
              tone === 'no' ? 'text-white/25' : 'text-primary/60'}`}>
              {tone === 'step' ? `${i + 1}.` : marks[tone]}
            </span>
            <span className={tone === 'no' ? 'text-white/35' : undefined}>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OfferPage() {
  const { slug } = useParams();
  const offers = useOffers();
  const ready = useContentReady();
  const offer = offers?.find((o) => o.slug === slug);
  const others = (offers || []).filter((o) => o.slug !== slug);

  if (!ready && !offer) return <div className="min-h-[60vh]" />;
  if (!offer) return <PageNotFound />;

  return (
    <section className="relative overflow-hidden py-28">
      <div className="relative z-10 mx-auto max-w-4xl px-5">
        <Reveal>
          <Link to="/uslugi" className="text-xs text-white/25 transition-colors hover:text-white/60">
            ← Все работы
          </Link>
          <div className="mt-6 flex items-start gap-4">
            <span className="text-3xl leading-none">{offer.icon}</span>
            <div>
              <h1 className="text-[clamp(1.8rem,3.4vw,3rem)] font-black leading-[1.08] tracking-[-0.03em] text-white">
                {offer.title}
              </h1>
              <p className="mt-3 text-base text-white/45">{offer.tagline}</p>
            </div>
          </div>
          <p className="mt-8 max-w-3xl text-base leading-relaxed text-white/55">{offer.lead}</p>
        </Reveal>

        {/* Цена и срок вместе: по отдельности они не отвечают ни на что. */}
        <Reveal>
          <div className="mt-10 flex flex-wrap items-end gap-x-10 gap-y-4 rounded-2xl border border-line bg-white/[0.02] p-6">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.3em] text-white/20">Стоимость</p>
              <p className={`text-xl font-semibold ${offer.priceFrom ? 'text-white' : 'text-white/50'}`}>
                {priceLabel(offer)}
              </p>
              {offer.priceNote && (
                <p className="mt-1 max-w-md text-xs leading-relaxed text-white/30">{offer.priceNote}</p>
              )}
            </div>
            {offer.term && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.3em] text-white/20">Сроки</p>
                <p className="text-sm text-white/55">{offer.term}</p>
              </div>
            )}
          </div>
        </Reveal>

        <div className="mt-16 space-y-14">
          <Reveal><Block label="Что входит" items={offer.included} tone="yes" /></Reveal>
          <Reveal><Block label="Что не входит" items={offer.excluded} tone="no" /></Reveal>
          <Reveal><Block label="Как проходит" items={offer.steps} tone="step" /></Reveal>

          {offer.result && (
            <Reveal>
              <div>
                <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">
                  Что останется у вас
                </p>
                <p className="text-sm leading-relaxed text-white/55">{offer.result}</p>
              </div>
            </Reveal>
          )}

          <Reveal>
            <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-8">
              <p className="text-sm leading-relaxed text-white/60">
                Напишите, что у вас за конфигурация и что беспокоит. Оценку и срок
                я называю до начала работ — если задача окажется не моя, скажу об
                этом сразу и бесплатно.
              </p>
              <Link
                to={CONTACT_PATH}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition-all duration-300 hover:bg-primary/20 hover:border-primary/50">
                Написать и получить оценку
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </Reveal>

          {others.length > 0 && (
            <Reveal>
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/20">Другие работы</p>
              <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
                {others.map((o) => (
                  <Link key={o.slug} to={`/uslugi/${o.slug}`}
                        className="bg-background p-5 transition-colors hover:bg-white/[0.02]">
                    <div className="text-sm text-white/60">
                      <span className="mr-2">{o.icon}</span>{o.title}
                    </div>
                    <div className="mt-1 text-xs text-white/25">{priceLabel(o)}</div>
                  </Link>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
